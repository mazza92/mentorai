const { google } = require('googleapis');

/**
 * Rank YouTube search results by genuine engagement instead of raw views.
 * Uses the official Data API (reliable on Railway) — not caption scraping.
 *
 * Saves/shares are not public. Comments and likes vs views are the proxies.
 */
class ValueSearchService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  async search(query, options = {}) {
    if (!process.env.YOUTUBE_API_KEY) {
      throw new Error('YOUTUBE_API_KEY is not configured');
    }

    const includeShorts = options.includeShorts === true;
    const limit = Math.min(Math.max(parseInt(options.limit, 10) || 12, 3), 20);
    const q = String(query || '').trim().slice(0, 120);
    if (q.length < 2) {
      throw new Error('Query is too short');
    }

    const searchResponse = await this.youtube.search.list({
      part: ['snippet'],
      q,
      type: ['video'],
      maxResults: 25,
      safeSearch: 'moderate',
      relevanceLanguage: options.language === 'fr' ? 'fr' : undefined
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

module.exports = new ValueSearchService();
