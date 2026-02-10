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

      // Get ytInitialPlayerResponse from page
      const scripts = document.querySelectorAll('script');
      let playerResponse = null;

      for (const script of scripts) {
        const content = script.textContent || '';
        const match = content.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
        if (match) {
          playerResponse = JSON.parse(match[1]);
          break;
        }
      }

      // Also try window object
      if (!playerResponse && window.ytInitialPlayerResponse) {
        playerResponse = window.ytInitialPlayerResponse;
      }

      if (!playerResponse) {
        throw new Error('Could not find player response');
      }

      // Get caption tracks
      const captionTracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!captionTracks || captionTracks.length === 0) {
        throw new Error('No captions available for this video');
      }

      console.log('[Lurnia] Found', captionTracks.length, 'caption tracks');

      // Get first caption track (prefer English)
      let captionTrack = captionTracks.find(t => t.languageCode === 'en') || captionTracks[0];
      const captionUrl = captionTrack.baseUrl;

      // Fetch captions in JSON3 format (easier to parse)
      const json3Url = captionUrl + '&fmt=json3';
      console.log('[Lurnia] Fetching captions from:', json3Url.substring(0, 80) + '...');

      const response = await fetch(json3Url);
      if (!response.ok) {
        throw new Error('Failed to fetch captions: ' + response.status);
      }

      const json3Data = await response.json();

      if (!json3Data.events) {
        throw new Error('Invalid caption format');
      }

      // Parse segments
      const segments = [];
      const textParts = [];

      for (const event of json3Data.events) {
        if (event.segs) {
          const text = event.segs.map(seg => seg.utf8 || '').join('');
          if (text.trim()) {
            segments.push({
              text: text.trim(),
              start: (event.tStartMs || 0) / 1000,
              duration: (event.dDurationMs || 0) / 1000
            });
            textParts.push(text.trim());
          }
        }
      }

      const fullText = textParts.join(' ');
      console.log('[Lurnia] ✓ Fetched', segments.length, 'segments,', fullText.length, 'chars');

      return {
        success: true,
        text: fullText,
        segments: segments,
        language: captionTrack.languageCode,
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
