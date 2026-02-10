// Lurnia Extension - Background Service Worker

const API_BASE = 'https://mentorai-production.up.railway.app/api';
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

    case 'GET_TAB_INFO':
      sendResponse({ tabId: sender.tab?.id, url: sender.tab?.url });
      break;

    default:
      console.log('[Lurnia] Unknown message type:', message.type);
  }
});

/**
 * Handle video detection from content script
 */
function handleVideoDetected(videoData, tab) {
  console.log('[Lurnia] Video detected:', videoData.videoId);

  // Update badge to show we're ready
  chrome.action.setBadgeText({ text: '!', tabId: tab.id });
  chrome.action.setBadgeBackgroundColor({ color: '#3b82f6', tabId: tab.id });

  // Clear badge after a few seconds
  setTimeout(() => {
    chrome.action.setBadgeText({ text: '', tabId: tab.id });
  }, 3000);
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
 * Handle tab updates to detect YouTube navigation
 */
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    if (tab.url.includes('youtube.com/watch')) {
      // Ping content script to make sure it's active
      chrome.tabs.sendMessage(tabId, { type: 'PING' }).catch(() => {
        // Content script not loaded, might need to inject
        console.log('[Lurnia] Content script not responding on tab', tabId);
      });
    }
  }
});

/**
 * Context menu for quick access (optional feature)
 */
chrome.runtime.onInstalled.addListener(() => {
  // Create context menu item
  chrome.contextMenus.create({
    id: 'lurnia-ask',
    title: 'Ask Lurnia about this video',
    contexts: ['page'],
    documentUrlPatterns: ['*://*.youtube.com/watch*']
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'lurnia-ask') {
    // Open popup
    chrome.action.openPopup();
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

chrome.alarms.onAlarm.addListener(async (alarm) => {
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
