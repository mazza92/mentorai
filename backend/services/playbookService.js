const valueSearchService = require('./valueSearchService');
const youtubeInnertubeService = require('./youtubeInnertubeService');
const { getFirestore } = require('../config/firestore');
const { generateText } = require('./llmClient');

class PlaybookService {
  constructor() {
    this.memory = new Map();
    this.inflight = new Map();
  }

  async getOrGenerate(videoId, { language = 'en' } = {}) {
    const lang = language === 'fr' ? 'fr' : 'en';
    const cacheKey = `${videoId}_${lang}`;

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
      valueSearchService.fetchTopComments(videoId, 12).catch(() => []),
      this.fetchCaptionsFast(videoId)
    ]);

    const transcriptText = transcript?.text || '';
    const transcriptSource = transcript?.source || null;
    if (!transcriptText && !comments.length && !video.description) {
      const err = new Error('Not enough source material to build a playbook');
      err.code = 'NO_SOURCE';
      throw err;
    }

    let playbook;
    let aiGenerated = true;
    try {
      playbook = await this.generateContent(video, transcriptText, comments, lang);
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
        new Promise((resolve) => setTimeout(() => resolve({ success: false, timedOut: true }), 6000))
      ]);
      if (transcript?.timedOut) {
        console.warn(`[Playbook] Caption fetch timed out for ${videoId}`);
      }
      if (transcript?.success && transcript.text) return transcript;
    } catch (err) {
      console.warn('[Playbook] Transcript fetch failed:', err.message);
    }
    return { success: false, text: '', source: null };
  }

  async generateContent(video, transcriptText, comments, lang) {
    const isFr = lang === 'fr';
    const transcript = (transcriptText || '').slice(0, 6000);
    const commentBlock = comments
      .slice(0, 8)
      .map((c, i) => `${i + 1}. @${c.author}: ${String(c.text || '').slice(0, 280)}`)
      .join('\n');

    const prompt = `Extract actionable value from this YouTube video. Ignore hype and sponsors.
Write in ${isFr ? 'French' : 'English'}. Never use an em dash. Actions must be runnable now.
Return ONLY valid JSON.

VIDEO: ${video.title} | ${video.channel} | ${Math.round((video.durationSec || 0) / 60)} min
Views ${video.views} | Likes ${video.likes} | Comments ${video.comments}

TRANSCRIPT (may be empty):
${transcript || '[No captions. Use description and comments only. Do not invent timestamps.]'}

DESCRIPTION:
${(video.description || '').slice(0, 1500)}

TOP COMMENTS:
${commentBlock || '[None]'}

JSON:
{
  "headline": "max 90 chars",
  "oneLiner": "who + outcome, max 160 chars",
  "whyThisNotClickbait": "2 sentences",
  "audience": "freelancers | founders | students | mixed",
  "keyTakeaways": [{ "title": "short", "detail": "specific" }],
  "playbook": [{ "step": 1, "action": "imperative", "detail": "how now", "timestamp": 0, "timestampFormatted": "0:00" }],
  "skipFluff": ["item"],
  "timestamps": [{ "timestamp": 0, "timestampFormatted": "M:SS", "title": "moment", "description": "why" }],
  "suggestedQuestions": ["question"],
  "faqs": [{ "question": "...", "answer": "..." }]
}

Rules: 4 takeaways, 4 playbook steps, 3 timestamps if captions else [], 2 skipFluff, 3 questions, 3 faqs. Concrete only.`;

    const text = await generateText(prompt, {
      json: true,
      temperature: 0.3,
      maxOutputTokens: 1800,
      model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
    });
    return this.parseJson(text);
  }

  parseJson(text) {
    let jsonText = text;
    const fenced = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (fenced) jsonText = fenced[1];
    const objectMatch = jsonText.match(/\{[\s\S]*\}/);
    if (objectMatch) jsonText = objectMatch[0];
    return JSON.parse(jsonText);
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

    const fallbackComments = (comments || [])
      .map((c) => String(c.text || '').replace(/\s+/g, ' ').trim())
      .filter((t) => t.length >= 50 && !this.isPraiseComment(t) && !/https?:\/\//i.test(t));

    const takeawaySeeds = [
      ...bullets.slice(0, 5),
      ...this.splitSentences(description).slice(0, 4),
      ...insightComments.slice(0, 3),
      ...fallbackComments.slice(0, 2)
    ].filter((t, i, arr) => t && arr.indexOf(t) === i).slice(0, 6);

    const keyTakeaways = (takeawaySeeds.length ? takeawaySeeds : this.splitSentences(description).slice(0, 4))
      .map((text) => {
        const title = text.split(/[.!?:]/)[0].slice(0, 72) || video.title.slice(0, 72);
        return { title, detail: text.slice(0, 280) };
      });

    while (keyTakeaways.length < 3) {
      keyTakeaways.push({
        title: isFr ? 'Regardez le moment clé' : 'Watch for the specific tactic',
        detail: isFr
          ? 'Les chapitres et commentaires ci-dessous pointent vers les parties concrètes, pas le storytelling.'
          : 'Use the chapters and comments below to jump to the concrete parts instead of the story.'
      });
    }

    const usefulChapters = chapters.filter((c) => !/intro|outro|sponsor|subscribe|thanks/i.test(c.title));
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

    const mins = Math.max(1, Math.round((video.durationSec || 0) / 60));
    return {
      headline: video.title.slice(0, 90),
      oneLiner: isFr
        ? `Playbook ${mins} min pour extraire des actions de « ${video.channel} ».`
        : `${mins}-min playbook: pull the usable moves from ${video.channel} without watching twice.`,
      whyThisNotClickbait: isFr
        ? `Les likes et commentaires sont élevés par rapport aux vues. On s’appuie sur la description, les chapitres et les retours viewers plutôt que sur un résumé viral.`
        : `Engagement is high relative to views. This draft is built from the description, chapters, and viewer comments, not a generic recap.`,
      audience: this.inferAudience(`${video.title} ${description}`),
      keyTakeaways,
      playbook: playbookSteps,
      skipFluff: [
        isFr ? 'Ignorez l’intro motivation et les appels à s’abonner.' : 'Skip the motivational intro and subscribe asks.',
        isFr ? 'Ignorez les passages sponsor / outils affiliés.' : 'Skip sponsor reads and affiliate tool pitches.',
        ...chapters.filter((c) => /intro|sponsor|outro/i.test(c.title)).map((c) =>
          (isFr
            ? `Vous pouvez passer « ${c.title} » (${c.timestampFormatted}).`
            : `You can skip “${c.title}” (${c.timestampFormatted}).`))
      ].slice(0, 4),
      timestamps: chapters.slice(0, 8),
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
    return /love this|well done|god bless|may god|amazing|grateful|best youtube|thank you|thanks sis|great video|so helpful/.test(t)
      && !this.isActionableComment(t);
  }

  isActionableComment(text) {
    const t = String(text || '').toLowerCase();
    return /how (do|to|should)|step|tip|template|script|subject line|client|cold email|outreach|rate|hour|first |instead|don't|try this|what if/.test(t);
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
