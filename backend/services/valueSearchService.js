const { google } = require('googleapis');

const INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const WEB_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
    gl: 'US'
  }
};
const SEARCH_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Rank YouTube search results by genuine engagement instead of raw views.
 * Data API first. If Google quota is gone, Innertube search still works.
 */
class ValueSearchService {
  constructor() {
    this.apiKeys = [
      process.env.YOUTUBE_API_KEY,
      ...(process.env.YOUTUBE_API_KEYS || '').split(',')
    ].map((key) => String(key || '').trim()).filter(Boolean);
    this.keyIndex = 0;
    this.searchCache = new Map();
    this.quotaBlockedUntil = 0;
    this.youtube = this.apiKeys[0]
      ? google.youtube({ version: 'v3', auth: this.apiKeys[0] })
      : null;
  }

  useKey(index) {
    if (!this.apiKeys[index]) return;
    this.keyIndex = index;
    this.youtube = google.youtube({ version: 'v3', auth: this.apiKeys[index] });
  }

  cacheKey(query, options) {
    return JSON.stringify({
      q: String(query || '').trim().toLowerCase(),
      shorts: options.includeShorts === true,
      limit: options.limit || 12,
      lang: options.language || ''
    });
  }

  readCache(key) {
    const hit = this.searchCache.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) {
      this.searchCache.delete(key);
      return null;
    }
    return hit.videos;
  }

  writeCache(key, videos) {
    if (this.searchCache.size > 200) {
      const oldest = this.searchCache.keys().next().value;
      this.searchCache.delete(oldest);
    }
    this.searchCache.set(key, { at: Date.now(), videos });
  }

  isQuotaError(error) {
    const message = `${error?.message || ''} ${error?.errors?.[0]?.reason || ''}`;
    return error?.code === 403 || /quota exceeded|quotaExceeded|dailyLimitExceeded/i.test(message);
  }

  async search(query, options = {}) {
    const includeShorts = options.includeShorts === true;
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 12, 3), 20);
    const q = String(query || '').trim().slice(0, 120);
    if (q.length < 2) {
      throw new Error('Query is too short');
    }

    const key = this.cacheKey(q, { ...options, limit });
    const cached = this.readCache(key);
    if (cached) return cached;

    let videos = [];
    const quotaBlocked = Date.now() < this.quotaBlockedUntil;

    if (this.youtube && !quotaBlocked) {
      try {
        videos = await this.searchWithDataApi(q, { includeShorts, limit, language: options.language });
      } catch (error) {
        if (this.isQuotaError(error) && this.keyIndex + 1 < this.apiKeys.length) {
          this.useKey(this.keyIndex + 1);
          try {
            videos = await this.searchWithDataApi(q, { includeShorts, limit, language: options.language });
          } catch (retryError) {
            if (!this.isQuotaError(retryError)) throw retryError;
            this.quotaBlockedUntil = Date.now() + 60 * 60 * 1000;
            videos = await this.searchWithInnertube(q, { includeShorts, limit });
          }
        } else if (this.isQuotaError(error)) {
          this.quotaBlockedUntil = Date.now() + 60 * 60 * 1000;
          console.warn('[ValueSearch] Data API quota hit, falling back to Innertube');
          videos = await this.searchWithInnertube(q, { includeShorts, limit });
        } else {
          throw error;
        }
      }
    } else {
      videos = await this.searchWithInnertube(q, { includeShorts, limit });
    }

    if (videos.length) this.writeCache(key, videos);
    return videos;
  }

  async searchWithDataApi(q, { includeShorts, limit, language }) {
    const searchResponse = await this.youtube.search.list({
      part: ['snippet'],
      q,
      type: ['video'],
      maxResults: 25,
      safeSearch: 'moderate',
      relevanceLanguage: language === 'fr' ? 'fr' : undefined
    });

    const ids = (searchResponse.data.items || [])
      .map((item) => item.id?.videoId)
      .filter(Boolean);

    if (!ids.length) return [];

    const videosResponse = await this.youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: ids
    });

    const videos = (videosResponse.data.items || []).map((item) => {
      const stats = item.statistics || {};
      return {
        videoId: item.id,
        title: item.snippet?.title || 'Untitled',
        channel: item.snippet?.channelTitle || '',
        description: item.snippet?.description || '',
        published: item.snippet?.publishedAt || '',
        thumbnail:
          item.snippet?.thumbnails?.medium?.url ||
          item.snippet?.thumbnails?.default?.url ||
          `https://img.youtube.com/vi/${item.id}/mqdefault.jpg`,
        views: parseInt(stats.viewCount, 10) || 0,
        likes: parseInt(stats.likeCount, 10) || 0,
        comments: parseInt(stats.commentCount, 10) || 0,
        durationSec: this.parseDuration(item.contentDetails?.duration || '')
      };
    });

    return this.scoreVideos(videos, { includeShorts }).slice(0, limit);
  }

  async searchWithInnertube(q, { includeShorts, limit }) {
    let data;
    try {
      data = await innertubePost('search', { query: q });
    } catch (error) {
      const err = new Error('YouTube search is busy. Try again in a bit.');
      err.cause = error;
      throw err;
    }
    const raw = extractSearchVideos(data).slice(0, 20);
    if (!raw.length) return [];

    const hydrated = [];
    for (const video of raw) {
      try {
        hydrated.push(await this.hydrateInnertubeVideo(video));
      } catch (_) {
        hydrated.push(video);
      }
    }

    return this.scoreVideos(hydrated, { includeShorts }).slice(0, limit);
  }

  async hydrateInnertubeVideo(video) {
    const [player, next] = await Promise.all([
      innertubePost('player', { videoId: video.videoId, contentCheckOk: true, racyCheckOk: true }).catch(() => null),
      innertubePost('next', { videoId: video.videoId }).catch(() => null)
    ]);
    const details = player?.videoDetails || {};
    const stats = extractNextStats(next);
    return {
      ...video,
      title: details.title || video.title,
      channel: details.author || video.channel,
      views: parseInt(details.viewCount, 10) || video.views || stats.views,
      durationSec: parseInt(details.lengthSeconds, 10) || video.durationSec || 0,
      likes: stats.likes || video.likes,
      comments: stats.comments || video.comments,
      thumbnail: video.thumbnail || `https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`
    };
  }

  async getVideo(videoId) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY is not configured');
    }
    const response = await this.youtube.videos.list({
      part: ['snippet', 'statistics', 'contentDetails'],
      id: [videoId]
    });
    const item = response.data.items?.[0];
    if (!item) {
      const err = new Error('Video not found');
      err.code = 'VIDEO_NOT_FOUND';
      throw err;
    }
    const stats = item.statistics || {};
    return {
      videoId: item.id,
      title: item.snippet?.title || 'Untitled',
      channel: item.snippet?.channelTitle || '',
      channelId: item.snippet?.channelId || '',
      description: item.snippet?.description || '',
      published: item.snippet?.publishedAt || '',
      thumbnail:
        item.snippet?.thumbnails?.maxres?.url ||
        item.snippet?.thumbnails?.high?.url ||
        item.snippet?.thumbnails?.medium?.url ||
        `https://img.youtube.com/vi/${item.id}/hqdefault.jpg`,
      views: parseInt(stats.viewCount, 10) || 0,
      likes: parseInt(stats.likeCount, 10) || 0,
      comments: parseInt(stats.commentCount, 10) || 0,
      durationSec: this.parseDuration(item.contentDetails?.duration || '')
    };
  }

  async fetchTopComments(videoId, maxResults = 25) {
    if (!process.env.YOUTUBE_API_KEY || !videoId) return [];
    try {
      const response = await this.youtube.commentThreads.list({
        part: ['snippet'],
        videoId,
        maxResults,
        order: 'relevance',
        textFormat: 'plainText'
      });
      return (response.data.items || []).map((item) => {
        const top = item.snippet?.topLevelComment?.snippet || {};
        return {
          author: top.authorDisplayName || 'Viewer',
          text: top.textDisplay || '',
          likes: top.likeCount || 0,
          published: top.publishedAt || ''
        };
      }).filter((c) => c.text);
    } catch (err) {
      console.warn('[ValueSearch] Comments unavailable:', err.message);
      return [];
    }
  }

  scoreVideos(videos, { includeShorts = false } = {}) {
    const pool = videos.filter((v) => {
      if (!v.videoId) return false;
      if (!includeShorts && v.durationSec > 0 && v.durationSec < 90) return false;
      return true;
    });
    if (!pool.length) return [];

    const commentRates = pool.map((v) => this.rate(v.comments, v.views));
    const likeRates = pool.map((v) => this.rate(v.likes, v.views));
    const commentLogs = pool.map((v) => Math.log10((v.comments || 0) + 1));

    return pool
      .map((v) => {
        const commentRate = this.rate(v.comments, v.views);
        const likeRate = this.rate(v.likes, v.views);
        const discussionPct = this.percentile(commentRates, commentRate);
        const likePct = this.percentile(likeRates, likeRate);
        const commentVolumePct = this.percentile(commentLogs, Math.log10((v.comments || 0) + 1));
        const depth = this.depthScore(v.durationSec);
        const gem = this.hiddenGemScore(v.views, commentRate, likeRate);
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
          reasons: this.buildReasons({
            discussionPct,
            likePct,
            depth,
            gem,
            commentRate,
            comments: v.comments
          })
        };
      })
      .sort((a, b) => b.valueScore - a.valueScore);
  }

  rate(part, whole) {
    return (Number(part) || 0) / Math.max(Number(whole) || 0, 1);
  }

  percentile(values, value) {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    let count = 0;
    for (const item of sorted) {
      if (item <= value) count += 1;
    }
    return (count - 1) / Math.max(sorted.length - 1, 1);
  }

  depthScore(durationSec) {
    const d = Number(durationSec) || 0;
    if (d <= 0) return 0.45;
    if (d < 90) return 0.05;
    if (d >= 8 * 60 && d <= 45 * 60) return 1;
    if (d >= 5 * 60) return 0.75;
    if (d >= 3 * 60) return 0.5;
    return 0.25;
  }

  hiddenGemScore(views, commentRate, likeRate) {
    const v = Number(views) || 0;
    if (v < 250000 && commentRate >= 0.002 && likeRate >= 0.02) return 1;
    if (v < 100000 && commentRate >= 0.0015) return 0.8;
    if (v < 500000 && commentRate >= 0.003) return 0.65;
    return 0.2;
  }

  buildReasons({ discussionPct, likePct, depth, gem, commentRate, comments }) {
    const reasons = [];
    if (discussionPct >= 0.72) reasons.push('High discussion');
    else if (commentRate >= 0.002) reasons.push('Strong comments');
    if (likePct >= 0.72) reasons.push('High like rate');
    if (gem >= 0.8) reasons.push('Hidden gem');
    else if (gem >= 0.65) reasons.push('Underrated');
    if (depth >= 0.75) reasons.push('Long-form');
    if (!reasons.length && comments > 0) reasons.push('Relevant match');
    return reasons.slice(0, 3);
  }

  parseDuration(isoDuration) {
    const match = String(isoDuration || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    return (parseInt(match[1], 10) || 0) * 3600 +
      (parseInt(match[2], 10) || 0) * 60 +
      (parseInt(match[3], 10) || 0);
  }
}

async function innertubePost(endpoint, payload) {
  const res = await fetch(`https://www.youtube.com/youtubei/v1/${endpoint}?key=${INNERTUBE_KEY}&prettyPrint=false`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YouTube-Client-Name': '1',
      'X-YouTube-Client-Version': WEB_CONTEXT.client.clientVersion,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({ context: WEB_CONTEXT, ...payload })
  });
  if (!res.ok) throw new Error(`YouTube search is busy. Try again in a bit.`);
  return res.json();
}

function extractSearchVideos(data) {
  const renderers = walkFind(data, (node) => node.videoRenderer?.videoId).map((node) => node.videoRenderer);
  return renderers.map((renderer) => {
    const videoId = renderer.videoId;
    return {
      videoId,
      title: runsText(renderer.title?.runs) || renderer.title?.simpleText || 'Untitled',
      channel: runsText(renderer.ownerText?.runs) || renderer.longBylineText?.runs?.[0]?.text || '',
      views: parseCount(renderer.viewCountText?.simpleText || renderer.shortViewCountText?.simpleText),
      durationSec: parseClock(renderer.lengthText?.simpleText),
      published: renderer.publishedTimeText?.simpleText || '',
      thumbnail: renderer.thumbnail?.thumbnails?.slice(-1)[0]?.url || `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      likes: 0,
      comments: 0,
      description: ''
    };
  });
}

function extractNextStats(data) {
  if (!data) return { likes: 0, comments: 0, views: 0 };
  let likes = 0;
  let comments = 0;
  let views = 0;
  const likeNodes = walkFind(data, (node) => node.likeButtonViewModel?.likeCountEntity || node.toggleButtonRenderer?.defaultText);
  for (const node of likeNodes) {
    likes = likes || parseCount(
      node.likeButtonViewModel?.likeCountEntity?.likeCountIfLiked?.content ||
      node.likeButtonViewModel?.likeCountEntity?.likeCountIfIndifferent?.content ||
      node.toggleButtonRenderer?.defaultText?.simpleText
    );
    if (likes) break;
  }
  const commentNodes = walkFind(data, (node) => node.commentCount?.simpleText || node.commentsEntryPointHeaderRenderer?.commentCount);
  for (const node of commentNodes) {
    comments = comments || parseCount(
      node.commentCount?.simpleText ||
      node.commentsEntryPointHeaderRenderer?.commentCount?.simpleText ||
      runsText(node.commentsEntryPointHeaderRenderer?.commentCount?.runs)
    );
    if (comments) break;
  }
  const viewNodes = walkFind(data, (node) => node.viewCount?.videoViewCountRenderer?.viewCount);
  if (viewNodes[0]) {
    views = parseCount(
      viewNodes[0].viewCount.videoViewCountRenderer.viewCount.simpleText ||
      runsText(viewNodes[0].viewCount.videoViewCountRenderer.viewCount.runs)
    );
  }
  return { likes, comments, views };
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

function runsText(runs) {
  return (runs || []).map((run) => run.text || '').join('');
}

function parseCount(text) {
  if (typeof text === 'number' && Number.isFinite(text)) return text;
  if (!text) return 0;
  const match = String(text).replace(/,/g, '').match(/([\d.]+)\s*([KMB])?/i);
  if (!match) return parseInt(String(text).replace(/[^\d]/g, ''), 10) || 0;
  const n = parseFloat(match[1]);
  const mult = { K: 1e3, M: 1e6, B: 1e9 }[(match[2] || '').toUpperCase()] || 1;
  return Math.round(n * mult);
}

function parseClock(text) {
  if (!text) return 0;
  const parts = String(text).trim().split(':').map((part) => parseInt(part, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

module.exports = new ValueSearchService();
