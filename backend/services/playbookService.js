const valueSearchService = require('./valueSearchService');
const youtubeInnertubeService = require('./youtubeInnertubeService');
const { getFirestore } = require('../config/firestore');
const { generateText } = require('./llmClient');

const SCHEMA = 'v3';

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
    this.memory.set(cacheKey, payload);
    this.persist(cacheKey, payload);
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
      valueSearchService.fetchTopComments(videoId, 24).catch(() => []),
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
      playbook = this.buildFromSources(video, transcriptText, comments, lang);
      aiGenerated = false;
    }

    console.log(`[Playbook] Ready for ${videoId} in ${((Date.now() - started) / 1000).toFixed(1)}s (captions: ${!!transcriptText})`);
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
        new Promise((resolve) => setTimeout(() => resolve({ success: false, timedOut: true }), 8000))
      ]);
      if (transcript?.timedOut) {
        console.warn(`[Playbook] Caption fetch timed out for ${videoId}`);
      }
      if (transcript?.success) {
        const text = String(transcript.text || transcript.transcript?.text || '').trim();
        if (text) {
          return {
            success: true,
            text,
            segments: transcript.segments || transcript.transcript?.segments || [],
            source: transcript.source || transcript.strategy || null
          };
        }
      }
    } catch (err) {
      console.warn('[Playbook] Transcript fetch failed:', err.message);
    }
    return { success: false, text: '', source: null };
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
      .map((c, i) => `${i + 1}. @${c.author}: ${String(c.text || '').replace(/\s+/g, ' ').trim().slice(0, 240)}`)
      .join('\n');

    const prompt = `You are a senior YouTube editor writing a Lurnia playbook.
Write in ${isFr ? 'French' : 'English'}. Never use an em dash. Return ONLY valid JSON.

Job:
- keyTakeaways: 4-6 lessons from the VIDEO (transcript, chapters, description). Never from comments. Title is the lesson. Detail is how to apply it now.
- playbook: 4-6 ordered actions the viewer can run today. Timestamp if captions or chapters exist.
- skipFluff: specific filler moments (intro hook, sponsor, ad, affiliate pitch, subscribe ask, recap padding). Each needs a clock time if known, a kind, and a one-line recap of what happens so the viewer can skip without missing a tactic.
- viewerFeedback: 3-5 comments that teach something: a caveat, a result, a disagreement, or an honest testimony. Never empty praise.
- timestamps: 3-6 high-value moments to jump to. Not fluff.

Do not invent timestamps. If there are no captions or chapters, use timestamp 0 and timestampFormatted "".

VIDEO: ${video.title} | ${video.channel} | ${Math.round((video.durationSec || 0) / 60)} min
Views ${video.views} | Likes ${video.likes} | Comments ${video.comments}

CHAPTERS:
${chapterBlock || '[None]'}

TRANSCRIPT:
${transcript || '[No captions. Use description and chapters only for takeaways. Do not invent timestamps.]'}

DESCRIPTION:
${(video.description || '').slice(0, 1800)}

COMMENTS (for viewerFeedback only, never for keyTakeaways):
${commentBlock || '[None]'}

JSON:
{
  "headline": "max 90 chars",
  "oneLiner": "who + outcome, max 160 chars",
  "whyThisNotClickbait": "2 sentences",
  "audience": "freelancers | founders | students | mixed",
  "keyTakeaways": [{ "title": "lesson", "detail": "how to use it now" }],
  "playbook": [{ "step": 1, "action": "imperative", "detail": "how now", "timestamp": 0, "timestampFormatted": "0:00" }],
  "skipFluff": [{ "kind": "sponsor", "timestamp": 0, "timestampFormatted": "M:SS", "title": "what to skip", "recap": "what happens in that moment" }],
  "viewerFeedback": [{ "author": "name", "quote": "short", "insight": "why it matters" }],
  "timestamps": [{ "timestamp": 0, "timestampFormatted": "M:SS", "title": "moment", "description": "why jump here" }],
  "suggestedQuestions": ["question"],
  "faqs": [{ "question": "...", "answer": "..." }]
}`;

    const text = await generateText(prompt, {
      json: true,
      temperature: 0.25,
      maxOutputTokens: 4096,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    });
    return this.normalizePlaybook(this.parseJson(text), video, comments, lang);
  }

  parseJson(text) {
    let jsonText = String(text || '');
    const fenced = jsonText.match(/```json\s*([\s\S]*?)\s*```/) || jsonText.match(/```\s*([\s\S]*?)\s*```/);
    if (fenced) jsonText = fenced[1];
    const start = jsonText.indexOf('{');
    const end = jsonText.lastIndexOf('}');
    if (start >= 0 && end > start) jsonText = jsonText.slice(start, end + 1);
    return JSON.parse(jsonText);
  }

  normalizePlaybook(raw, video, comments, lang) {
    const isFr = lang === 'fr';
    const skipFluff = (raw.skipFluff || []).map((item) => {
      if (typeof item === 'string') {
        return { kind: 'padding', timestamp: 0, timestampFormatted: '', title: item, recap: item };
      }
      return {
        kind: item.kind || 'padding',
        timestamp: Number(item.timestamp) || 0,
        timestampFormatted: item.timestampFormatted || (item.timestamp ? this.formatClock(item.timestamp) : ''),
        title: String(item.title || item.recap || '').slice(0, 120),
        recap: String(item.recap || item.title || '').slice(0, 280)
      };
    }).filter((item) => item.title || item.recap);

    const viewerFeedback = (raw.viewerFeedback || []).map((item) => ({
      author: String(item.author || 'Viewer').replace(/^@/, '').slice(0, 40),
      quote: String(item.quote || item.text || '').replace(/\s+/g, ' ').trim().slice(0, 280),
      insight: String(item.insight || '').replace(/\s+/g, ' ').trim().slice(0, 220)
    })).filter((item) => item.quote.length >= 24 && !this.isPraiseComment(item.quote));

    const keyTakeaways = (raw.keyTakeaways || [])
      .map((item) => ({
        title: String(item.title || '').replace(/\s+/g, ' ').trim().slice(0, 90),
        detail: String(item.detail || '').replace(/\s+/g, ' ').trim().slice(0, 360)
      }))
      .filter((item) => item.title && item.detail && item.detail !== item.title && !item.detail.startsWith(item.title));

    return {
      ...raw,
      headline: String(raw.headline || video.title).slice(0, 90),
      keyTakeaways: keyTakeaways.length ? keyTakeaways : this.contentTakeaways(video, isFr),
      skipFluff,
      viewerFeedback: viewerFeedback.length ? viewerFeedback : this.commentFeedback(comments, isFr)
    };
  }

  contentTakeaways(video, isFr) {
    const bullets = this.extractListItems(video.description || '');
    const chapters = this.parseChapters(video.description || '').filter((c) => !this.isFluffChapter(c.title));
    const seeds = bullets.length ? bullets : chapters.map((c) => c.title);
    const rows = seeds.slice(0, 5).map((text) => ({
      title: String(text).split(/[.!?:]/)[0].slice(0, 72),
      detail: String(text).slice(0, 280)
    }));
    if (rows.length) return rows;
    return [{
      title: isFr ? 'Utilisez les chapitres, pas le hook' : 'Use the chapters, not the hook',
      detail: isFr
        ? 'Sautez l’intro. Notez les étapes concrètes dans la description, puis faites la plus petite version aujourd’hui.'
        : 'Skip the intro. Copy the concrete steps from the description, then run the smallest version today.'
    }];
  }

  commentFeedback(comments, isFr) {
    return (comments || [])
      .map((c) => {
        const quote = String(c.text || '').replace(/\s+/g, ' ').trim();
        return {
          author: String(c.author || 'Viewer').replace(/^@/, ''),
          quote,
          insight: this.isActionableComment(quote)
            ? (isFr ? 'Un viewer pointe une application concrète.' : 'A viewer names a concrete application.')
            : (isFr ? 'Retour d’usage, pas un like.' : 'Usage note, not a like.')
        };
      })
      .filter((item) => item.quote.length >= 40 && item.quote.length <= 320 && !this.isPraiseComment(item.quote) && !/https?:\/\//i.test(item.quote))
      .slice(0, 5);
  }

  isFluffChapter(title) {
    return /intro|outro|sponsor|subscribe|thanks|ad break|self[-\s]?promo/i.test(title || '');
  }

  buildFromSources(video, transcriptText, comments, lang) {
    const isFr = lang === 'fr';
    const description = video.description || '';
    const chapters = this.parseChapters(description);
    const bullets = this.extractListItems(description);
    const insightComments = (comments || [])
      .map((c) => String(c.text || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 40 && t.length <= 420 && !/https?:\/\//i.test(t))
      .filter((t) => this.isActionableComment(t));

    const keyTakeaways = this.contentTakeaways(video, isFr);
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
    const stepSeeds = usefulChapters.length ? usefulChapters : (bulletSteps.length ? bulletSteps : defaultSteps);
    const playbookSteps = (stepSeeds.length ? stepSeeds : keyTakeaways).slice(0, 6).map((item, i) => {
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

    const fluffChapters = chapters.filter((c) => this.isFluffChapter(c.title));
    const mins = Math.max(1, Math.round((video.durationSec || 0) / 60));
    return {
      headline: video.title.slice(0, 90),
      oneLiner: isFr
        ? `Playbook ${mins} min pour extraire des actions de « ${video.channel} ».`
        : `${mins}-min playbook: pull the usable moves from ${video.channel} without watching twice.`,
      whyThisNotClickbait: isFr
        ? 'Les likes et commentaires sont élevés par rapport aux vues. On s’appuie sur la description et les chapitres, pas sur un résumé viral.'
        : 'Engagement is high relative to views. This draft is built from the description and chapters, not a generic recap.',
      audience: this.inferAudience(`${video.title} ${description}`),
      keyTakeaways,
      playbook: playbookSteps,
      skipFluff: fluffChapters.length
        ? fluffChapters.slice(0, 4).map((c) => ({
            kind: /sponsor|ad/i.test(c.title) ? 'sponsor' : /intro/i.test(c.title) ? 'intro' : /outro/i.test(c.title) ? 'outro' : 'padding',
            timestamp: c.timestamp,
            timestampFormatted: c.timestampFormatted,
            title: c.title,
            recap: isFr
              ? `Passage « ${c.title} ». Pas de tactique ici, vous pouvez sauter.`
              : `This beat is “${c.title}”. No tactic here. Skip it.`
          }))
        : [
            {
              kind: 'intro',
              timestamp: 0,
              timestampFormatted: '0:00',
              title: isFr ? 'Intro motivation' : 'Motivational intro',
              recap: isFr ? 'Hook et story. La méthode commence après.' : 'Hook and story. The method starts after this.'
            }
          ],
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
    return /^(wow|nice|love this|well done|amazing|great video|so helpful|god bless|thank you|thanks)[\s!.]*$/i.test(t.trim())
      || (/love this|well done|god bless|amazing|grateful|best youtube|thank you|great video|so helpful/.test(t) && !this.isActionableComment(t));
  }

  isActionableComment(text) {
    const t = String(text || '').toLowerCase();
    return /how (do|to|should)|step|tip|template|script|subject line|client|cold email|outreach|rate|hour|first |instead|don't|try this|what if|worked|didn't work|warning|caveat/.test(t);
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
