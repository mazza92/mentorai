const valueSearchService = require('./valueSearchService');
const youtubeInnertubeService = require('./youtubeInnertubeService');
const { getFirestore } = require('../config/firestore');
const { generateText } = require('./llmClient');

const SCHEMA = 'v5';

class PlaybookService {
  constructor() {
    this.memory = new Map();
    this.inflight = new Map();
  }

  cacheId(videoId, lang) {
    return `${videoId}_${lang}_${SCHEMA}`;
  }

  async getOrGenerate(videoId, { language = 'en' } = {}) {
    const lang = language === 'fr' ? 'fr' : 'en';
    const cacheKey = this.cacheId(videoId, lang);

    if (this.memory.has(cacheKey)) {
      return this.memory.get(cacheKey);
    }
    if (this.inflight.has(cacheKey)) {
      return this.inflight.get(cacheKey);
    }

    const job = this.loadOrCreate(videoId, lang, cacheKey);
    this.inflight.set(cacheKey, job);
    try {
      return await job;
    } finally {
      this.inflight.delete(cacheKey);
    }
  }

  async loadOrCreate(videoId, lang, cacheKey) {
    try {
      const { firestore } = getFirestore();
      if (firestore) {
        const snap = await firestore.collection('playbooks').doc(cacheKey).get();
        if (snap.exists) {
          const cached = snap.data();
          this.memory.set(cacheKey, cached);
          return cached;
        }
      }
    } catch (err) {
      console.warn('[Playbook] Cache read skipped:', err.message);
    }

    const payload = await this.generate(videoId, lang);
    if (payload.aiGenerated) {
      this.memory.set(cacheKey, payload);
      this.persist(cacheKey, payload);
    }
    return payload;
  }

  persist(cacheKey, payload) {
    Promise.resolve()
      .then(async () => {
        const { firestore } = getFirestore();
        if (!firestore) return;
        await firestore.collection('playbooks').doc(cacheKey).set({
          ...stripUndefined(payload),
          generatedAt: new Date().toISOString()
        });
      })
      .catch((err) => console.warn('[Playbook] Cache write skipped:', err.message));
  }

  async generate(videoId, lang) {
    const started = Date.now();
    const [video, comments, transcript] = await Promise.all([
      this.loadVideo(videoId),
      valueSearchService.fetchTopComments(videoId, 40).catch(() => []),
      this.fetchCaptionsFast(videoId)
    ]);

    const transcriptText = String(transcript?.text || '').trim();
    const transcriptSource = transcript?.source || null;
    const segments = Array.isArray(transcript?.segments) ? transcript.segments : [];
    if (!transcriptText && !comments.length && !video.description) {
      const err = new Error('Not enough source material to build a playbook');
      err.code = 'NO_SOURCE';
      throw err;
    }

    let playbook;
    let aiGenerated = true;
    try {
      playbook = await this.generateContent(video, transcriptText, comments, lang, segments);
    } catch (err) {
      console.warn('[Playbook] LLM failed, extracting from source material:', err.message);
      playbook = this.buildFromSources(video, transcriptText, comments, lang, segments);
      aiGenerated = false;
    }

    console.log(`[Playbook] Ready for ${videoId} in ${((Date.now() - started) / 1000).toFixed(1)}s (captions: ${!!transcriptText}, ai: ${aiGenerated})`);
    return {
      video,
      transcriptAvailable: !!transcriptText,
      transcriptSource,
      commentCountUsed: comments.length,
      language: lang,
      aiGenerated,
      playbook
    };
  }

  async loadVideo(videoId) {
    try {
      return await valueSearchService.getVideo(videoId);
    } catch (err) {
      console.warn('[Playbook] Video metadata fallback:', err.message);
      return {
        videoId,
        title: 'YouTube video',
        channel: '',
        description: '',
        published: '',
        thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        views: 0,
        likes: 0,
        comments: 0,
        durationSec: 0
      };
    }
  }

  async fetchCaptionsFast(videoId) {
    try {
      const transcript = await Promise.race([
        youtubeInnertubeService.fetchTranscript(videoId, { skipSlowFallback: true }),
        new Promise((resolve) => setTimeout(() => resolve({ success: false, timedOut: true }), 4000))
      ]);
      if (transcript?.timedOut) {
        console.warn(`[Playbook] Caption fetch timed out for ${videoId}`);
        return { success: false, text: '', source: null, segments: [] };
      }
      const text = String(transcript?.text || transcript?.transcript?.text || '').trim();
      const segments = transcript?.segments || transcript?.transcript?.segments || [];
      if (text.split(/\s+/).filter(Boolean).length >= 8) {
        return {
          success: true,
          text,
          segments,
          source: transcript.source || transcript.strategy || 'captions'
        };
      }
    } catch (err) {
      console.warn('[Playbook] Transcript fetch failed:', err.message);
    }
    return { success: false, text: '', source: null, segments: [] };
  }

  async generateContent(video, transcriptText, comments, lang, segments = []) {
    const isFr = lang === 'fr';
    const chapters = this.parseChapters(video.description || '');
    const chapterBlock = chapters
      .slice(0, 16)
      .map((c) => `${c.timestampFormatted} ${c.title}`)
      .join('\n');
    const timed = (segments || [])
      .filter((s) => String(s.text || s.transcript || '').trim())
      .slice(0, 90)
      .map((s) => {
        const sec = Math.round(s.start || (s.startMs ? s.startMs / 1000 : 0) || s.offset || 0);
        return `[${this.formatClock(sec)}] ${String(s.text || s.transcript).replace(/\s+/g, ' ').trim()}`;
      })
      .join('\n')
      .slice(0, 7000);
    const transcript = timed || (transcriptText || '').slice(0, 7000);
    const commentBlock = comments
      .slice(0, 16)
      .map((c, i) => `${i + 1}. @${c.author}: ${String(c.text || '').replace(/\s+/g, ' ').trim().slice(0, 140)}`)
      .join('\n');
    const detectedFluff = this.detectFluffMoments(video, segments, chapters, isFr);
    const fluffBlock = detectedFluff
      .slice(0, 8)
      .map((item) => `${item.timestampFormatted || '?'} [${item.kind}] ${item.title}: ${item.recap}`)
      .join('\n');

    const prompt = `You are a senior YouTube editor writing a Lurnia playbook.
Write in ${isFr ? 'French' : 'English'}. Never use an em dash. Return ONLY valid JSON.

Job:
- keyTakeaways: 4-6 lessons FROM THE VIDEO (transcript, chapters, description). Never from comments. Never copy a comment as a takeaway. Title is the lesson. Detail is the actionable plan: what to do today.
- playbook: 4-6 ordered actions the viewer can run today. Timestamp if captions or chapters exist.
- skipFluff: specific filler MOMENTS with clock times. kinds: intro, sponsor, ad, affiliate, subscribe, padding, outro. Recap MUST say what happens in that beat (who is advertised, what the ask is, what the tangent is) so the viewer can skip without missing a tactic. Do not write generic lines like "skip the intro".
- viewerFeedback: 4-6 VALUABLE comments, good or bad. Prefer: extra tips, "this is a scam / hype / missing X", didn't work, real results, disagreement. Include unfiltered callouts. Never empty praise ("great video", "thanks", "subbed"). kind must be one of: tip, scam, caveat, result, disagreement, testimony, question. Never use comments as keyTakeaways.
- timestamps: 3-6 high-value moments to jump to. Not fluff.

Do not invent timestamps. Use CANDIDATE FLUFF MOMENTS and the timed transcript. If there are no captions or chapters, use timestamp 0 and timestampFormatted "".

VIDEO: ${video.title} | ${video.channel} | ${Math.round((video.durationSec || 0) / 60)} min
Views ${video.views} | Likes ${video.likes} | Comments ${video.comments}

CHAPTERS:
${chapterBlock || '[None]'}

CANDIDATE FLUFF MOMENTS (confirm, recap, keep real times):
${fluffBlock || '[None found automatically. Scan the transcript for sponsors, ads, subscribe asks, and padding.]'}

TRANSCRIPT:
${transcript || '[No captions. Use description and chapters only for takeaways. Do not invent timestamps.]'}

DESCRIPTION:
${(video.description || '').slice(0, 1800)}

COMMENTS (for viewerFeedback only, never for keyTakeaways):
${commentBlock || '[None]'}

Escape quotes inside strings. No trailing commas. Keep every array to 6 items max.

JSON:
{
  "headline": "max 90 chars",
  "oneLiner": "who + outcome, max 160 chars",
  "whyThisNotClickbait": "2 sentences",
  "audience": "freelancers | founders | students | mixed",
  "keyTakeaways": [{ "title": "lesson", "detail": "how to use it now" }],
  "playbook": [{ "step": 1, "action": "imperative", "detail": "how now", "timestamp": 0, "timestampFormatted": "0:00" }],
  "skipFluff": [{ "kind": "sponsor", "timestamp": 0, "timestampFormatted": "M:SS", "title": "what to skip", "recap": "what happens in that moment" }],
  "viewerFeedback": [{ "author": "name", "quote": "short", "insight": "why this comment is useful", "kind": "tip" }],
  "timestamps": [{ "timestamp": 0, "timestampFormatted": "M:SS", "title": "moment", "description": "why jump here" }],
  "suggestedQuestions": ["question"],
  "faqs": [{ "question": "...", "answer": "..." }]
}`;

    const text = await generateText(prompt, {
      json: true,
      temperature: 0.2,
      maxOutputTokens: 8192,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    });
    try {
      return this.normalizePlaybook(this.parseJson(text), video, comments, lang, transcriptText, segments);
    } catch (parseErr) {
      console.warn('[Playbook] JSON parse retry:', parseErr.message);
      const retry = await generateText(`${prompt}\n\nReturn MINIFIED JSON only. Escape quotes. No trailing commas. Max 5 items per array.`, {
        json: true,
        temperature: 0.1,
        maxOutputTokens: 8192,
        model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
      });
      return this.normalizePlaybook(this.parseJson(retry), video, comments, lang, transcriptText, segments);
    }
  }

  parseJson(text) {
    let jsonText = String(text || '').trim();
    const fenced = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (fenced) jsonText = fenced[1];
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start >= 0 && end > start) jsonText = jsonText.slice(start, end + 1);
    jsonText = jsonText.replace(/,\s*([}\]])/g, '$1');
    try {
      return JSON.parse(jsonText);
    } catch (err) {
      try {
        return JSON.parse(this.closeTruncatedJson(jsonText));
      } catch (err2) {
        throw new Error(`Playbook JSON parse failed: ${err.message}`);
      }
    }
  }

  closeTruncatedJson(text) {
    let s = String(text || '');
    let inString = false;
    let escape = false;
    for (const ch of s) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') inString = !inString;
    }
    if (inString) s += '"';
    const stack = [];
    inString = false;
    escape = false;
    for (const ch of s) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\' && inString) {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{' || ch === '[') stack.push(ch);
      if (ch === '}' || ch === ']') stack.pop();
    }
    while (stack.length) {
      s += stack.pop() === '{' ? '}' : ']';
    }
    return s.replace(/,\s*([}\]])/g, '$1');
  }

  normalizePlaybook(raw, video, comments, lang, transcriptText = '', segments = []) {
    const isFr = lang === 'fr';
    const chapters = this.parseChapters(video.description || '');
    const detectedFluff = this.detectFluffMoments(video, segments, chapters, isFr);
    const skipFluff = this.mergeFluff((raw.skipFluff || []).map((item) => this.normalizeFluffItem(item)), detectedFluff);

    const viewerFeedback = (raw.viewerFeedback || []).map((item) => {
      const quote = String(item.quote || item.text || '').replace(/\s+/g, ' ').trim().slice(0, 280);
      const kind = this.normalizeFeedbackKind(item.kind, quote);
      return {
        author: this.cleanAuthor(item.author),
        quote,
        kind,
        insight: String(item.insight || this.feedbackInsight(kind, isFr)).replace(/\s+/g, ' ').trim().slice(0, 220)
      };
    }).filter((item) => this.isValuableFeedback(item));

    const commentTexts = (comments || []).map((c) => String(c.text || '').replace(/\s+/g, ' ').trim().toLowerCase());
    const keyTakeaways = (raw.keyTakeaways || [])
      .map((item) => ({
        title: String(item.title || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        detail: String(item.detail || '').replace(/\s+/g, ' ').trim().slice(0, 360)
      }))
      .filter((item) => {
        if (!item.title || !item.detail || item.detail === item.title) return false;
        const truncatedTitle = item.title.length >= 80 && !/[.!?]$/.test(item.title);
        if (truncatedTitle && item.detail.startsWith(item.title.slice(0, 40))) return false;
        const blob = `${item.title} ${item.detail}`.toLowerCase();
        return !commentTexts.some((c) => c && c.length >= 40 && (c.startsWith(item.title.toLowerCase().slice(0, 40)) || blob.includes(c.slice(0, 80))));
      });

    return {
      ...raw,
      headline: String(raw.headline || video.title).slice(0, 90),
      keyTakeaways: keyTakeaways.length ? keyTakeaways : this.contentTakeaways(video, isFr, transcriptText),
      skipFluff,
      viewerFeedback: viewerFeedback.length ? viewerFeedback : this.commentFeedback(comments, isFr)
    };
  }

  normalizeFluffItem(item) {
    if (typeof item === 'string') {
      return { kind: 'padding', timestamp: 0, timestampFormatted: '', title: item, recap: item };
    }
    const timestamp = Number(item.timestamp) || 0;
    return {
      kind: String(item.kind || 'padding').toLowerCase(),
      timestamp,
      timestampFormatted: item.timestampFormatted || (timestamp ? this.formatClock(timestamp) : ''),
      title: String(item.title || item.recap || '').slice(0, 120),
      recap: String(item.recap || item.title || '').slice(0, 280)
    };
  }

  mergeFluff(llmItems, detected) {
    const generic = /skip the (motivational )?intro|subscribe asks|sponsor reads and affiliate/i;
    const usable = (llmItems || []).filter((item) => {
      if (!item.title && !item.recap) return false;
      if (generic.test(`${item.title} ${item.recap}`)) return false;
      return (item.timestamp > 0 || item.timestampFormatted) || (item.recap && item.recap.length >= 40 && item.recap !== item.title);
    });
    if (usable.length >= 2) return usable.slice(0, 6);
    const merged = [...usable];
    for (const item of detected || []) {
      const close = merged.some((existing) => Math.abs((existing.timestamp || 0) - (item.timestamp || 0)) < 25 && existing.kind === item.kind);
      if (!close) merged.push(item);
    }
    return merged.slice(0, 6);
  }

  contentTakeaways(video, isFr, transcriptText = '') {
    const fromTranscript = this.extractWorkflowTakeaways(transcriptText, isFr);
    if (fromTranscript.length >= 3) return fromTranscript.slice(0, 6);
    const bullets = this.extractListItems(video.description || '');
    const chapters = this.parseChapters(video.description || '').filter((c) => !this.isFluffChapter(c.title));
    const seeds = bullets.length ? bullets : chapters.map((c) => c.title);
    const rows = seeds.slice(0, 5).map((text, i) => {
      const title = String(text).split(/[.!?:]/)[0].slice(0, 72);
      const rest = String(text).slice(0, 280);
      const chapter = chapters[i];
      const jump = chapter?.timestampFormatted ? ` Jump to ${chapter.timestampFormatted}.` : '';
      return {
        title,
        detail: rest === title
          ? `${title}.${jump} Copy the exact prompt or steps in this section, then run the smallest version today.`
          : rest
      };
    });
    if (rows.length) return rows;
    if (fromTranscript.length) return fromTranscript;
    return [{
      title: isFr ? 'Utilisez les chapitres, pas le hook' : 'Use the chapters, not the hook',
      detail: isFr
        ? 'Sautez l’intro. Notez les étapes concrètes dans la description, puis faites la plus petite version aujourd’hui.'
        : 'Skip the intro. Copy the concrete steps from the description, then run the smallest version today.'
    }];
  }

  extractWorkflowTakeaways(transcriptText, isFr) {
    const text = String(transcriptText || '').replace(/\s+/g, ' ').trim();
    if (text.length < 80) return [];
    const rows = [];
    const numbered = [...text.matchAll(/\b(?:the\s+)?(first|second|third|fourth|fifth|sixth|1st|2nd|3rd|4th|5th|6th|\d+)\s+(?:workflow|step|thing|habit|rule|principle)[^.!?]{12,220}/gi)];
    for (const match of numbered) {
      const sentence = match[0].replace(/\s+/g, ' ').trim();
      const after = text.slice((match.index || 0) + match[0].length, (match.index || 0) + match[0].length + 180).replace(/\s+/g, ' ').trim();
      rows.push({
        title: sentence.split(/[,:]/)[0].slice(0, 72),
        detail: `${sentence} ${after}`.replace(/\s+/g, ' ').trim().slice(0, 280)
      });
    }
    if (rows.length >= 3) return rows.slice(0, 6);
    const actionable = this.splitSentences(text).filter((s) =>
      /\b(should|workflow|prompt|template|instead|do not|don't|first|then|set up|build|save|ask)\b/i.test(s)
      && !/subscribe|like this video|comment below|smash that/i.test(s)
    );
    return actionable.slice(0, 6).map((sentence) => ({
      title: sentence.split(/[,:]/)[0].slice(0, 72),
      detail: isFr ? sentence.slice(0, 280) : sentence.slice(0, 280)
    }));
  }

  commentFeedback(comments, isFr) {
    return (comments || [])
      .map((c) => {
        const quote = String(c.text || '').replace(/\s+/g, ' ').trim();
        const kind = this.classifyComment(quote);
        return {
          author: this.cleanAuthor(c.author),
          quote,
          kind,
          insight: this.feedbackInsight(kind, isFr)
        };
      })
      .filter((item) => this.isValuableFeedback(item) && item.quote.length <= 420 && !/https?:\/\//i.test(item.quote))
      .sort((a, b) => this.feedbackRank(b.kind) - this.feedbackRank(a.kind))
      .slice(0, 6);
  }

  cleanAuthor(name) {
    return String(name || 'Viewer').replace(/^@+/, '').replace(/\s+/g, ' ').trim().slice(0, 40) || 'Viewer';
  }

  normalizeFeedbackKind(kind, quote) {
    const k = String(kind || '').toLowerCase().trim();
    if (['scam', 'fraud', 'fake', 'grift', 'clickbait', 'hype'].includes(k) || this.isScamComment(quote)) return 'scam';
    if (['tip', 'hack', 'addon', 'extra'].includes(k)) return 'tip';
    if (['caveat', 'warning', 'miss', 'missing'].includes(k)) return 'caveat';
    if (['result', 'win', 'worked'].includes(k)) return 'result';
    if (['disagreement', 'pushback', 'disagree'].includes(k)) return 'disagreement';
    if (['testimony', 'used', 'review'].includes(k)) return 'testimony';
    if (['question', 'request', 'ask'].includes(k)) return 'question';
    return this.classifyComment(quote);
  }

  isValuableFeedback(item) {
    const quote = String(item?.quote || '').trim();
    if (quote.length < 24 || this.looksLikeTakeawayDump(quote)) return false;
    if (['scam', 'caveat', 'tip', 'result', 'disagreement'].includes(item.kind)) return true;
    if (this.isPraiseComment(quote)) return false;
    return ['testimony', 'question'].includes(item.kind) || this.isActionableComment(quote);
  }

  feedbackRank(kind) {
    return { scam: 6, caveat: 5, tip: 4, result: 4, disagreement: 3, testimony: 2, question: 1, insight: 0 }[kind] || 0;
  }

  classifyComment(text) {
    const t = String(text || '').toLowerCase();
    if (this.isScamComment(t)) return 'scam';
    if (/didn'?t work|doesn'?t work|missing|watch out|warning|overhyped|failed|problem is|caveat/i.test(t)) return 'caveat';
    if (/pro tip|tip:|you should also|add this|instead|copy-?paste|missing is the prompt|workbook/i.test(t)) return 'tip';
    if (/landed|made \$|got (a )?client|increased|worked for me|booked|this worked/i.test(t)) return 'result';
    if (/disagree|actually no|wrong|overrated|isn'?t true/i.test(t)) return 'disagreement';
    if (/i (tried|built|use|switched|ran)|my (setup|workflow|stack)/i.test(t)) return 'testimony';
    if (/\?/.test(t) && t.length < 220) return 'question';
    return 'insight';
  }

  isScamComment(text) {
    return /scam|fraud|fake|grift|rip-?off|don'?t buy|do not buy|clickbait|waste of (time|money)|snake oil|overhyped/i.test(String(text || ''));
  }

  feedbackInsight(kind, isFr) {
    const map = isFr
      ? {
          scam: 'Un viewer parle de hype ou d’arnaque. À vérifier avant de suivre.',
          caveat: 'Mise en garde: quelque chose manque ou n’a pas marché.',
          tip: 'Un viewer ajoute une astuce que la vidéo ne dit pas assez fort.',
          result: 'Résultat rapporté après avoir testé.',
          disagreement: 'Désaccord utile, pas un like.',
          testimony: 'Témoignage d’usage.',
          question: 'Question de praticien.',
          insight: 'Retour d’usage, pas un like.'
        }
      : {
          scam: 'A viewer flags hype or a possible scam. Check before you follow along.',
          caveat: 'A caveat: something missing, or it did not work.',
          tip: 'A viewer adds a tip the video underplays.',
          result: 'Someone ran it and reported a result.',
          disagreement: 'Useful pushback, not a like.',
          testimony: 'Honest usage note.',
          question: 'A practitioner question.',
          insight: 'Usage note, not a like.'
        };
    return map[kind] || map.insight;
  }

  looksLikeTakeawayDump(text) {
    return /^(installing |the hard part|i show how|that is when|first time i)/i.test(String(text || '').trim());
  }

  isFluffChapter(title) {
    return /intro|outro|sponsor|subscribe|thanks|ad break|self[-\s]?promo| ramble|coffee|let'?s get started|wrap.?up|recap/i.test(title || '');
  }

  detectFluffMoments(video, segments, chapters, isFr) {
    const duration = Number(video.durationSec) || 0;
    const items = [];
    const push = (item) => {
      if (!item?.title && !item?.recap) return;
      const close = items.some((existing) => existing.kind === item.kind && Math.abs((existing.timestamp || 0) - (item.timestamp || 0)) < 20);
      if (!close) items.push(item);
    };

    const chapterList = chapters || [];
    const firstChapter = chapterList[0];
    if (firstChapter && firstChapter.timestamp <= 45 && duration >= 480) {
      push({
        kind: 'intro',
        timestamp: firstChapter.timestamp,
        timestampFormatted: firstChapter.timestampFormatted || '0:00',
        title: isFr ? 'Hook d’ouverture' : 'Opening hook',
        recap: isFr
          ? `Ouverture « ${firstChapter.title} ». La première tactique commence après.`
          : `Opening beat: “${firstChapter.title}”. Jump past the pitch to the first workflow.`
      });
    }

    const lastChapter = chapterList[chapterList.length - 1];
    if (lastChapter && duration && lastChapter.timestamp / duration >= 0.88) {
      push({
        kind: 'outro',
        timestamp: lastChapter.timestamp,
        timestampFormatted: lastChapter.timestampFormatted,
        title: lastChapter.title,
        recap: isFr
          ? `Fin « ${lastChapter.title} ». CTA et wrap, pas de nouvelle méthode.`
          : `Wrap: “${lastChapter.title}”. CTA and recap, not a new tactic.`
      });
    }

    for (const chapter of chapterList) {
      if (!this.isFluffChapter(chapter.title) && !/sponsor|affiliate|ad |promo|subscribe/i.test(chapter.title)) continue;
      push({
        kind: /sponsor|ad|affiliate/i.test(chapter.title) ? 'sponsor' : /intro/i.test(chapter.title) ? 'intro' : /outro|wrap/i.test(chapter.title) ? 'outro' : /subscribe/i.test(chapter.title) ? 'subscribe' : 'padding',
        timestamp: chapter.timestamp,
        timestampFormatted: chapter.timestampFormatted,
        title: chapter.title,
        recap: isFr
          ? `Chapitre « ${chapter.title} ». Pas de tactique ici, vous pouvez sauter.`
          : `This beat is “${chapter.title}”. No tactic here. Skip it.`
      });
    }

    const segs = (segments || []).filter((s) => String(s.text || s.transcript || '').trim());
    const snippet = (from, count) => segs.slice(from, from + count).map((s) => String(s.text || s.transcript).replace(/\s+/g, ' ').trim()).join(' ').slice(0, 180);

    const patterns = [
      { kind: 'sponsor', re: /this (video|episode) is (sponsored|brought to you)|thanks to (our )?(sponsor|partner)|sponsored by|use (code|promo)|discount code|affiliate link|link in (the )?description/i, title: isFr ? 'Sponsor / affilié' : 'Sponsor or affiliate pitch' },
      { kind: 'padding', re: /grab (yourself )?a coffee|besides the point|holy moly|anyway.{0,30}(anyway|update)|this (has )?literally never happened/i, title: isFr ? 'Digression' : 'Tangent / padding' },
      { kind: 'subscribe', re: /like (and subscribe|this video)|smash that|hit the bell|comment (below|workflow)|if you'?re new/i, title: isFr ? 'Appel à s’abonner' : 'Subscribe / like ask' },
      { kind: 'outro', re: /see you (in the next|there)|thanks for watching|algorithm gods/i, title: isFr ? 'Outro' : 'Outro' }
    ];

    segs.forEach((seg, index) => {
      const text = String(seg.text || seg.transcript || '');
      const start = Math.round(seg.start || (seg.startMs ? seg.startMs / 1000 : 0) || (seg.offset ? seg.offset / 1000 : 0) || 0);
      const ratio = duration ? start / duration : 0;
      for (const pattern of patterns) {
        if (!pattern.re.test(text)) continue;
        if (pattern.kind === 'subscribe' && duration && ratio < 0.82) continue;
        if (pattern.kind === 'outro' && duration && ratio < 0.85) continue;
        push({
          kind: pattern.kind,
          timestamp: start,
          timestampFormatted: this.formatClock(start),
          title: pattern.title,
          recap: snippet(index, 5) || text.slice(0, 180)
        });
      }
    });

    if (duration >= 480 && segs.length) {
      const introText = snippet(0, 10);
      if (/in this video|i'?m going to (show|walk)|the (hard|easy) part|before we (get|dive)/i.test(introText)) {
        push({
          kind: 'intro',
          timestamp: 0,
          timestampFormatted: '0:00',
          title: isFr ? 'Hook / promesse' : 'Opening hook',
          recap: introText
        });
      }
    }

    const description = String(video.description || '');
    if (/sponsor|affiliat|use code|promo code/i.test(description) && !items.some((item) => item.kind === 'sponsor')) {
      push({
        kind: 'sponsor',
        timestamp: 0,
        timestampFormatted: '',
        title: isFr ? 'Sponsor dans la description' : 'Sponsor mentioned in the description',
        recap: isFr
          ? 'La description cite un sponsor ou un lien affilié. Attendez le mid-roll, ce n’est pas la méthode.'
          : 'The description cites a sponsor or affiliate link. Watch for the mid-roll; it is not the method.'
      });
    }

    return items.slice(0, 6);
  }

  buildFromSources(video, transcriptText, comments, lang, segments = []) {
    const isFr = lang === 'fr';
    const description = video.description || '';
    const chapters = this.parseChapters(description);
    const bullets = this.extractListItems(description);
    const insightComments = (comments || [])
      .map((c) => String(c.text || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 40 && t.length <= 420 && !/https?:\/\//i.test(t))
      .filter((t) => this.isActionableComment(t));

    const keyTakeaways = this.contentTakeaways(video, isFr, transcriptText);
    const usefulChapters = chapters.filter((c) => !this.isFluffChapter(c.title));
    const bulletSteps = bullets.map((text) => ({ title: text.slice(0, 90), detail: text, description: text }));
    const defaultSteps = isFr
      ? [
          { title: 'Repérez la tactique, pas l’histoire', description: 'Passez l’intro. Notez templates, scripts et chiffres.' },
          { title: 'Copiez le wording exact', description: 'Sujets, CTA, frameworks. Dans une note, tout de suite.' },
          { title: 'Testez une chose maintenant', description: 'La plus petite version de ce qu’ils montrent, aujourd’hui.' },
          { title: 'Ignorez le pitch', description: 'Cours, Discord et outils affiliés après, pas avant.' }
        ]
      : [
          { title: 'Scan for the tactic, not the story', description: 'Skip intro/outro. Pause on templates, scripts, and numbers.' },
          { title: 'Capture the exact wording', description: 'Copy subject lines, CTAs, or frameworks into a note before they disappear.' },
          { title: 'Run one test now', description: 'Send or ship the smallest version of what they demonstrated.' },
          { title: 'Ignore the pitch', description: 'Park courses, Discords, and affiliate tools until the core move works.' }
        ];
    const fromTakeaways = keyTakeaways.map((item) => ({ title: item.title, description: item.detail, detail: item.detail }));
    const stepSeeds = usefulChapters.length ? usefulChapters : (bulletSteps.length ? bulletSteps : (fromTakeaways.length ? fromTakeaways : defaultSteps));
    const playbookSteps = stepSeeds.slice(0, 6).map((item, i) => {
      const action = (item.title || item.action || String(item.detail || item).slice(0, 80)).replace(/^[0-9]+[\.\)]\s*/, '');
      return {
        step: i + 1,
        action: action.slice(0, 90),
        detail: (item.description || item.detail || action).slice(0, 240),
        timestamp: typeof item.timestamp === 'number' ? item.timestamp : 0,
        timestampFormatted: item.timestampFormatted || ''
      };
    });

    const questionComments = (comments || [])
      .map((c) => String(c.text || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.includes('?') && t.length < 160)
      .slice(0, 3);

    const suggestedQuestions = questionComments.length
      ? questionComments
      : (isFr
        ? ['Quelle est la première action maintenant ?', 'Que puis-je ignorer ?', 'Quels exemples concrets sont donnés ?']
        : ['What should I do first now?', 'What can I skip?', 'Which example is worth copying?']);

    const faqs = insightComments.slice(0, 3).map((text, i) => ({
      question: suggestedQuestions[i] || (isFr ? 'Que retenir ?' : 'What should I take from this?'),
      answer: text.slice(0, 280)
    }));

    const mins = Math.max(1, Math.round((video.durationSec || 0) / 60));
    return {
      headline: video.title.slice(0, 90),
      oneLiner: isFr
        ? `Playbook ${mins} min pour extraire des actions de « ${video.channel} ».`
        : `${mins}-min playbook: pull the usable moves from ${video.channel} without watching twice.`,
      whyThisNotClickbait: isFr
        ? 'Les likes et commentaires sont élevés par rapport aux vues. On s’appuie sur la description, les chapitres et le transcript, pas sur un résumé viral.'
        : 'Engagement is high relative to views. This draft is built from the description, chapters, and captions, not a generic recap.',
      audience: this.inferAudience(`${video.title} ${description}`),
      keyTakeaways,
      playbook: playbookSteps,
      skipFluff: this.detectFluffMoments(video, segments, chapters, isFr),
      viewerFeedback: this.commentFeedback(comments, isFr),
      timestamps: usefulChapters.slice(0, 8),
      suggestedQuestions: suggestedQuestions.slice(0, 3),
      faqs
    };
  }

  inferAudience(text) {
    const t = String(text || '').toLowerCase();
    if (/student|exam|homework|class|lecture|learn/.test(t)) return 'students';
    if (/freelance|client|agency|upwork/.test(t)) return 'freelancers';
    if (/startup|founder|saas|solopreneur|entrepreneur/.test(t)) return 'founders';
    return 'mixed';
  }

  isPraiseComment(text) {
    const t = String(text || '').toLowerCase();
    if (this.isScamComment(t) || /missing|didn'?t work|prompt|kanban|instead|scam|tip:/i.test(t)) return false;
    const generic = /great (project|video|job|work)|brilliant|knock my socks|incredibly well|super dynamic|keep em coming|you did great|thanks for (sharing|putting)|love this|subbed|subscribing and binging/i.test(t);
    const shortPraise = /^(wow|nice|love this|well done|amazing|great video|so helpful|god bless|thank you|thanks)[\s!.]*$/i.test(t.trim());
    return shortPraise || (generic && t.length < 180 && !this.isActionableComment(t));
  }

  isActionableComment(text) {
    const t = String(text || '').toLowerCase();
    return /how (do|to|should)|step|tip|template|script|subject line|client|cold email|outreach|rate|hour|first (step|thing|action)|instead|don't|try this|what if|worked|didn't work|warning|caveat|ever thought|missing|scam|prompt/.test(t);
  }

  parseChapters(description) {
    const chapters = [];
    const re = /^[\s>*•\-]*((?:\d{1,2}:)?\d{1,2}:\d{2})\s+[-–—.]?\s*(.+)$/gm;
    let match;
    while ((match = re.exec(description || ''))) {
      const seconds = this.parseClock(match[1]);
      const title = match[2].replace(/\s+/g, ' ').trim().slice(0, 90);
      if (!title) continue;
      chapters.push({
        timestamp: seconds,
        timestampFormatted: this.formatClock(seconds),
        title,
        description: title
      });
    }
    return chapters;
  }

  extractListItems(description) {
    const items = [];
    const re = /^[\s>*]*((?:\d+[\.\)]|[-*•]))\s+(.+)$/gm;
    let match;
    while ((match = re.exec(description || ''))) {
      const text = match[2].replace(/\s+/g, ' ').trim();
      if (text.length >= 12 && text.length <= 240 && !this.parseClock(text.split(' ')[0])) {
        items.push(text);
      }
    }
    return [...new Set(items)].slice(0, 8);
  }

  splitSentences(text) {
    return String(text || '')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.replace(/\s+/g, ' ').trim())
      .filter((s) => s.length >= 40 && s.length <= 220)
      .slice(0, 6);
  }

  parseClock(value) {
    const parts = String(value || '').split(':').map((n) => parseInt(n, 10));
    if (parts.some((n) => Number.isNaN(n))) return 0;
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return 0;
  }

  formatClock(sec) {
    const t = Math.max(0, Math.floor(sec || 0));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = t % 60;
    if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }
}

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)])
    );
  }
  return value;
}

module.exports = new PlaybookService();
