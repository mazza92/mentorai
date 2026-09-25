// Lurnia Extension - Background Service Worker

import { collectVideoData, getCachedVideoData } from './youtubeCollector.js';
import { searchValueVideos } from './valueSearch.js';

const API_BASE = 'https://lurnia.app/api';
// const API_BASE = 'http://localhost:3001/api'; // Development

/**
 * Handle extension installation
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Lurnia] Extension installed');
    // Open welcome page or main app
    chrome.tabs.create({ url: 'https://lurnia.app?source=extension' });
  } else if (details.reason === 'update') {
    console.log('[Lurnia] Extension updated to version', chrome.runtime.getManifest().version);
  }
});

/**
 * Handle messages from popup or content scripts
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'VIDEO_DETECTED':
      handleVideoDetected(message.data, sender.tab);
      break;

    case 'API_REQUEST':
      handleApiRequest(message)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true; // Keep channel open for async response

    case 'ASK_QUESTION':
      // Ack immediately so the popup can close. Work continues in the worker.
      sendResponse({ success: true, accepted: true });
      keepAliveUntil(processQuestion(message.data)).catch((error) => {
        console.error('[Lurnia] ASK_QUESTION failed:', error);
      });
      break;

    case 'COLLECT_VIDEO_DATA':
      collectVideoData(message.tabId || sender.tab?.id, message.videoId)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_CACHED_VIDEO_DATA':
      getCachedVideoData(message.videoId)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'ENSURE_CONTENT_SCRIPT':
      ensureContentScript(message.tabId)
        .then(() => sendResponse({ success: true }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'SEARCH_VALUE_VIDEOS':
      searchValueVideos(message.query, message.options || {})
        .then((videos) => sendResponse({ success: true, videos }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;

    case 'GET_PENDING_ANSWER':
      // Check if there's a pending or completed answer
      getPendingAnswer(message.videoId)
        .then(sendResponse)
        .catch(error => sendResponse({ error: error.message }));
      return true;

    case 'CLEAR_PENDING_ANSWER':
      chrome.storage.local.remove(`pending_answer_${message.videoId}`);
      sendResponse({ success: true });
      break;

    case 'YOUTUBE_READY':
      syncToolbarBadge(sender.tab).catch(() => {});
      sendResponse({ success: true });
      break;

    case 'OPEN_POPUP':
      chrome.action.openPopup().catch(() => {
        paintReadyBadge(true, sender.tab?.id);
      });
      sendResponse({ success: true });
      break;

    case 'GET_TAB_INFO':
      sendResponse({ tabId: sender.tab?.id, url: sender.tab?.url });
      break;

    case 'FETCH_CAPTION_IN_PAGE':
      console.log('[Lurnia] FETCH_CAPTION_IN_PAGE for tab', sender.tab?.id);
      fetchCaptionInPage(message.url, sender.tab?.id)
        .then(text => sendResponse({ success: true, text }))
        .catch(err => {
          console.warn('[Lurnia] FETCH_CAPTION_IN_PAGE failed:', err?.message || err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    case 'GET_PLAYER_RESPONSE_IN_PAGE':
      getPlayerResponseInPage(sender.tab?.id)
        .then(data => sendResponse({ success: true, data }))
        .catch(err => sendResponse({ success: false, error: err.message }));
      return true;

    case 'GET_TRANSCRIPT_FROM_PANEL_IN_PAGE':
      console.log('[Lurnia] GET_TRANSCRIPT_FROM_PANEL_IN_PAGE for tab', sender.tab?.id);
      getTranscriptFromPanelInPage(sender.tab?.id)
        .then(data => {
          console.log('[Lurnia] Panel scrape returned', data?.length, 'segments');
          sendResponse({ success: true, data });
        })
        .catch(err => {
          console.warn('[Lurnia] GET_TRANSCRIPT_FROM_PANEL_IN_PAGE failed:', err?.message || err);
          sendResponse({ success: false, error: err.message });
        });
      return true;

    default:
      console.log('[Lurnia] Unknown message type:', message.type);
  }
});

const ASK_KEEPALIVE_ALARM = 'ask-keepalive';
const ASK_JOB_TTL_MS = 4 * 60 * 1000;
const askInflight = new Set();

function pendingKey(videoId) {
  return `pending_answer_${videoId}`;
}

function keepAliveUntil(promise) {
  const ping = () => {
    try { chrome.runtime.getPlatformInfo(() => {}); } catch (_) {}
  };
  ping();
  const timer = setInterval(ping, 15000);
  chrome.alarms.create(ASK_KEEPALIVE_ALARM, { delayInMinutes: 0.4, periodInMinutes: 1 });
  return Promise.resolve(promise).finally(() => {
    clearInterval(timer);
    chrome.alarms.clear(ASK_KEEPALIVE_ALARM);
  });
}

async function writePending(videoId, data) {
  await chrome.storage.local.set({ [pendingKey(videoId)]: data });
  const pending = { ...data };
  delete pending.payload;
  try {
    chrome.runtime.sendMessage({ type: 'ANSWER_READY', videoId, pending }, () => {
      void chrome.runtime.lastError;
    });
  } catch (_) {}
}

/**
 * Process a question in the background
 */
async function processQuestion(data) {
  const {
    videoId,
    question,
    videoTitle,
    channelName,
    transcript,
    videoLanguage,
    userId,
    chatHistory,
    comments,
    videoDescription,
    transcriptSource,
    tabId
  } = data || {};

  if (!videoId || !question) return;
  if (askInflight.has(videoId)) return;
  askInflight.add(videoId);

  await writePending(videoId, {
    status: 'processing',
    question,
    startedAt: Date.now(),
    payload: data
  });

  try {
    let resolvedTranscript = transcript;
    let resolvedComments = comments || [];
    let resolvedDescription = videoDescription || '';
    let resolvedLanguage = videoLanguage;
    let resolvedSource = transcriptSource || '';
    let resolvedTitle = videoTitle;
    let resolvedChannel = channelName;

    if ((!resolvedTranscript || resolvedComments.length === 0) && tabId && videoId) {
      try {
        const collected = await collectVideoData(tabId, videoId);
        if (collected) {
          resolvedTranscript = resolvedTranscript || collected.timedTranscript || collected.transcript;
          resolvedComments = resolvedComments.length ? resolvedComments : (collected.comments || []);
          resolvedDescription = resolvedDescription || collected.description || '';
          resolvedLanguage = resolvedLanguage || collected.language;
          resolvedSource = resolvedSource || collected.source;
          resolvedTitle = resolvedTitle || collected.title;
          resolvedChannel = resolvedChannel || collected.channel;
        }
      } catch (collectErr) {
        console.warn('[Lurnia] Background collect failed:', collectErr.message);
      }
    }

    const response = await fetch(`${API_BASE}/qa/video-direct`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        videoId,
        question,
        videoTitle: resolvedTitle,
        channelName: resolvedChannel,
        userId,
        transcript: resolvedTranscript,
        videoLanguage: resolvedLanguage,
        chatHistory: chatHistory || [],
        comments: resolvedComments,
        videoDescription: resolvedDescription,
        transcriptSource: resolvedSource
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || 'Failed to get answer');
    }

    const result = await response.json();

    await writePending(videoId, {
      status: 'completed',
      question,
      answer: result.answer,
      citations: result.citations || [],
      completedAt: Date.now()
    });

    return result;
  } catch (error) {
    await writePending(videoId, {
      status: 'error',
      question,
      error: error.message,
      failedAt: Date.now()
    });
    throw error;
  } finally {
    askInflight.delete(videoId);
  }
}

async function resumePendingAskJobs() {
  const all = await chrome.storage.local.get(null);
  const now = Date.now();
  for (const [key, value] of Object.entries(all)) {
    if (!key.startsWith('pending_answer_') || value?.status !== 'processing') continue;
    const videoId = key.replace('pending_answer_', '');
    if (askInflight.has(videoId)) continue;
    if (!value.payload || now - (value.startedAt || 0) > ASK_JOB_TTL_MS) {
      await writePending(videoId, {
        status: 'error',
        question: value.question,
        error: 'Generation stopped. Ask again.',
        failedAt: now
      });
      continue;
    }
    keepAliveUntil(processQuestion(value.payload)).catch((error) => {
      console.error('[Lurnia] Resume ASK failed:', error);
    });
  }
}

/**
 * Get pending answer for a video
 */
async function getPendingAnswer(videoId) {
  const result = await chrome.storage.local.get(`pending_answer_${videoId}`);
  return result[`pending_answer_${videoId}`] || null;
}

/**
 * Handle video detection from content script
 */
function handleVideoDetected(videoData, tab) {
  console.log('[Lurnia] Video detected:', videoData.videoId);
  syncToolbarBadge(tab).catch(() => {});

  // Prefetch transcript + comments while the user is still on the watch page
  if (tab?.id && videoData.videoId) {
    collectVideoData(tab.id, videoData.videoId)
      .then((data) => {
        const captionCount = data?.segments?.length || 0;
        const commentCount = data?.comments?.length || 0;
        console.log('[Lurnia] Prefetch complete:', captionCount, 'segments,', commentCount, 'comments');
      })
      .catch((err) => console.warn('[Lurnia] Prefetch failed:', err.message));
  }
}

function isYouTubeUrl(url) {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
  } catch (_) {
    return false;
  }
}

function paintReadyBadge(on, tabId) {
  const text = on ? 'ON' : '';
  const title = on
    ? 'Lurnia is ready on YouTube. Click to find signal or steal a playbook'
    : 'Lurnia';
  const scoped = tabId ? { tabId } : {};
  chrome.action.setBadgeText({ text, ...scoped });
  if (on) {
    chrome.action.setBadgeBackgroundColor({ color: '#059669', ...scoped });
    if (chrome.action.setBadgeTextColor) {
      chrome.action.setBadgeTextColor({ color: '#ffffff', ...scoped });
    }
  }
  chrome.action.setTitle({ title, ...scoped });
}

async function syncToolbarBadge(tab) {
  let active = tab;
  try {
    if (!active?.url || active.active === false) {
      const [found] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (found) active = found;
    }
  } catch (_) {}

  let url = active?.url || active?.pendingUrl || '';
  if (!isYouTubeUrl(url)) {
    try {
      const [ytTab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
        url: [
          'https://www.youtube.com/*',
          'https://youtube.com/*',
          'https://m.youtube.com/*',
          'https://youtu.be/*'
        ]
      });
      if (ytTab) {
        active = ytTab;
        url = ytTab.url || ytTab.pendingUrl || '';
      }
    } catch (_) {}
  }

  const on = isYouTubeUrl(url);
  paintReadyBadge(on);
  if (active?.id) paintReadyBadge(on, active.id);
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' && !changeInfo.url) return;
  const on = isYouTubeUrl(tab?.url || '');
  paintReadyBadge(on, tabId);
  if (tab?.active) syncToolbarBadge(tab).catch(() => {});
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    await syncToolbarBadge(tab);
  } catch (_) {}
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    await syncToolbarBadge(tab);
  } catch (_) {}
});

chrome.runtime.onStartup.addListener(() => {
  syncToolbarBadge().catch(() => {});
});

syncToolbarBadge().catch(() => {});

async function ensureContentScript(tabId) {
  if (!tabId) throw new Error('Missing tabId');
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    return true;
  } catch (_) {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/youtube-detector.js']
    });
    return true;
  }
}

/**
 * Handle API requests from popup
 */
async function handleApiRequest(message) {
  const { endpoint, method = 'GET', body, token } = message;

  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Lurnia] API error:', error);
    throw error;
  }
}

/**
 * Fetch caption URL in the page's main world (same cookies/origin as player)
 */
async function fetchCaptionInPage(url, tabId) {
  if (!tabId || !url) {
    throw new Error('Missing tabId or url');
  }
  console.log('[Lurnia] fetchCaptionInPage: tabId=', tabId, 'url=', url.substring(0, 100));

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async (captionUrl) => {
      console.log('[Lurnia MAIN] Fetching caption URL:', captionUrl.substring(0, 80));
      try {
        const response = await fetch(captionUrl, { credentials: 'include' });
        console.log('[Lurnia MAIN] Response status:', response.status, response.statusText);
        const text = await response.text();
        console.log('[Lurnia MAIN] Response length:', text.length, 'chars');
        if (text && text.length > 0) {
          return { ok: true, text, status: response.status };
        }
        return { ok: false, error: 'Empty response', status: response.status };
      } catch (e) {
        console.error('[Lurnia MAIN] Fetch error:', e);
        return { ok: false, error: (e && e.message) || 'Fetch failed' };
      }
    },
    args: [url]
  });

  console.log('[Lurnia] executeScript results:', results?.length, 'result:', results?.[0]?.result);

  if (!results || !results[0]) {
    throw new Error('No result from page');
  }
  const out = results[0].result;
  if (out && out.ok && out.text) {
    console.log('[Lurnia] Page fetch success:', out.text.length, 'chars');
    return out.text;
  }
  console.log('[Lurnia] Page fetch failed:', out?.error, 'status:', out?.status);
  throw new Error((out && out.error) || 'Page fetch failed');
}

/**
 * Read YouTube player response in page MAIN world (bypasses content-script isolation).
 */
async function getPlayerResponseInPage(tabId) {
  if (!tabId) {
    throw new Error('Missing tabId');
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => {
      try {
        let pr = null;

        // Common globals on YouTube watch page
        if (window.ytInitialPlayerResponse) {
          pr = window.ytInitialPlayerResponse;
        }

        // Legacy player config location
        if (!pr && window.ytplayer?.config?.args?.player_response) {
          try {
            pr = JSON.parse(window.ytplayer.config.args.player_response);
          } catch (_) {}
        }

        // Try movie_player API
        if (!pr) {
          const player = document.getElementById('movie_player');
          if (player && typeof player.getPlayerResponse === 'function') {
            pr = player.getPlayerResponse();
          }
        }

        if (!pr) {
          return { ok: false, error: 'Could not find player response in MAIN world' };
        }

        // Return only required fields to keep payload small/serializable
        return {
          ok: true,
          data: {
            videoDetails: pr.videoDetails || null,
            captions: pr.captions || null
          }
        };
      } catch (e) {
        return { ok: false, error: (e && e.message) || 'MAIN world read failed' };
      }
    }
  });

  if (!results || !results[0] || !results[0].result) {
    throw new Error('No result from MAIN world');
  }

  const out = results[0].result;
  if (out.ok) return out.data;
  throw new Error(out.error || 'Failed to read player response');
}

/**
 * Open YouTube transcript panel (if needed) and scrape transcript segments in MAIN world.
 */
async function getTranscriptFromPanelInPage(tabId) {
  if (!tabId) throw new Error('Missing tabId');
  console.log('[Lurnia] getTranscriptFromPanelInPage: tabId=', tabId);

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: async () => {
      console.log('[Lurnia MAIN] Starting transcript panel scrape...');
      const sleep = (ms) => new Promise(r => setTimeout(r, ms));

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
        // Try multiple selectors for transcript segments
        let rows = Array.from(document.querySelectorAll('ytd-transcript-segment-renderer'));
        if (rows.length === 0) {
          // Alternative selectors for different YouTube layouts
          rows = Array.from(document.querySelectorAll('[class*="transcript-segment"], .ytd-transcript-segment-list-renderer'));
        }
        console.log('[Lurnia MAIN] Found', rows.length, 'transcript rows');

        const segments = [];
        for (const row of rows) {
          const t = row.querySelector('#segment-text, .segment-text, yt-formatted-string, [class*="segment-text"]')?.textContent?.trim() || '';
          const ts = row.querySelector('#segment-timestamp, .segment-timestamp, [class*="timestamp"]')?.textContent?.trim() || '';
          if (!t) continue;
          segments.push({
            text: t,
            start: parseTs(ts),
            duration: 0
          });
        }
        return segments;
      };

      // First check if transcript panel is already open
      let segments = collect();
      if (segments.length > 0) {
        console.log('[Lurnia MAIN] Transcript already visible:', segments.length, 'segments');
        return { ok: true, segments };
      }

      // Try to find and click "Show transcript" button (may be in description or actions)
      console.log('[Lurnia MAIN] Looking for transcript button...');

      // Method 1: Direct transcript button in video actions
      const transcriptBtn = document.querySelector('button[aria-label*="transcript" i], button[aria-label*="transcription" i]');
      if (transcriptBtn) {
        console.log('[Lurnia MAIN] Found direct transcript button');
        transcriptBtn.click();
        await sleep(1500);
        segments = collect();
        if (segments.length > 0) {
          return { ok: true, segments };
        }
      }

      // Method 2: "More actions" menu (3 dots)
      const moreButtonSelectors = [
        '#top-level-buttons-computed ytd-menu-renderer button',
        'ytd-menu-renderer yt-icon-button button',
        'button[aria-label*="More actions"]',
        'button[aria-label*="Plus d\'actions"]',
        'button[aria-label*="More"]',
        '#menu-container button',
        'ytd-video-primary-info-renderer #menu button'
      ];

      let moreButton = null;
      for (const sel of moreButtonSelectors) {
        moreButton = document.querySelector(sel);
        if (moreButton) {
          console.log('[Lurnia MAIN] Found more button via:', sel);
          break;
        }
      }

      if (moreButton) {
        moreButton.click();
        await sleep(400);

        // Look for transcript option in menu
        const menuItems = Array.from(document.querySelectorAll('ytd-menu-service-item-renderer, tp-yt-paper-item, yt-formatted-string'));
        console.log('[Lurnia MAIN] Menu items found:', menuItems.length);

        const transcriptItem = menuItems.find(el => {
          const txt = (el.textContent || '').toLowerCase();
          return txt.includes('transcript') || txt.includes('transcription');
        });

        if (transcriptItem) {
          console.log('[Lurnia MAIN] Found transcript menu item');
          transcriptItem.click();
          await sleep(1500);
          segments = collect();
          if (segments.length > 0) {
            return { ok: true, segments };
          }
        } else {
          console.log('[Lurnia MAIN] No transcript menu item found');
          // Close menu by clicking elsewhere
          document.body.click();
        }
      } else {
        console.log('[Lurnia MAIN] No more button found');
      }

      // Method 3: Check description for "Show transcript" link
      const descriptionLinks = document.querySelectorAll('#description-inline-expander a, #structured-description a, ytd-video-description-transcript-section-renderer button');
      for (const link of descriptionLinks) {
        const txt = (link.textContent || '').toLowerCase();
        if (txt.includes('transcript') || txt.includes('transcription')) {
          console.log('[Lurnia MAIN] Found transcript link in description');
          link.click();
          await sleep(1500);
          segments = collect();
          if (segments.length > 0) {
            return { ok: true, segments };
          }
        }
      }

      console.log('[Lurnia MAIN] All methods failed, no transcript found');
      return { ok: false, error: 'Could not open transcript panel' };
    }
  });

  console.log('[Lurnia] Panel scrape results:', results?.length, 'result:', results?.[0]?.result?.ok);

  if (!results || !results[0] || !results[0].result) {
    throw new Error('No panel scrape result');
  }
  const out = results[0].result;
  if (!out.ok) throw new Error(out.error || 'Panel scrape failed');
  console.log('[Lurnia] Panel scrape success:', out.segments?.length, 'segments');
  return out.segments || [];
}

/**
 * Handle tab updates to detect YouTube navigation
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('youtube.com/watch')) {
      // Ping content script to make sure it's active
      ensureContentScript(tabId).catch((err) => {
        console.log('[Lurnia] Content script inject failed on tab', tabId, err.message);
      });
    }
  }
});

/**
 * Context menu for quick access (optional feature)
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'lurnia-playbook',
      title: 'Steal playbook with Lurnia',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.youtube.com/watch*']
    });
    chrome.contextMenus.create({
      id: 'lurnia-ask',
      title: 'Ask this video with Lurnia',
      contexts: ['page'],
      documentUrlPatterns: ['*://*.youtube.com/watch*']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const videoId = tab?.url ? new URL(tab.url).searchParams.get('v') : null;
  if (info.menuItemId === 'lurnia-playbook' && videoId) {
    chrome.tabs.create({ url: `https://lurnia.app/v/${videoId}?ref=extension` });
    return;
  }
  if (info.menuItemId === 'lurnia-ask') {
    chrome.action.openPopup().catch(() => {});
  }
});

/**
 * Handle keyboard shortcuts (if defined in manifest)
 */
chrome.commands?.onCommand.addListener((command) => {
  if (command === 'open-lurnia') {
    chrome.action.openPopup();
  }
});

/**
 * Alarm for periodic tasks (e.g., token refresh)
 */
chrome.alarms.create('token-refresh', { periodInMinutes: 30 });

resumePendingAskJobs().catch(() => {});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === ASK_KEEPALIVE_ALARM) {
    resumePendingAskJobs().catch(() => {});
    return;
  }
  if (alarm.name === 'token-refresh') {
    // Check and refresh token if needed
    try {
      const result = await chrome.storage.local.get('lurnia_token');
      if (result.lurnia_token) {
        // Verify token is still valid
        const response = await fetch(`${API_BASE}/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${result.lurnia_token}`
          }
        });

        if (!response.ok) {
          // Token expired, clear storage
          await chrome.storage.local.remove(['lurnia_token', 'lurnia_user']);
          console.log('[Lurnia] Token expired, user logged out');
        }
      }
    } catch (error) {
      console.error('[Lurnia] Token refresh error:', error);
    }
  }
});

console.log('[Lurnia] Service worker initialized');
