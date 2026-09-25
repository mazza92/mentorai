// In-page YouTube transcript + comments collector (MAIN world).
// Runs with the user's session so caption/comment requests use their IP and cookies.

const CACHE_TTL_MS = 60 * 60 * 1000;
const inflight = new Map();

export async function getCachedVideoData(videoId) {
  const result = await chrome.storage.local.get('lurnia_cache');
  const cache = result.lurnia_cache || {};
  const entry = cache[videoId];
  if (!entry?.videoData) return null;
  if (Date.now() - (entry.cachedAt || 0) > CACHE_TTL_MS) return null;
  return entry.videoData;
}

export async function setCachedVideoData(videoId, videoData) {
  const result = await chrome.storage.local.get('lurnia_cache');
  const cache = result.lurnia_cache || {};
  const ids = Object.keys(cache);
  if (ids.length >= 50) {
    ids.slice(0, ids.length - 49).forEach((id) => delete cache[id]);
  }
  cache[videoId] = {
    ...(cache[videoId] || {}),
    videoData,
    cachedAt: Date.now()
  };
  await chrome.storage.local.set({ lurnia_cache: cache });
}

export async function collectVideoData(tabId, videoId) {
  if (!tabId || !videoId) {
    throw new Error('Missing tabId or videoId');
  }

  const cached = await getCachedVideoData(videoId);
  if (cached?.timedTranscript || cached?.transcript) {
    return cached;
  }

  if (inflight.has(videoId)) {
    return inflight.get(videoId);
  }

  const promise = collectVideoDataInPage(tabId, videoId)
    .then(async (data) => {
      if (data?.timedTranscript || data?.transcript) {
        await setCachedVideoData(videoId, data);
      } else if (data && cached) {
        return {
          ...cached,
          ...data,
          comments: data.comments?.length ? data.comments : cached.comments,
          description: data.description || cached.description
        };
      }
      return data;
    })
    .finally(() => inflight.delete(videoId));

  inflight.set(videoId, promise);
  return promise;
}

async function collectVideoDataInPage(tabId, videoId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: collectInPage,
    args: [videoId]
  });

  if (!results?.[0]?.result) {
    throw new Error('No result from YouTube page collector');
  }

  const out = results[0].result;
  if (out.error && !out.transcript && !(out.comments || []).length) {
    throw new Error(out.error);
  }
  return out;
}

/**
 * Injected into YouTube's MAIN world. Must stay self-contained (no outer closures).
 */
async function collectInPage(videoId) {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const formatTime = (seconds) => {
    const t = Math.max(0, Math.floor(Number(seconds) || 0));
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = String(t % 60).padStart(2, '0');
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${s}`;
    return `${m}:${s}`;
  };

  const formatTimed = (segments) =>
    (segments || [])
      .map((seg) => `[${formatTime(seg.start)}] ${seg.text}`.trim())
      .filter((line) => line.length > 8)
      .join('\n');

  const decodeXml = (text) =>
    String(text || '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, ' ')
      .trim();

  const parseJson3 = (raw) => {
    const segments = [];
    try {
      const data = JSON.parse(raw);
      for (const event of data.events || []) {
        if (!event.segs) continue;
        const text = event.segs.map((seg) => seg.utf8 || '').join('').trim();
        if (!text) continue;
        segments.push({
          text,
          start: (event.tStartMs || 0) / 1000,
          duration: (event.dDurationMs || 0) / 1000
        });
      }
    } catch (_) {}
    return segments;
  };

  const parseXmlCaptions = (raw) => {
    const segments = [];
    const textRe = /<text[^>]*start="([^"]*)"[^>]*(?:dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
    let match;
    while ((match = textRe.exec(raw)) !== null) {
      const text = decodeXml(match[3]);
      if (!text) continue;
      segments.push({
        text,
        start: parseFloat(match[1]) || 0,
        duration: parseFloat(match[2]) || 0
      });
    }
    if (segments.length) return segments;

    const pRe = /<p[^>]*t="([^"]*)"[^>]*(?:d="([^"]*)")?[^>]*>([\s\S]*?)<\/p>/g;
    while ((match = pRe.exec(raw)) !== null) {
      const inner = match[3].replace(/<s[^>]*>/g, '').replace(/<\/s>/g, '');
      const text = decodeXml(inner.replace(/<[^>]+>/g, ' '));
      if (!text) continue;
      segments.push({
        text,
        start: (parseFloat(match[1]) || 0) / 1000,
        duration: (parseFloat(match[2]) || 0) / 1000
      });
    }
    return segments;
  };

  const parseVtt = (raw) => {
    const segments = [];
    const lines = String(raw || '').split(/\r?\n/);
    let currentText = [];
    let currentStart = 0;
    const flush = () => {
      const text = currentText.join(' ').trim();
      if (text) segments.push({ text, start: currentStart, duration: 0 });
      currentText = [];
    };
    for (const line of lines) {
      const l = line.trim();
      if (!l || l === 'WEBVTT' || l.startsWith('NOTE')) {
        if (!l) flush();
        continue;
      }
      if (l.includes('-->')) {
        flush();
        const start = l.split('-->')[0].trim().replace(',', '.');
        const parts = start.split(':').map(Number);
        if (parts.length === 3) currentStart = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) currentStart = parts[0] * 60 + parts[1];
        else currentStart = 0;
        continue;
      }
      if (/^\d+$/.test(l)) continue;
      currentText.push(l.replace(/<[^>]+>/g, ''));
    }
    flush();
    return segments;
  };

  const parseCaptionBody = (raw, format) => {
    if (!raw || raw.length < 8) return [];
    if (format === 'json3' || raw.trim().startsWith('{')) return parseJson3(raw);
    if (format === 'vtt' || raw.includes('WEBVTT')) return parseVtt(raw);
    return parseXmlCaptions(raw);
  };

  const walkFind = (obj, predicate, acc = []) => {
    if (!obj || typeof obj !== 'object') return acc;
    if (predicate(obj)) acc.push(obj);
    const values = Array.isArray(obj) ? obj : Object.values(obj);
    for (const value of values) {
      if (value && typeof value === 'object') walkFind(value, predicate, acc);
    }
    return acc;
  };

  const runsText = (runs) => (runs || []).map((r) => r.text || '').join('');

  const getInnertubeConfig = () => {
    const cfg = window.ytcfg;
    const get = (key) => {
      try {
        if (cfg && typeof cfg.get === 'function') return cfg.get(key);
      } catch (_) {}
      return cfg?.data_?.[key];
    };
    return {
      apiKey: get('INNERTUBE_API_KEY') || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      context: get('INNERTUBE_CONTEXT') || {
        client: {
          clientName: 'WEB',
          clientVersion: get('INNERTUBE_CLIENT_VERSION') || '2.20240101.00.00',
          hl: document.documentElement.lang || 'en',
          gl: 'US'
        }
      },
      clientVersion: get('INNERTUBE_CLIENT_VERSION') || '2.20240101.00.00'
    };
  };

  const innertube = async (endpoint, payload, clientOverride) => {
    const { apiKey, context, clientVersion } = getInnertubeConfig();
    const bodyContext = clientOverride
      ? { ...context, client: { ...context.client, ...clientOverride } }
      : context;
    const clientName = bodyContext.client?.clientName || 'WEB';
    const clientNameId = {
      WEB: '1',
      MWEB: '2',
      ANDROID: '3',
      IOS: '5',
      TVHTML5: '7',
      WEB_EMBEDDED_PLAYER: '56'
    }[clientName] || '1';

    const res = await fetch(
      `https://www.youtube.com/youtubei/v1/${endpoint}?key=${apiKey}&prettyPrint=false`,
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-YouTube-Client-Name': clientNameId,
          'X-YouTube-Client-Version': bodyContext.client?.clientVersion || clientVersion
        },
        body: JSON.stringify({ context: bodyContext, ...payload })
      }
    );
    if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
    return res.json();
  };

  const getPlayerResponse = () => {
    try {
      if (window.ytInitialPlayerResponse?.captions || window.ytInitialPlayerResponse?.videoDetails) {
        return window.ytInitialPlayerResponse;
      }
    } catch (_) {}
    try {
      const raw = window.ytplayer?.config?.args?.player_response;
      if (raw) return typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (_) {}
    try {
      const player = document.getElementById('movie_player');
      if (player && typeof player.getPlayerResponse === 'function') {
        return player.getPlayerResponse();
      }
    } catch (_) {}
    return null;
  };

  const collectCaptionUrls = (playerResponse) => {
    const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
    const candidates = [];
    const seen = new Set();

    const push = (url, lang, kind) => {
      if (!url || seen.has(url)) return;
      seen.add(url);
      candidates.push({ url, lang: lang || 'en', kind: kind || '' });
    };

    const pageLang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
    const ranked = [...tracks].sort((a, b) => {
      const score = (t) => {
        const lang = (t.languageCode || '').slice(0, 2).toLowerCase();
        let n = 0;
        if (t.kind !== 'asr') n += 4;
        if (lang === pageLang) n += 3;
        if (lang === 'en') n += 2;
        return n;
      };
      return score(b) - score(a);
    });

    for (const track of ranked) {
      if (track.baseUrl) push(track.baseUrl, track.languageCode, track.kind);
    }
    return candidates;
  };

  const listTimedTextTracks = async () => {
    try {
      const res = await fetch(`https://www.youtube.com/api/timedtext?type=list&v=${videoId}`, {
        credentials: 'include'
      });
      if (!res.ok) return [];
      const xml = await res.text();
      const tracks = [];
      const re = /<track\b([^>]*)\/?>/gi;
      let match;
      while ((match = re.exec(xml))) {
        const attrs = match[1];
        const get = (name) => {
          const found = attrs.match(new RegExp(`${name}="([^"]*)"`, 'i'));
          return found ? found[1] : '';
        };
        tracks.push({
          lang: get('lang_code'),
          kind: get('kind'),
          name: get('name'),
          isDefault: get('lang_default') === 'true'
        });
      }
      const pageLang = (document.documentElement.lang || 'en').slice(0, 2).toLowerCase();
      tracks.sort((a, b) => {
        const score = (t) => {
          let n = 0;
          if (t.isDefault) n += 5;
          if (t.kind !== 'asr') n += 4;
          if ((t.lang || '').slice(0, 2) === pageLang) n += 3;
          if ((t.lang || '').slice(0, 2) === 'en') n += 2;
          return n;
        };
        return score(b) - score(a);
      });
      return tracks.map((t) => {
        const url = new URL('https://www.youtube.com/api/timedtext');
        url.searchParams.set('v', videoId);
        url.searchParams.set('lang', t.lang || 'en');
        if (t.kind) url.searchParams.set('kind', t.kind);
        if (t.name) url.searchParams.set('name', t.name);
        return { url: url.toString(), lang: t.lang || 'en', kind: t.kind || '' };
      });
    } catch (_) {
      return [];
    }
  };

  const fetchCaptionUrl = async (url, format) => {
    let finalUrl = url;
    if (format) {
      try {
        const parsed = new URL(url, 'https://www.youtube.com');
        parsed.searchParams.set('fmt', format);
        finalUrl = parsed.toString();
      } catch (_) {
        finalUrl = url + (url.includes('?') ? '&' : '?') + `fmt=${format}`;
      }
    }
    const res = await fetch(finalUrl, { credentials: 'include' });
    if (!res.ok) throw new Error(`caption ${res.status}`);
    return res.text();
  };

  const tryCaptionCandidates = async (candidates) => {
    const formats = ['json3', 'srv3', 'vtt', 'xml', ''];
    for (const candidate of candidates) {
      for (const format of formats) {
        try {
          const raw = await fetchCaptionUrl(candidate.url, format || null);
          const segments = parseCaptionBody(raw, format);
          if (segments.length > 0) {
            return { segments, language: candidate.lang, source: 'timedtext' };
          }
        } catch (_) {}
      }
    }
    return null;
  };

  const extractTranscriptSegments = (data) => {
    const nodes = walkFind(data, (n) => n.transcriptSegmentRenderer);
    return nodes.map((n) => {
      const r = n.transcriptSegmentRenderer;
      const text = runsText(r.snippet?.runs) || r.snippet?.simpleText || '';
      return {
        text: text.trim(),
        start: (parseInt(r.startMs || r.startTimeMs || 0, 10) || 0) / 1000,
        duration: (parseInt(r.durationMs || 0, 10) || 0) / 1000
      };
    }).filter((s) => s.text);
  };

  const extractComments = (data, max = 40) => {
    const nodes = walkFind(data, (n) => n.commentThreadRenderer || n.commentRenderer);
    const comments = [];
    const seen = new Set();
    for (const node of nodes) {
      const r = node.commentThreadRenderer?.comment?.commentRenderer || node.commentRenderer;
      if (!r) continue;
      const text = runsText(r.contentText?.runs) || r.contentText?.simpleText || '';
      if (!text.trim()) continue;
      const key = text.slice(0, 80);
      if (seen.has(key)) continue;
      seen.add(key);
      comments.push({
        author: r.authorText?.simpleText || 'Viewer',
        text: text.trim(),
        likes: r.voteCount?.simpleText || r.likeCount || 0,
        published: runsText(r.publishedTimeText?.runs) || ''
      });
      if (comments.length >= max) break;
    }
    return comments;
  };

  const findTranscriptParams = (data) => {
    const nodes = walkFind(data, (n) => n.getTranscriptEndpoint?.params);
    if (nodes[0]?.getTranscriptEndpoint?.params) return nodes[0].getTranscriptEndpoint.params;

    const panels = walkFind(data, (n) => {
      const id = n.engagementPanelSectionListRenderer?.panelIdentifier || n.identifier || '';
      return typeof id === 'string' && id.toLowerCase().includes('transcript');
    });
    for (const panel of panels) {
      const nested = walkFind(panel, (n) => n.getTranscriptEndpoint?.params || n.continuationCommand?.token);
      const params = nested[0]?.getTranscriptEndpoint?.params;
      if (params) return params;
    }
    return null;
  };

  const findCommentsContinuation = (data) => {
    const sections = walkFind(data, (n) => {
      const id = n.itemSectionRenderer?.sectionIdentifier || '';
      return typeof id === 'string' && id.toLowerCase().includes('comment');
    });
    for (const section of sections) {
      const tokens = walkFind(section, (n) => n.continuationCommand?.token || n.nextContinuationData?.continuation);
      const token = tokens[0]?.continuationCommand?.token || tokens[0]?.nextContinuationData?.continuation;
      if (token) return token;
    }
    const fallback = walkFind(data, (n) => n.continuationEndpoint?.continuationCommand?.token);
    for (const node of fallback) {
      const token = node.continuationEndpoint?.continuationCommand?.token;
      if (!token) continue;
      const hint = node.continuationEndpoint?.commandMetadata?.webCommandMetadata?.apiUrl || '';
      if (String(hint).includes('comment') || String(hint).includes('next')) {
        return token;
      }
    }
    return null;
  };

  const scrapePanel = async () => {
    const parseTs = (raw) => {
      if (!raw) return 0;
      const clean = raw.trim().replace(',', '.');
      const p = clean.split(':').map(Number);
      if (p.some(Number.isNaN)) return 0;
      if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
      if (p.length === 2) return p[0] * 60 + p[1];
      return p[0] || 0;
    };
    const collect = () => {
      const rows = Array.from(document.querySelectorAll(
        'ytd-transcript-segment-renderer, [class*="transcript-segment"]'
      ));
      const segments = [];
      for (const row of rows) {
        const t = row.querySelector('#segment-text, .segment-text, yt-formatted-string, [class*="segment-text"]')?.textContent?.trim() || '';
        const ts = row.querySelector('#segment-timestamp, .segment-timestamp, [class*="timestamp"]')?.textContent?.trim() || '';
        if (t) segments.push({ text: t, start: parseTs(ts), duration: 0 });
      }
      return segments;
    };

    let segments = collect();
    if (segments.length) return segments;

    const clickables = Array.from(document.querySelectorAll('button, a, yt-button-shape button, ytd-button-renderer, tp-yt-paper-item, ytd-menu-service-item-renderer'));
    const labels = ['transcript', 'transcription', 'transcripción', 'transcrição', 'transkript', '字幕', 'транскрип'];
    const match = clickables.find((el) => {
      const txt = `${el.getAttribute('aria-label') || ''} ${el.textContent || ''}`.toLowerCase();
      return labels.some((l) => txt.includes(l));
    });
    if (match) {
      match.click();
      await sleep(1600);
      segments = collect();
      if (segments.length) return segments;
    }

    const moreSelectors = [
      'button[aria-label*="More actions" i]',
      'button[aria-label*="Plus d\'actions" i]',
      'button[aria-label*="Más acciones" i]',
      '#top-level-buttons-computed ytd-menu-renderer button',
      'ytd-menu-renderer yt-icon-button button'
    ];
    for (const sel of moreSelectors) {
      const more = document.querySelector(sel);
      if (!more) continue;
      more.click();
      await sleep(450);
      const items = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item, yt-list-item-view-model'));
      const item = items.find((el) => {
        const txt = (el.textContent || '').toLowerCase();
        return labels.some((l) => txt.includes(l));
      });
      if (item) {
        item.click();
        await sleep(1600);
        segments = collect();
        if (segments.length) return segments;
      } else {
        document.body.click();
      }
    }
    return [];
  };

  const result = {
    videoId,
    title: '',
    channel: '',
    description: '',
    language: 'en',
    transcript: '',
    timedTranscript: '',
    segments: [],
    comments: [],
    source: '',
    captionsDisabled: false,
    commentsDisabled: false,
    error: null
  };

  try {
    let player = getPlayerResponse();
    result.title = player?.videoDetails?.title || document.title.replace(/ - YouTube$/, '');
    result.channel = player?.videoDetails?.author || '';
    result.description = player?.videoDetails?.shortDescription || '';

    let captionHit = await tryCaptionCandidates(collectCaptionUrls(player));

    if (!captionHit) {
      try {
        const params = findTranscriptParams(window.ytInitialData);
        if (params) {
          const transcriptData = await innertube('get_transcript', { params });
          const segments = extractTranscriptSegments(transcriptData);
          if (segments.length) {
            captionHit = { segments, language: 'auto', source: 'get_transcript' };
          }
        }
      } catch (_) {}
    }

    const playerClients = [
      null,
      { clientName: 'IOS', clientVersion: '19.45.4', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iOS', osVersion: '18.1', hl: 'en' },
      { clientName: 'ANDROID', clientVersion: '20.10.38', androidSdkVersion: 35, hl: 'en' },
      { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20240101.00.00', hl: 'en' },
      { clientName: 'TVHTML5', clientVersion: '7.20240101.00.00', hl: 'en' },
      { clientName: 'MWEB', clientVersion: '2.20240101.00.00', hl: 'en' }
    ];

    if (!captionHit) {
      for (const client of playerClients) {
        try {
          const data = await innertube('player', {
            videoId,
            contentCheckOk: true,
            racyCheckOk: true
          }, client);
          if (!result.description && data.videoDetails?.shortDescription) {
            result.description = data.videoDetails.shortDescription;
          }
          if (!result.title && data.videoDetails?.title) result.title = data.videoDetails.title;
          if (!result.channel && data.videoDetails?.author) result.channel = data.videoDetails.author;
          captionHit = await tryCaptionCandidates(collectCaptionUrls(data));
          if (captionHit) break;
        } catch (_) {}
      }
    }

    if (!captionHit) {
      captionHit = await tryCaptionCandidates(await listTimedTextTracks());
    }

    let nextData = null;
    try {
      nextData = await innertube('next', { videoId });
    } catch (_) {}

    if (!captionHit && nextData) {
      const params = findTranscriptParams(nextData);
      if (params) {
        try {
          const transcriptData = await innertube('get_transcript', { params });
          const segments = extractTranscriptSegments(transcriptData);
          if (segments.length) {
            captionHit = { segments, language: 'auto', source: 'get_transcript' };
          }
        } catch (_) {}
      }
    }

    if (!captionHit) {
      try {
        const panelSegments = await scrapePanel();
        if (panelSegments.length) {
          captionHit = { segments: panelSegments, language: 'auto', source: 'panel' };
        }
      } catch (_) {}
    }

    if (captionHit?.segments?.length) {
      result.segments = captionHit.segments;
      result.language = captionHit.language || 'en';
      result.source = captionHit.source;
      result.timedTranscript = formatTimed(captionHit.segments);
      result.transcript = result.timedTranscript;
    } else {
      result.captionsDisabled = true;
    }

    if (nextData) {
      result.comments = extractComments(nextData, 40);
      let token = findCommentsContinuation(nextData);
      let pages = 0;
      while (token && result.comments.length < 40 && pages < 3) {
        pages += 1;
        try {
          const more = await innertube('next', { continuation: token });
          result.comments = result.comments.concat(extractComments(more, 40 - result.comments.length));
          token = findCommentsContinuation(more);
        } catch (_) {
          break;
        }
      }
      if (!result.description) {
        const descNodes = walkFind(nextData, (n) => n.attributedDescription || n.description?.simpleText || n.description?.runs);
        const desc = descNodes[0];
        result.description =
          desc?.attributedDescription?.content ||
          desc?.description?.simpleText ||
          runsText(desc?.description?.runs) ||
          result.description;
      }
    }

    if (!result.comments.length) {
      result.commentsDisabled = !nextData;
    }

    if (!result.transcript && !result.comments.length && !result.description) {
      result.error = 'No captions, comments, or description available for this video';
    }
  } catch (e) {
    result.error = (e && e.message) || 'Collector failed';
  }

  return result;
}
