// Lurnia Extension - YouTube Content Script

(function() {
  'use strict';

  let currentVideoId = null;
  let videoElement = null;

  /**
   * Initialize the content script
   */
  function init() {
    // Detect video on page load
    detectVideo();

    // Watch for URL changes (YouTube is a SPA)
    observeUrlChanges();

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener(handleMessage);
  }

  /**
   * Handle messages from popup or background script
   */
  function handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'GET_VIDEO_INFO':
        const info = getVideoInfo();
        sendResponse({ success: !!info, data: info });
        break;

      case 'SEEK_VIDEO':
        seekToTime(message.time);
        sendResponse({ success: true });
        break;

      case 'GET_CURRENT_TIME':
        const time = getCurrentTime();
        sendResponse({ success: true, time });
        break;

      case 'GET_TRANSCRIPT':
        // Fetch transcript client-side (bypasses server IP blocking)
        fetchTranscript()
          .then(result => sendResponse(result))
          .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // Keep channel open for async

      case 'PING':
        sendResponse({ success: true });
        break;

      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }

    return true; // Keep message channel open for async response
  }

  /**
   * Fetch transcript directly from YouTube (client-side)
   * This works because user's browser IP is not blocked
   */
  async function fetchTranscript() {
    try {
      console.log('[Lurnia] Fetching transcript client-side...');

      // Try to find player response with retry logic
      let playerResponse = null;

      for (let attempt = 0; attempt < 3; attempt++) {
        if (attempt > 0) {
          console.log(`[Lurnia] Retry attempt ${attempt + 1}...`);
          await new Promise(r => setTimeout(r, 500));
        }

        // Method 1: Get ytInitialPlayerResponse from page scripts
        const scripts = document.querySelectorAll('script');

        for (const script of scripts) {
          const content = script.textContent || '';

          // Try ytInitialPlayerResponse
          if (content.includes('ytInitialPlayerResponse')) {
            const startIdx = content.indexOf('ytInitialPlayerResponse');
            const eqIdx = content.indexOf('=', startIdx);
            if (eqIdx > 0) {
              const jsonStart = content.indexOf('{', eqIdx);
              if (jsonStart > 0) {
                let braceCount = 0;
                let jsonEnd = jsonStart;
                for (let i = jsonStart; i < content.length; i++) {
                  if (content[i] === '{') braceCount++;
                  if (content[i] === '}') braceCount--;
                  if (braceCount === 0) {
                    jsonEnd = i + 1;
                    break;
                  }
                }
                try {
                  playerResponse = JSON.parse(content.substring(jsonStart, jsonEnd));
                  console.log('[Lurnia] Found playerResponse via ytInitialPlayerResponse');
                  break;
                } catch (e) {
                  // Continue
                }
              }
            }
          }

          // Try ytplayer.config (alternative location)
          if (!playerResponse && content.includes('ytplayer.config')) {
            const configMatch = content.match(/ytplayer\.config\s*=\s*(\{[\s\S]*?\});/);
            if (configMatch) {
              try {
                const config = JSON.parse(configMatch[1]);
                if (config.args?.player_response) {
                  playerResponse = JSON.parse(config.args.player_response);
                  console.log('[Lurnia] Found playerResponse via ytplayer.config');
                  break;
                }
              } catch (e) {
                // Continue
              }
            }
          }
        }

        if (playerResponse) break;
      }

      // Method 2: Try to get from window via script injection
      if (!playerResponse) {
        console.log('[Lurnia] Trying window access via DOM...');
        playerResponse = await getPlayerResponseFromWindow();
      }

      if (!playerResponse) {
        console.log('[Lurnia] Scripts on page:', document.querySelectorAll('script').length);
        throw new Error('Could not find player response');
      }

      // Get caption tracks: prefer page's tracks first (same-origin request often works even with ip=0.0.0.0)
      let pageTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      let innertubeTracks = null;
      const videoId = playerResponse?.videoDetails?.videoId;

      if (pageTracks?.[0]?.baseUrl?.includes('ip=0.0.0.0')) {
        console.log('[Lurnia] Page caption URLs have ip=0.0.0.0, fetching fresh via innertube as fallback...');
        const freshResponse = await fetchFreshPlayerResponse(videoId);
        if (freshResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks) {
          innertubeTracks = freshResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
          console.log('[Lurnia] Got fresh caption tracks from innertube');
        }
      }

      // Build list of (url, language) to try: page first, then innertube (innertube often returns empty from extension)
      const urlCandidates = [];
      const pushCandidate = (url, lang) => {
        if (!url) return;
        if (!urlCandidates.some(c => c.url === url)) {
          urlCandidates.push({ url, lang: lang || 'unknown' });
        }
      };

      const addNormalizedTimedtextUrl = (track, fallbackVideoId) => {
        try {
          if (!track?.baseUrl || !fallbackVideoId) return;
          const parsed = new URL(track.baseUrl);
          const lang = parsed.searchParams.get('lang') || track.languageCode || 'en';
          const kind = parsed.searchParams.get('kind');
          const name = parsed.searchParams.get('name');

          // Build a minimal URL without volatile signed params that often return empty.
          const normalized = new URL('https://www.youtube.com/api/timedtext');
          normalized.searchParams.set('v', fallbackVideoId);
          normalized.searchParams.set('lang', lang);
          if (kind) normalized.searchParams.set('kind', kind);
          if (name) normalized.searchParams.set('name', name);

          pushCandidate(normalized.toString(), lang);
        } catch (_) {
          // ignore malformed URL
        }
      };
      if (pageTracks?.length) {
        pageTracks.forEach(t => {
          if (t.baseUrl) pushCandidate(t.baseUrl, t.languageCode);
          addNormalizedTimedtextUrl(t, videoId);
        });
      }
      if (innertubeTracks?.length) {
        innertubeTracks.forEach(t => {
          if (t.baseUrl) pushCandidate(t.baseUrl, t.languageCode);
          addNormalizedTimedtextUrl(t, videoId);
        });
      }

      if (urlCandidates.length === 0) {
        throw new Error('No captions available for this video');
      }

      console.log('[Lurnia] Found', urlCandidates.length, 'caption URL(s), trying page context fetch (has cookies)...');

      // Page context fetch: runs in MAIN world with YouTube's session cookies
      const fetchCaptionsFromPage = (url, format) => {
        const finalUrl = format === 'xml'
          ? url
          : (url + (url.includes('?') ? '&' : '?') + `fmt=${format}`);
        console.log('[Lurnia] Page fetch:', format, finalUrl.substring(0, 80) + '...');
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Page fetch timeout (10s)'));
          }, 10000);

          chrome.runtime.sendMessage(
            { type: 'FETCH_CAPTION_IN_PAGE', url: finalUrl },
            (response) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.log('[Lurnia] Page fetch chrome error:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message || 'Background error'));
                return;
              }
              console.log('[Lurnia] Page fetch response:', response?.success, response?.text?.length || 0, 'chars');
              if (response && response.success && response.text && response.text.length > 0) {
                resolve(response.text);
              } else {
                reject(new Error(response?.error || 'Page fetch empty/failed'));
              }
            }
          );
        });
      };

      const fetchTranscriptFromPanel = () => {
        console.log('[Lurnia] Trying transcript panel scrape...');
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Panel scrape timeout (15s)'));
          }, 15000);

          chrome.runtime.sendMessage(
            { type: 'GET_TRANSCRIPT_FROM_PANEL_IN_PAGE' },
            (response) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) {
                console.log('[Lurnia] Panel scrape chrome error:', chrome.runtime.lastError.message);
                reject(new Error(chrome.runtime.lastError.message || 'Background error'));
                return;
              }
              console.log('[Lurnia] Panel scrape response:', response?.success, response?.data?.length || 0, 'segments');
              if (response && response.success && Array.isArray(response.data) && response.data.length > 0) {
                resolve(response.data);
              } else {
                reject(new Error(response?.error || 'Panel transcript empty/failed'));
              }
            }
          );
        });
      };

      let captionText = null;
      let responseFormat = null;
      let language = urlCandidates[0].lang;
      // Try json3 first (structured), then xml (most compatible)
      const formatsToTry = ['json3', 'xml'];

      // Skip XHR - content scripts run in isolated world without YouTube cookies
      // Go directly to page context fetch which runs in MAIN world
      for (const { url: captionUrl, lang } of urlCandidates) {
        language = lang;
        console.log('[Lurnia] Trying caption URL (track:', lang, ')');
        for (const format of formatsToTry) {
          try {
            captionText = await fetchCaptionsFromPage(captionUrl, format);
            responseFormat = format;
            console.log('[Lurnia] ✓ Got captions via page fetch:', captionText.length, 'chars', `(${format})`);
            break;
          } catch (e) {
            console.log('[Lurnia] Page fetch failed for', format, '-', e?.message || e);
          }
        }
        if (captionText) break;
      }

      // If page context fetch failed, try transcript panel scrape as fallback
      if (!captionText) {
        console.log('[Lurnia] URL-based caption fetch failed, trying transcript panel scrape...');
        try {
          const panelSegments = await fetchTranscriptFromPanel();
          if (panelSegments && panelSegments.length > 0) {
            const panelText = panelSegments.map(s => s.text).join(' ');
            console.log('[Lurnia] Got transcript from panel:', panelSegments.length, 'segments');
            return {
              success: true,
              text: panelText,
              segments: panelSegments,
              language: language,
              charCount: panelText.length
            };
          }
        } catch (panelErr) {
          console.log('[Lurnia] Panel transcript scrape failed:', panelErr?.message || panelErr);
        }
        throw new Error('Failed to fetch captions - all URL and format combinations failed');
      }

      // Parse the response
      const segments = [];
      const textParts = [];

      if (responseFormat === 'json3') {
        const json3Data = JSON.parse(captionText);
        if (json3Data.events) {
          for (const event of json3Data.events) {
            if (event.segs) {
              const segText = event.segs.map(seg => seg.utf8 || '').join('');
              if (segText.trim()) {
                segments.push({
                  text: segText.trim(),
                  start: (event.tStartMs || 0) / 1000,
                  duration: (event.dDurationMs || 0) / 1000
                });
                textParts.push(segText.trim());
              }
            }
          }
        }
      } else if (responseFormat === 'vtt') {
        // Parse WEBVTT fallback
        const lines = captionText.split(/\r?\n/);
        let currentText = [];
        let currentStart = 0;
        const flushCue = () => {
          const text = currentText.join(' ').trim();
          if (text) {
            segments.push({
              text,
              start: currentStart,
              duration: 0
            });
            textParts.push(text);
          }
          currentText = [];
        };
        for (const line of lines) {
          const l = line.trim();
          if (!l || l === 'WEBVTT' || l.startsWith('NOTE')) {
            if (!l) flushCue();
            continue;
          }
          if (l.includes('-->')) {
            flushCue();
            const start = l.split('-->')[0].trim();
            const parts = start.split(':').map(Number);
            if (parts.length === 3) currentStart = parts[0] * 3600 + parts[1] * 60 + parts[2];
            else if (parts.length === 2) currentStart = parts[0] * 60 + parts[1];
            else currentStart = 0;
            continue;
          }
          // Skip cue indexes (numeric-only line)
          if (/^\d+$/.test(l)) continue;
          currentText.push(l);
        }
        flushCue();
      } else {
        // Parse XML with regex
        const regex = /<text[^>]*start="([^"]*)"[^>]*dur="([^"]*)"[^>]*>([\s\S]*?)<\/text>/g;
        let match;
        while ((match = regex.exec(captionText)) !== null) {
          let text = match[3]
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\n/g, ' ')
            .trim();
          if (text) {
            segments.push({
              text,
              start: parseFloat(match[1]),
              duration: parseFloat(match[2])
            });
            textParts.push(text);
          }
        }
      }

      if (segments.length === 0) {
        throw new Error('No caption segments found in response');
      }

      const fullText = textParts.join(' ');
      console.log('[Lurnia] ✓ Fetched', segments.length, 'segments,', fullText.length, 'chars');

      return {
        success: true,
        text: fullText,
        segments: segments,
        language: language,
        charCount: fullText.length
      };

    } catch (error) {
      console.error('[Lurnia] Transcript fetch error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Fetch fresh player response via YouTube's innertube API
   * This gets valid caption URLs with correct IP
   */
  async function fetchFreshPlayerResponse(videoId) {
    if (!videoId) return null;

    try {
      const response = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
              hl: 'en',
              gl: 'US',
            }
          },
          videoId: videoId
        })
      });

      if (!response.ok) {
        console.log('[Lurnia] Innertube API failed:', response.status);
        return null;
      }

      const data = await response.json();
      console.log('[Lurnia] Innertube response received');
      return data;
    } catch (e) {
      console.log('[Lurnia] Innertube fetch error:', e.message);
      return null;
    }
  }

  /**
   * Try to get player response from window object
   * Uses a data attribute workaround since content scripts can't access window directly
   */
  async function getPlayerResponseFromWindow() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PLAYER_RESPONSE_IN_PAGE' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('[Lurnia] MAIN world player response fetch failed:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        if (response?.success && response.data) {
          console.log('[Lurnia] Got playerResponse via MAIN world');
          resolve(response.data);
          return;
        }
        if (response?.error) {
          console.log('[Lurnia] MAIN world player response error:', response.error);
        }
        resolve(null);
      });
    });
  }

  /**
   * Detect if we're on a video page and get video info
   */
  function detectVideo() {
    const url = new URL(window.location.href);

    if (url.pathname === '/watch') {
      const videoId = url.searchParams.get('v');

      if (videoId && videoId !== currentVideoId) {
        currentVideoId = videoId;
        videoElement = document.querySelector('video.html5-main-video');

        // Wait for video element to be available
        if (!videoElement) {
          waitForVideo();
        } else {
          notifyVideoDetected();
        }
      }
    } else {
      currentVideoId = null;
      videoElement = null;
    }
  }

  /**
   * Wait for video element to appear
   */
  function waitForVideo() {
    const observer = new MutationObserver((mutations, obs) => {
      const video = document.querySelector('video.html5-main-video');
      if (video) {
        videoElement = video;
        notifyVideoDetected();
        obs.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Timeout after 10 seconds
    setTimeout(() => observer.disconnect(), 10000);
  }

  /**
   * Notify extension that video was detected
   */
  function notifyVideoDetected() {
    const info = getVideoInfo();
    if (info) {
      chrome.runtime.sendMessage({
        type: 'VIDEO_DETECTED',
        data: info
      });
    }
  }

  /**
   * Get current video information
   */
  function getVideoInfo() {
    if (!currentVideoId) return null;

    try {
      // Get video title
      const titleElement = document.querySelector(
        'h1.ytd-video-primary-info-renderer yt-formatted-string, ' +
        'h1.ytd-watch-metadata yt-formatted-string, ' +
        '#title h1 yt-formatted-string'
      );
      const title = titleElement?.textContent?.trim() || 'Unknown Title';

      // Get channel name
      const channelElement = document.querySelector(
        '#channel-name yt-formatted-string a, ' +
        'ytd-channel-name yt-formatted-string a, ' +
        '#owner-name a'
      );
      const channel = channelElement?.textContent?.trim() || 'Unknown Channel';

      // Get thumbnail
      const thumbnail = `https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg`;

      // Get video duration
      const duration = videoElement?.duration || 0;

      return {
        videoId: currentVideoId,
        title,
        channel,
        thumbnail,
        duration,
        url: window.location.href
      };
    } catch (error) {
      console.error('[Lurnia] Error getting video info:', error);
      return {
        videoId: currentVideoId,
        title: document.title.replace(' - YouTube', ''),
        channel: 'Unknown Channel',
        thumbnail: `https://img.youtube.com/vi/${currentVideoId}/mqdefault.jpg`,
        duration: 0,
        url: window.location.href
      };
    }
  }

  /**
   * Seek video to specific time
   */
  function seekToTime(seconds) {
    if (videoElement) {
      videoElement.currentTime = seconds;

      // Also trigger play if paused
      if (videoElement.paused) {
        videoElement.play().catch(() => {});
      }

      // Visual feedback
      showSeekFeedback(seconds);
    }
  }

  /**
   * Show visual feedback when seeking
   */
  function showSeekFeedback(seconds) {
    // Remove existing feedback
    const existing = document.querySelector('.lurnia-seek-feedback');
    if (existing) existing.remove();

    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = 'lurnia-seek-feedback';
    feedback.textContent = formatTime(seconds);

    // Find video container
    const container = document.querySelector('#movie_player') || document.body;
    container.appendChild(feedback);

    // Animate and remove
    setTimeout(() => {
      feedback.classList.add('fade-out');
      setTimeout(() => feedback.remove(), 300);
    }, 1000);
  }

  /**
   * Format seconds to timestamp string
   */
  function formatTime(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  /**
   * Get current playback time
   */
  function getCurrentTime() {
    return videoElement?.currentTime || 0;
  }

  /**
   * Observe URL changes for SPA navigation
   */
  function observeUrlChanges() {
    let lastUrl = location.href;

    // Use MutationObserver to detect URL changes
    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        detectVideo();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also listen for popstate
    window.addEventListener('popstate', detectVideo);

    // And yt-navigate-finish for YouTube's internal navigation
    window.addEventListener('yt-navigate-finish', detectVideo);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
