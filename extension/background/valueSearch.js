/**
 * Value search: find relevant YouTube videos, then rank by genuine engagement
 * (comments + likes relative to views, long-form depth, hidden gems)
 * instead of raw view count.
 *
 * YouTube does not publish save or share counts. Comments and likes are the
 * strongest public proxies for "people valued this enough to react."
 */

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const WEB_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
    gl: 'US'
  }
};

export async function searchValueVideos(query, options = {}) {
  const includeShorts = options.includeShorts === true;
  const limit = options.limit || 12;
  const tabId = options.tabId;

  const raw = await fetchSearchVideos(query, tabId);
  const unique = dedupeVideos(raw).slice(0, 28);
  const hydrated = await mapPool(unique, 5, hydrateVideoStats);
  const usable = hydrated.filter((v) => v.videoId && (v.views > 0 || v.title));
  const ranked = scoreVideos(usable, { includeShorts });
  return ranked.slice(0, limit);
}

export function scoreVideos(videos, { includeShorts = false } = {}) {
  const pool = videos.filter((v) => {
    if (!v.videoId) return false;
    if (!includeShorts && v.durationSec > 0 && v.durationSec < 90) return false;
    return true;
  });

  if (!pool.length) return [];

  const commentRates = pool.map((v) => rate(v.comments, v.views));
  const likeRates = pool.map((v) => rate(v.likes, v.views));
  const commentLogs = pool.map((v) => Math.log10((v.comments || 0) + 1));

  return pool
    .map((v) => {
      const commentRate = rate(v.comments, v.views);
      const likeRate = rate(v.likes, v.views);
      const discussionPct = percentile(commentRates, commentRate);
      const likePct = percentile(likeRates, likeRate);
      const commentVolumePct = percentile(commentLogs, Math.log10((v.comments || 0) + 1));
      const depth = depthScore(v.durationSec);
      const gem = hiddenGemScore(v.views, commentRate, likeRate);

      const valueScore = Math.round(
        100 * (
          0.34 * discussionPct +
          0.24 * likePct +
          0.18 * commentVolumePct +
          0.12 * depth +
          0.12 * gem
        )
      );

      return {
        ...v,
        commentRate,
        likeRate,
        valueScore: Math.min(99, Math.max(1, valueScore)),
        reasons: buildReasons({ discussionPct, likePct, depth, gem, commentRate, likeRate, comments: v.comments, views: v.views })
      };
    })
    .sort((a, b) => b.valueScore - a.valueScore);
}

function rate(part, whole) {
  const views = Math.max(Number(whole) || 0, 1);
  return (Number(part) || 0) / views;
}

function percentile(values, value) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 0;
  for (const item of sorted) {
    if (item <= value) count += 1;
  }
  return (count - 1) / Math.max(sorted.length - 1, 1);
}

function depthScore(durationSec) {
  const d = Number(durationSec) || 0;
  if (d <= 0) return 0.45;
  if (d < 90) return 0.05;
  if (d >= 8 * 60 && d <= 45 * 60) return 1;
  if (d >= 5 * 60) return 0.75;
  if (d >= 3 * 60) return 0.5;
  return 0.25;
}

function hiddenGemScore(views, commentRate, likeRate) {
  const v = Number(views) || 0;
  if (v < 250000 && commentRate >= 0.002 && likeRate >= 0.02) return 1;
  if (v < 100000 && commentRate >= 0.0015) return 0.8;
  if (v < 500000 && commentRate >= 0.003) return 0.65;
  return 0.2;
}

function buildReasons({ discussionPct, likePct, depth, gem, commentRate, likeRate, comments, views }) {
  const reasons = [];
  if (discussionPct >= 0.72) reasons.push('High discussion');
  else if (commentRate >= 0.002) reasons.push('Strong comments');
  if (likePct >= 0.72) reasons.push('High like rate');
  if (gem >= 0.8) reasons.push('Hidden gem');
  else if (gem >= 0.65) reasons.push('Underrated');
  if (depth >= 0.75) reasons.push('Long-form');
  if (views >= 1000000 && discussionPct < 0.4 && likePct < 0.4) {
    reasons.push('Popular, lower engagement');
  }
  if (!reasons.length && comments > 0) reasons.push('Relevant match');
  return reasons.slice(0, 3);
}

async function fetchSearchVideos(query, tabId) {
  try {
    const first = await innertube('search', { query });
    const videos = extractSearchVideos(first);
    const token = findContinuation(first);
    if (token && videos.length < 24) {
      try {
        const more = await innertube('search', { continuation: token });
        videos.push(...extractSearchVideos(more));
      } catch (_) {}
    }
    if (videos.length) return videos;
  } catch (err) {
    console.warn('[ValueSearch] Direct innertube search failed:', err.message);
  }

  if (tabId) {
    return searchFromYouTubeTab(tabId, query);
  }

  const tabs = await chrome.tabs.query({ url: ['https://www.youtube.com/*', 'https://youtube.com/*'] });
  if (tabs[0]?.id) {
    return searchFromYouTubeTab(tabs[0].id, query);
  }

  throw new Error('Open a YouTube tab so Lurnia can search with your session');
}

async function searchFromYouTubeTab(tabId, query) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (q) => {
      const cfg = window.ytcfg;
      const get = (key) => {
        try {
          if (cfg && typeof cfg.get === 'function') return cfg.get(key);
        } catch (_) {}
        return cfg?.data_?.[key];
      };
      const apiKey = get('INNERTUBE_API_KEY') || 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
      const context = get('INNERTUBE_CONTEXT') || {
        client: { clientName: 'WEB', clientVersion: get('INNERTUBE_CLIENT_VERSION') || '2.20240101.00.00', hl: 'en' }
      };
      const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${apiKey}&prettyPrint=false`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, query: q })
      });
      if (!res.ok) throw new Error(`search ${res.status}`);
      return res.json();
    },
    args: [query]
  });
  const data = results?.[0]?.result;
  if (!data) throw new Error('YouTube search from page failed');
  return extractSearchVideos(data);
}

async function hydrateVideoStats(video) {
  const [player, next] = await Promise.all([
    innertube('player', { videoId: video.videoId, contentCheckOk: true, racyCheckOk: true }).catch(() => null),
    innertube('next', { videoId: video.videoId }).catch(() => null)
  ]);

  const details = player?.videoDetails || {};
  const stats = extractNextStats(next);

  return {
    ...video,
    title: details.title || video.title,
    channel: details.author || video.channel,
    views: parseCount(details.viewCount) || video.views || stats.views,
    durationSec: parseInt(details.lengthSeconds, 10) || video.durationSec || 0,
    likes: stats.likes,
    comments: stats.comments,
    subscribers: stats.subscribers || video.subscribers,
    published: video.published,
    thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
  };
}

function extractSearchVideos(data) {
  const renderers = walkFind(data, (n) => n.videoRenderer?.videoId).map((n) => n.videoRenderer);
  return renderers.map((r) => {
    const videoId = r.videoId;
    const title = runsText(r.title?.runs) || r.title?.simpleText || '';
    const channel = runsText(r.ownerText?.runs) || r.longBylineText?.runs?.[0]?.text || '';
    const views = parseCount(r.viewCountText?.simpleText || r.shortViewCountText?.simpleText);
    const durationSec = parseClock(r.lengthText?.simpleText);
    const published = r.publishedTimeText?.simpleText || '';
    const thumb = r.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
    return {
      videoId,
      title,
      channel,
      views,
      durationSec,
      published,
      thumbnail: thumb,
      likes: 0,
      comments: 0,
      subscribers: 0
    };
  });
}

function extractNextStats(data) {
  if (!data) return { likes: 0, comments: 0, views: 0, subscribers: 0 };

  let likes = 0;
  let comments = 0;
  let views = 0;
  let subscribers = 0;

  const likeNodes = walkFind(data, (n) =>
    n.likeButtonViewModel?.likeCountEntity ||
    n.toggleButtonRenderer?.defaultText ||
    (typeof n.accessibilityText === 'string' && /like/i.test(n.accessibilityText))
  );
  for (const node of likeNodes) {
    likes = likes || parseCount(
      node.likeButtonViewModel?.likeCountEntity?.likeCountIfLiked?.content ||
      node.likeButtonViewModel?.likeCountEntity?.likeCountIfIndifferent?.content ||
      node.toggleButtonRenderer?.defaultText?.simpleText ||
      node.toggleButtonRenderer?.defaultText?.accessibility?.accessibilityData?.label ||
      node.accessibilityText
    );
    if (likes) break;
  }

  const commentNodes = walkFind(data, (n) =>
    n.commentCount?.simpleText ||
    n.commentsCount?.simpleText ||
    n.commentsEntryPointHeaderRenderer?.commentCount
  );
  for (const node of commentNodes) {
    comments = comments || parseCount(
      node.commentCount?.simpleText ||
      node.commentsCount?.simpleText ||
      node.commentsEntryPointHeaderRenderer?.commentCount?.simpleText ||
      runsText(node.commentsEntryPointHeaderRenderer?.commentCount?.runs)
    );
    if (comments) break;
  }

  const viewNodes = walkFind(data, (n) => n.viewCount?.videoViewCountRenderer?.viewCount);
  if (viewNodes[0]) {
    views = parseCount(
      viewNodes[0].viewCount.videoViewCountRenderer.viewCount.simpleText ||
      runsText(viewNodes[0].viewCount.videoViewCountRenderer.viewCount.runs)
    );
  }

  const subNodes = walkFind(data, (n) => n.subscriberCountText);
  if (subNodes[0]) {
    subscribers = parseCount(subNodes[0].subscriberCountText.simpleText || runsText(subNodes[0].subscriberCountText.runs));
  }

  return { likes, comments, views, subscribers };
}

async function innertube(endpoint, payload) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': WEB_CONTEXT.client.clientVersion
    },
    body: JSON.stringify({ context: WEB_CONTEXT, ...payload })
  });
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  return res.json();
}

function walkFind(obj, predicate, acc = []) {
  if (!obj || typeof obj !== 'object') return acc;
  if (predicate(obj)) acc.push(obj);
  const values = Array.isArray(obj) ? obj : Object.values(obj);
  for (const value of values) {
    if (value && typeof value === 'object') walkFind(value, predicate, acc);
  }
  return acc;
}

function findContinuation(data) {
  const nodes = walkFind(data, (n) => n.continuationCommand?.token);
  return nodes[0]?.continuationCommand?.token || null;
}

function runsText(runs) {
  return (runs || []).map((r) => r.text || '').join('');
}

function parseCount(text) {
  if (typeof text === 'number' && Number.isFinite(text)) return text;
  if (!text) return 0;
  const cleaned = String(text).replace(/,/g, '').replace(/[^\d.KMB]/gi, ' ').trim();
  const match = cleaned.match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
  const n = parseFloat(match[1]);
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(match[2] || '').toUpperCase()] || 1;
  return Math.round(n * mult);
}

function parseClock(text) {
  if (!text) return 0;
  const parts = String(text).trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function dedupeVideos(videos) {
  const seen = new Set();
  const out = [];
  for (const video of videos) {
    if (!video.videoId || seen.has(video.videoId)) continue;
    seen.add(video.videoId);
    out.push(video);
  }
  return out;
}

async function mapPool(items, concurrency, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      try {
        results[current] = await fn(items[current]);
      } catch (_) {
        results[current] = items[current];
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function formatCompact(n) {
  const num = Number(n) || 0;
  if (num >= 1e9) return `${(num / 1e9).toFixed(1).replace(/\.0$/, '')}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1).replace(/\.0$/, '')}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return String(num);
}

export function formatDuration(sec) {
  const t = Math.max(0, Math.floor(Number(sec) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
