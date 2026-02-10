// Lurnia Extension - Popup Script

import { api } from '../utils/api.js';
import { storage } from '../utils/storage.js';

// DOM Elements
const loginView = document.getElementById('loginView');
const mainView = document.getElementById('mainView');
const settingsView = document.getElementById('settingsView');
const loginBtn = document.getElementById('loginBtn');
const settingsBtn = document.getElementById('settingsBtn');
const backBtn = document.getElementById('backBtn');
const logoutBtn = document.getElementById('logoutBtn');
const videoStatus = document.getElementById('videoStatus');
const statusText = document.getElementById('statusText');
const videoInfo = document.getElementById('videoInfo');
const videoThumbnail = document.getElementById('videoThumbnail');
const videoTitle = document.getElementById('videoTitle');
const videoChannel = document.getElementById('videoChannel');
const messages = document.getElementById('messages');
const questionInput = document.getElementById('questionInput');
const sendBtn = document.getElementById('sendBtn');
const quotaText = document.getElementById('quotaText');
const userAvatar = document.getElementById('userAvatar');
const userName = document.getElementById('userName');
const userEmail = document.getElementById('userEmail');
const questionsStat = document.getElementById('questionsStat');
const planStat = document.getElementById('planStat');
const exportBtn = document.getElementById('exportBtn');

// State
let currentUser = null;
let currentVideo = null;
let isProcessing = false;
let chatHistory = []; // Track chat messages for persistence

// Language-specific UI strings and prompt starters
const PROMPT_STARTERS = {
  en: {
    welcome: "Ask any question about this video!",
    placeholder: "Ask about this video...",
    prompts: [
      { short: "What is this video about?", full: "What is this video about?" },
      { short: "Key takeaways?", full: "What are the key takeaways?" },
      { short: "Summarize in 3 points", full: "Summarize in 3 points" }
    ]
  },
  fr: {
    welcome: "Posez vos questions sur cette vidéo !",
    placeholder: "Posez votre question...",
    prompts: [
      { short: "De quoi parle cette vidéo ?", full: "De quoi parle cette vidéo ?" },
      { short: "Points clés ?", full: "Quels sont les points clés ?" },
      { short: "Résumé en 3 points", full: "Résume cette vidéo en 3 points" }
    ]
  },
  es: {
    welcome: "¡Haz cualquier pregunta sobre este video!",
    placeholder: "Pregunta sobre este video...",
    prompts: [
      { short: "¿De qué trata?", full: "¿De qué trata este video?" },
      { short: "Puntos clave?", full: "¿Cuáles son los puntos clave?" },
      { short: "Resumen en 3 puntos", full: "Resume este video en 3 puntos" }
    ]
  },
  de: {
    welcome: "Stellen Sie Fragen zu diesem Video!",
    placeholder: "Fragen Sie zu diesem Video...",
    prompts: [
      { short: "Worum geht es?", full: "Worum geht es in diesem Video?" },
      { short: "Wichtigste Punkte?", full: "Was sind die wichtigsten Punkte?" },
      { short: "In 3 Punkten", full: "Fasse dieses Video in 3 Punkten zusammen" }
    ]
  },
  pt: {
    welcome: "Faça qualquer pergunta sobre este vídeo!",
    placeholder: "Pergunte sobre este vídeo...",
    prompts: [
      { short: "Sobre o que é?", full: "Sobre o que é este vídeo?" },
      { short: "Pontos-chave?", full: "Quais são os pontos-chave?" },
      { short: "Resumo em 3 pontos", full: "Resuma este vídeo em 3 pontos" }
    ]
  }
};

// Generate anonymous user ID for MVP (no login required)
function getAnonymousUserId() {
  let anonId = localStorage.getItem('lurnia_anon_id');
  if (!anonId) {
    anonId = 'ext_anon_' + Math.random().toString(36).substring(2, 15);
    localStorage.setItem('lurnia_anon_id', anonId);
  }
  return anonId;
}

// Initialize
async function init() {
  // For MVP: use anonymous mode, skip login requirement
  let user = await storage.getUser();

  if (!user || !user.id) {
    // Create anonymous user for MVP
    user = {
      id: getAnonymousUserId(),
      name: 'Guest',
      email: '',
      picture: '',
      isAnonymous: true
    };
    await storage.setUser(user);
  }

  currentUser = user;
  showMainView();

  // Initialize with default English prompts
  updateSuggestedQuestions('en');

  detectCurrentVideo();

  // Load quota in background
  loadUserQuota().catch(console.error);

  // Setup event listeners
  setupEventListeners();
}

/**
 * Update suggested questions and UI text based on video language
 */
function updateSuggestedQuestions(langCode) {
  // Normalize language code (e.g., "fr-FR" -> "fr")
  const baseLang = langCode ? langCode.split('-')[0].toLowerCase() : 'en';
  const langData = PROMPT_STARTERS[baseLang] || PROMPT_STARTERS.en;

  const welcomeText = document.getElementById('welcomeText');
  const container = document.getElementById('suggestedQuestions');

  if (welcomeText) {
    welcomeText.textContent = langData.welcome;
  }

  // Update input placeholder
  if (questionInput) {
    questionInput.placeholder = langData.placeholder;
  }

  if (container) {
    container.innerHTML = langData.prompts.map(p =>
      `<button class="suggested-btn" data-question="${escapeHtml(p.full)}">${escapeHtml(p.short)}</button>`
    ).join('');

    // Attach click handlers
    container.querySelectorAll('.suggested-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const question = btn.dataset.question;
        questionInput.value = question;
        handleInputChange();
        handleSendQuestion();
      });
    });
  }
}

function setupEventListeners() {
  // Login
  loginBtn.addEventListener('click', handleLogin);

  // Navigation
  settingsBtn.addEventListener('click', showSettingsView);
  backBtn.addEventListener('click', showMainView);
  logoutBtn.addEventListener('click', handleLogout);
  exportBtn.addEventListener('click', exportChatAsPDF);

  // Input
  questionInput.addEventListener('input', handleInputChange);
  questionInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendQuestion();
    }
  });
  sendBtn.addEventListener('click', handleSendQuestion);

  // Note: Suggested question handlers are attached dynamically in updateSuggestedQuestions()

  // Listen for video detection from content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'VIDEO_DETECTED') {
      handleVideoDetected(message.data);
    }
  });
}

// View Management
function showLoginView() {
  loginView.classList.remove('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.add('hidden');
}

function showMainView() {
  loginView.classList.add('hidden');
  mainView.classList.remove('hidden');
  settingsView.classList.add('hidden');
}

function showSettingsView() {
  loginView.classList.add('hidden');
  mainView.classList.add('hidden');
  settingsView.classList.remove('hidden');
  updateSettingsView();
}

function updateSettingsView() {
  if (currentUser) {
    if (currentUser.isAnonymous) {
      userAvatar.src = '';
      userName.textContent = 'Guest User';
      userEmail.textContent = 'Sign in for more questions';
    } else {
      userAvatar.src = currentUser.picture || '';
      userName.textContent = currentUser.name || 'User';
      userEmail.textContent = currentUser.email || '';
    }

    const quota = currentUser.quota || { questions: 0, limit: 5 };
    questionsStat.textContent = `${quota.questions}/${quota.limit}`;
    planStat.textContent = currentUser.isAnonymous ? 'Guest' : (currentUser.plan || 'Free');
  }
}

// Authentication
async function handleLogin() {
  try {
    loginBtn.disabled = true;
    loginBtn.innerHTML = '<span class="loading">Signing in...</span>';

    // Open auth window using the main app
    const authUrl = api.getAuthUrl();

    // Use chrome.identity for auth flow
    chrome.identity.launchWebAuthFlow(
      { url: authUrl, interactive: true },
      async (redirectUrl) => {
        if (chrome.runtime.lastError || !redirectUrl) {
          console.error('Auth error:', chrome.runtime.lastError);
          resetLoginButton();
          return;
        }

        try {
          // Extract user data from redirect URL
          const url = new URL(redirectUrl);
          const userId = url.searchParams.get('userId');
          const userName = url.searchParams.get('name');
          const userEmail = url.searchParams.get('email');
          const userPicture = url.searchParams.get('picture');

          if (userId) {
            const user = {
              id: userId,
              name: userName || 'User',
              email: userEmail || '',
              picture: userPicture || ''
            };

            await storage.setUser(user);
            currentUser = user;
            showMainView();
            await loadUserQuota();
            detectCurrentVideo();
          } else {
            console.error('No userId in redirect');
            resetLoginButton();
          }
        } catch (parseError) {
          console.error('Error parsing auth response:', parseError);
          resetLoginButton();
        }
      }
    );
  } catch (error) {
    console.error('Login error:', error);
    resetLoginButton();
  }
}

function resetLoginButton() {
  loginBtn.disabled = false;
  loginBtn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    Sign in with Google
  `;
}

async function handleLogout() {
  await storage.clear();
  currentUser = null;
  currentVideo = null;
  showLoginView();
}

// Video Detection
async function detectCurrentVideo() {
  try {
    // Query the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    console.log('[Popup] Active tab:', tab?.url);

    if (tab && tab.url && tab.url.includes('youtube.com/watch')) {
      // Extract video ID from URL
      const url = new URL(tab.url);
      const videoId = url.searchParams.get('v');
      console.log('[Popup] Video ID:', videoId);

      if (videoId) {
        updateStatus('detecting', 'Fetching video info...');

        // Try content script first, with timeout fallback
        try {
          chrome.tabs.sendMessage(tab.id, { type: 'GET_VIDEO_INFO' }, (response) => {
            if (chrome.runtime.lastError) {
              console.log('[Popup] Content script error, using fallback:', chrome.runtime.lastError.message);
              fetchVideoInfo(videoId);
              return;
            }
            if (response && response.success) {
              console.log('[Popup] Got video info from content script');
              handleVideoDetected(response.data);
            } else {
              console.log('[Popup] No response from content script, using fallback');
              fetchVideoInfo(videoId);
            }
          });
        } catch (e) {
          console.log('[Popup] sendMessage error, using fallback');
          fetchVideoInfo(videoId);
        }

        // Fallback timeout - if nothing happens in 2 seconds, fetch directly
        setTimeout(() => {
          if (!currentVideo) {
            console.log('[Popup] Timeout, fetching video info directly');
            fetchVideoInfo(videoId);
          }
        }, 2000);
      }
    } else {
      updateStatus('error', 'Open a YouTube video to start');
      videoInfo.classList.add('hidden');
    }
  } catch (error) {
    console.error('Video detection error:', error);
    updateStatus('error', 'Could not detect video');
  }
}

async function fetchVideoInfo(videoId) {
  // Prevent duplicate fetches
  if (currentVideo && currentVideo.videoId === videoId) return;

  console.log('[Popup] Fetching video info for:', videoId);
  try {
    // Use YouTube oEmbed API (no API key needed)
    const response = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
    );

    if (response.ok) {
      const data = await response.json();
      handleVideoDetected({
        videoId,
        title: data.title,
        channel: data.author_name,
        thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
      });
    } else {
      updateStatus('error', 'Could not fetch video info');
    }
  } catch (error) {
    console.error('Fetch video info error:', error);
    updateStatus('error', 'Network error');
  }
}

async function handleVideoDetected(data) {
  currentVideo = data;

  updateStatus('ready', 'Ready to answer questions');

  // Update video info display
  videoInfo.classList.remove('hidden');
  videoThumbnail.src = data.thumbnail || `https://img.youtube.com/vi/${data.videoId}/mqdefault.jpg`;
  videoTitle.textContent = data.title || 'YouTube Video';
  videoChannel.textContent = data.channel || 'Unknown Channel';

  // Enable input
  questionInput.disabled = false;

  // Load saved chat history for this video
  await loadChatHistory(data.videoId);

  // Check for pending answer from previous session
  await checkPendingAnswer(data.videoId);
}

/**
 * Check if there's a pending answer from a previous popup session
 */
async function checkPendingAnswer(videoId) {
  try {
    const pending = await new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_PENDING_ANSWER', videoId }, resolve);
    });

    if (!pending) return;

    console.log('[Popup] Found pending answer status:', pending.status);

    // Check if this question is already in chat history (avoid duplicates)
    const questionAlreadyInHistory = chatHistory.some(msg =>
      msg.type === 'user' && msg.content === pending.question
    );

    if (pending.status === 'processing') {
      // Still processing - show loading and wait
      const timeSinceStart = Date.now() - pending.startedAt;
      if (timeSinceStart < 60000) { // Less than 1 minute old
        // Only add question if not already shown
        if (!questionAlreadyInHistory) {
          restoreMessage(pending.question, 'user');
          chatHistory.push({ content: pending.question, type: 'user', timestamps: [] });
        }
        const loadingId = addLoadingMessage();

        // Poll for completion
        const checkInterval = setInterval(async () => {
          const updated = await new Promise((resolve) => {
            chrome.runtime.sendMessage({ type: 'GET_PENDING_ANSWER', videoId }, resolve);
          });

          if (updated && updated.status === 'completed') {
            clearInterval(checkInterval);
            removeMessage(loadingId);
            const timestamps = extractTimestamps(updated.answer);
            addMessage(updated.answer, 'assistant', timestamps);
            chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ANSWER', videoId });
          } else if (updated && updated.status === 'error') {
            clearInterval(checkInterval);
            removeMessage(loadingId);
            addMessage(updated.error || 'Failed to get answer', 'assistant');
            chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ANSWER', videoId });
          }
        }, 1000);
      } else {
        // Too old, clear it
        chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ANSWER', videoId });
      }
    } else if (pending.status === 'completed') {
      // Completed while popup was closed - check if not already in chat history
      const answerAlreadyShown = chatHistory.some(msg =>
        msg.type === 'assistant' && msg.content === pending.answer
      );

      if (!answerAlreadyShown) {
        // Only add question if not already shown
        if (!questionAlreadyInHistory) {
          addMessage(pending.question, 'user');
        }
        const timestamps = extractTimestamps(pending.answer);
        addMessage(pending.answer, 'assistant', timestamps);
      }
      chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ANSWER', videoId });
    } else if (pending.status === 'error') {
      // Show error if recent and not already shown
      const timeSinceFail = Date.now() - pending.failedAt;
      if (timeSinceFail < 30000 && !questionAlreadyInHistory) {
        addMessage(pending.question, 'user');
        addMessage(pending.error || 'Failed to get answer. Please try again.', 'assistant');
      }
      chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ANSWER', videoId });
    }
  } catch (error) {
    console.error('[Popup] Error checking pending answer:', error);
  }
}

function updateStatus(status, text) {
  const icon = videoStatus.querySelector('.status-icon');
  icon.className = `status-icon ${status}`;
  statusText.textContent = text;

  // Update icon based on status
  if (status === 'ready') {
    icon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `;
  } else if (status === 'error') {
    icon.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `;
  }
}

// Chat
function handleInputChange() {
  const hasText = questionInput.value.trim().length > 0;
  sendBtn.disabled = !hasText || !currentVideo || isProcessing;

  // Auto-resize textarea
  questionInput.style.height = 'auto';
  questionInput.style.height = Math.min(questionInput.scrollHeight, 80) + 'px';
}

async function handleSendQuestion() {
  const question = questionInput.value.trim();
  if (!question || !currentVideo || isProcessing || !currentUser) return;

  isProcessing = true;
  sendBtn.disabled = true;

  // Clear welcome message if present
  const welcomeMsg = messages.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }

  // Add user message
  addMessage(question, 'user');
  questionInput.value = '';
  handleInputChange();

  // Add loading message
  const loadingId = addLoadingMessage();

  try {
    // Try to fetch transcript client-side first (bypasses server IP blocking)
    let transcript = null;
    let videoLanguage = null;
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[Popup] Fetching transcript from tab:', tab?.id, tab?.url);

      if (tab && tab.id) {
        const transcriptResult = await new Promise((resolve) => {
          const timeout = setTimeout(() => {
            console.log('[Popup] Transcript fetch timeout (5s)');
            resolve(null);
          }, 5000);

          chrome.tabs.sendMessage(tab.id, { type: 'GET_TRANSCRIPT' }, (response) => {
            clearTimeout(timeout);
            if (chrome.runtime.lastError) {
              console.log('[Popup] Transcript fetch error:', chrome.runtime.lastError.message);
              // Try to inject content script manually
              console.log('[Popup] Content script may not be loaded. Try refreshing the YouTube page.');
              resolve(null);
            } else {
              resolve(response);
            }
          });
        });

        if (transcriptResult && transcriptResult.success) {
          console.log('[Popup] ✓ Got transcript client-side:', transcriptResult.charCount, 'chars, lang:', transcriptResult.language);
          transcript = transcriptResult.text;
          videoLanguage = transcriptResult.language; // Caption language from YouTube

          // Store language in currentVideo for persistence
          if (currentVideo && videoLanguage) {
            currentVideo.language = videoLanguage;
          }

          // Update UI prompts to match video language
          if (videoLanguage) {
            updateSuggestedQuestions(videoLanguage);
          }
        } else {
          console.log('[Popup] ✗ Client-side transcript failed:', transcriptResult?.error || 'no response from content script');
        }
      } else {
        console.log('[Popup] No active tab found');
      }
    } catch (transcriptErr) {
      console.log('[Popup] Transcript error:', transcriptErr.message);
    }

    // Log what we're sending
    console.log('[Popup] Sending to backend - transcript:', transcript ? transcript.length + ' chars' : 'none', ', lang:', videoLanguage || 'none');

    // Convert chatHistory to backend format (pairs of {question, answer})
    const backendChatHistory = [];
    for (let i = 0; i < chatHistory.length - 1; i++) {
      if (chatHistory[i].type === 'user' && chatHistory[i + 1]?.type === 'assistant') {
        backendChatHistory.push({
          question: chatHistory[i].content,
          answer: chatHistory[i + 1].content
        });
        i++; // Skip the answer since we paired it
      }
    }

    // Use background service worker to process (survives popup close)
    const response = await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'ASK_QUESTION',
        data: {
          videoId: currentVideo.videoId,
          question,
          videoTitle: currentVideo.title,
          channelName: currentVideo.channel,
          transcript,
          videoLanguage,
          userId: currentUser.id,
          chatHistory: backendChatHistory // Send conversation history
        }
      }, (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (result && result.success) {
          resolve(result);
        } else {
          reject(new Error(result?.error || 'Failed to get answer'));
        }
      });
    });

    // Remove loading message
    removeMessage(loadingId);

    // Extract timestamps from response
    const timestamps = extractTimestamps(response.answer);

    // Add assistant response
    addMessage(response.answer, 'assistant', timestamps);

    // Clear pending answer since we displayed it
    chrome.runtime.sendMessage({ type: 'CLEAR_PENDING_ANSWER', videoId: currentVideo.videoId });

    // Update quota
    await loadUserQuota();

  } catch (error) {
    console.error('Question error:', error);
    removeMessage(loadingId);

    // Show appropriate error message
    const errorMsg = error.message || 'Something went wrong. Please try again.';
    addMessage(errorMsg, 'assistant');
  } finally {
    isProcessing = false;
    handleInputChange();
  }
}

/**
 * Extract timestamps from answer text
 */
function extractTimestamps(text) {
  const timestamps = [];
  const regex = /\[?(\d{1,2}):(\d{2})(?::(\d{2}))?\]?/g;
  let match;

  while ((match = regex.exec(text)) !== null) {
    let seconds;
    if (match[3]) {
      seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
    } else {
      seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
    }

    timestamps.push({
      label: match[0].replace(/[\[\]]/g, ''),
      seconds,
      index: match.index
    });
  }

  return timestamps;
}

function addMessage(content, type, timestamps = []) {
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.id = `msg-${Date.now()}`;

  // For assistant messages, render markdown; for user messages, escape HTML
  let html = type === 'assistant' ? simpleMarkdown(content) : escapeHtml(content);

  // Add clickable timestamps for assistant messages
  if (type === 'assistant' && timestamps && timestamps.length > 0) {
    html += '<div class="timestamps">';
    timestamps.forEach(ts => {
      html += `<span class="timestamp" data-time="${ts.seconds}">${escapeHtml(ts.label)}</span>`;
    });
    html += '</div>';
  }

  messageEl.innerHTML = html;

  // Add click handlers for timestamps
  if (type === 'assistant') {
    messageEl.querySelectorAll('.timestamp').forEach(el => {
      el.addEventListener('click', () => {
        const time = parseInt(el.dataset.time);
        seekVideo(time);
      });
    });
  }

  messages.appendChild(messageEl);
  messages.scrollTop = messages.scrollHeight;

  // Save to chat history (for persistence)
  chatHistory.push({ content, type, timestamps });
  if (currentVideo) {
    saveChatHistory(currentVideo.videoId);
  }

  // Show export button when we have chat history
  updateExportButton();

  return messageEl.id;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Simple markdown to HTML converter for assistant messages
function simpleMarkdown(text) {
  if (!text) return '';

  // Strip reference lines (we show timestamps separately)
  // Matches: "Références: [2:19], [5:17]" or "References: [1:23], [4:56]" etc.
  let cleanText = text
    .replace(/\n*R[ée]f[ée]rences?\s*:?\s*(\[\d+:\d+\],?\s*)+\.?/gi, '')
    .replace(/\n*References?\s*:?\s*(\[\d+:\d+\],?\s*)+\.?/gi, '')
    .trim();

  // First escape HTML to prevent XSS
  let html = escapeHtml(cleanText);

  // Headers: ## Header -> <h3>Header</h3>
  html = html.replace(/^###\s+(.+)$/gm, '<h4 class="md-header">$1</h4>');
  html = html.replace(/^##\s+(.+)$/gm, '<h3 class="md-header">$1</h3>');
  html = html.replace(/^#\s+(.+)$/gm, '<h3 class="md-header">$1</h3>');

  // Emoji headers (🎯 Strategy, etc.) - make them bold headers
  html = html.replace(/^([\u{1F300}-\u{1F9FF}])\s+(.+)$/gmu, '<div class="md-section"><strong>$1 $2</strong></div>');

  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

  // Inline code: `code`
  html = html.replace(/`([^`]+)`/g, '<code class="md-code">$1</code>');

  // Process lists with proper paragraph breaks
  const lines = html.split('\n');
  let result = [];
  let inBulletList = false;
  let inNumberedList = false;

  // Helper to check if a line is a numbered list item
  const isNumberedItem = (line) => /^(\d+)[.)]\s+.+/.test(line?.trim() || '');
  const isBulletItem = (line) => /^[-•]\s+.+/.test(line?.trim() || '');

  // Helper to find next non-empty line
  const peekNextContent = (fromIndex) => {
    for (let j = fromIndex + 1; j < lines.length; j++) {
      if (lines[j].trim()) return lines[j].trim();
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      // Empty line - check if we should keep the list open
      if (inNumberedList) {
        // Peek ahead: if next content is also a numbered item, keep list open
        const nextContent = peekNextContent(i);
        if (nextContent && isNumberedItem(nextContent)) {
          // Stay in list, just add spacing
          continue;
        }
        // Otherwise close the list
        result.push('</ol>');
        inNumberedList = false;
      }
      if (inBulletList) {
        const nextContent = peekNextContent(i);
        if (nextContent && isBulletItem(nextContent)) {
          continue;
        }
        result.push('</ul>');
        inBulletList = false;
      }
      result.push('</p><p class="md-para">');
      continue;
    }

    const bulletMatch = line.match(/^[-•]\s+(.+)/);
    const numberedMatch = line.match(/^(\d+)[.)]\s+(.+)/);

    if (bulletMatch) {
      if (!inBulletList) {
        if (inNumberedList) { result.push('</ol>'); inNumberedList = false; }
        result.push('<ul class="md-list">');
        inBulletList = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
    } else if (numberedMatch) {
      if (!inNumberedList) {
        if (inBulletList) { result.push('</ul>'); inBulletList = false; }
        result.push('<ol class="md-list">');
        inNumberedList = true;
      }
      result.push(`<li>${numberedMatch[2]}</li>`);
    } else {
      if (inBulletList) { result.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { result.push('</ol>'); inNumberedList = false; }
      result.push(line);
    }
  }
  if (inBulletList) result.push('</ul>');
  if (inNumberedList) result.push('</ol>');

  html = result.join('\n');

  // Convert remaining single newlines to line breaks (for paragraph flow)
  html = html.replace(/([^>])\n([^<])/g, '$1<br>$2');

  // Clean up multiple paragraph tags
  html = html.replace(/(<\/p>\s*<p class="md-para">)+/g, '</p><p class="md-para">');
  html = html.replace(/<p class="md-para"><\/p>/g, '');
  html = html.replace(/<br>\s*<br>/g, '</p><p class="md-para">');

  // Wrap in paragraph
  if (html && !html.match(/^<(p|ul|ol|h[34]|div)/)) {
    html = '<p class="md-para">' + html + '</p>';
  }

  // Final cleanup
  html = html.replace(/<p class="md-para">\s*<\/p>/g, '');
  html = html.replace(/^\s*<br>|<br>\s*$/g, '');
  html = html.replace(/<\/p>\s*$/, '</p>');

  return html;
}

function addLoadingMessage() {
  const messageEl = document.createElement('div');
  messageEl.className = 'message assistant loading';
  messageEl.id = `msg-loading-${Date.now()}`;
  messageEl.innerHTML = `
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  `;
  messages.appendChild(messageEl);
  messages.scrollTop = messages.scrollHeight;
  return messageEl.id;
}

function removeMessage(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

async function seekVideo(seconds) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'SEEK_VIDEO', time: seconds });
    }
  } catch (error) {
    console.error('Seek error:', error);
  }
}

// Quota
async function loadUserQuota() {
  if (!currentUser || !currentUser.id) return;

  try {
    const quota = await api.getQuota(currentUser.id);

    currentUser.quota = quota;
    currentUser.plan = quota.plan;
    await storage.setUser(currentUser);

    quotaText.textContent = `${quota.questions}/${quota.limit} questions`;
  } catch (error) {
    console.error('Quota error:', error);
    // Set defaults for anonymous/new users
    const defaultLimit = currentUser.isAnonymous ? 5 : 500;
    quotaText.textContent = `0/${defaultLimit} questions`;
  }
}

// Chat Persistence
async function loadChatHistory(videoId) {
  try {
    const result = await chrome.storage.local.get(`chat_${videoId}`);
    const savedChat = result[`chat_${videoId}`];

    if (savedChat && savedChat.messages && savedChat.messages.length > 0) {
      console.log('[Popup] Restoring', savedChat.messages.length, 'messages for video', videoId);
      chatHistory = savedChat.messages;

      // Clear existing messages (remove welcome for restored chats)
      messages.innerHTML = '';

      // Restore messages
      for (const msg of chatHistory) {
        restoreMessage(msg.content, msg.type, msg.timestamps || []);
      }

      // Scroll to bottom to show last message
      requestAnimationFrame(() => {
        messages.scrollTop = messages.scrollHeight;
      });

      // Show export button for restored chats
      updateExportButton();
    } else {
      // Clear chat for new video
      chatHistory = [];
      clearMessages();
      updateExportButton();
    }
  } catch (error) {
    console.error('Error loading chat history:', error);
    chatHistory = [];
    updateExportButton();
  }
}

async function saveChatHistory(videoId) {
  if (!videoId) return;

  try {
    await chrome.storage.local.set({
      [`chat_${videoId}`]: {
        messages: chatHistory,
        timestamp: Date.now()
      }
    });
    console.log('[Popup] Saved', chatHistory.length, 'messages for video', videoId);
  } catch (error) {
    console.error('Error saving chat history:', error);
  }
}

function restoreMessage(content, type, timestamps = []) {
  // Similar to addMessage but doesn't save (to avoid loop)
  const messageEl = document.createElement('div');
  messageEl.className = `message ${type}`;
  messageEl.id = `msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  let html = type === 'assistant' ? simpleMarkdown(content) : escapeHtml(content);

  if (type === 'assistant' && timestamps && timestamps.length > 0) {
    html += '<div class="timestamps">';
    timestamps.forEach(ts => {
      html += `<span class="timestamp" data-time="${ts.seconds}">${escapeHtml(ts.label)}</span>`;
    });
    html += '</div>';
  }

  messageEl.innerHTML = html;

  if (type === 'assistant') {
    messageEl.querySelectorAll('.timestamp').forEach(el => {
      el.addEventListener('click', () => {
        const time = parseInt(el.dataset.time);
        seekVideo(time);
      });
    });
  }

  messages.appendChild(messageEl);
}

function clearMessages() {
  messages.innerHTML = '';

  // Recreate welcome message with proper structure
  const welcome = document.createElement('div');
  welcome.className = 'welcome-message';
  welcome.innerHTML = `
    <p id="welcomeText">Ask any question about this video!</p>
    <div id="suggestedQuestions" class="suggested-questions"></div>
  `;
  messages.appendChild(welcome);

  // Populate with language-appropriate prompts
  const videoLang = currentVideo?.language || 'en';
  updateSuggestedQuestions(videoLang);

  // Hide export button when no messages
  updateExportButton();
}

/**
 * Show/hide export button based on chat history
 */
function updateExportButton() {
  if (exportBtn) {
    if (chatHistory && chatHistory.length > 0) {
      exportBtn.classList.remove('hidden');
    } else {
      exportBtn.classList.add('hidden');
    }
  }
}

/**
 * Export chat conversation as PDF using browser print dialog
 */
function exportChatAsPDF() {
  if (!chatHistory || chatHistory.length === 0) {
    alert('No conversation to export yet. Ask a question first!');
    return;
  }

  // Get video info - prefer DOM elements (always up to date) over currentVideo state
  const videoTitleEl = document.getElementById('videoTitle');
  const videoChannelEl = document.getElementById('videoChannel');
  const videoThumbnailEl = document.getElementById('videoThumbnail');

  const videoTitleText = videoTitleEl?.textContent || currentVideo?.title || 'YouTube Video';
  const videoChannelText = videoChannelEl?.textContent || currentVideo?.channel || '';
  const videoId = currentVideo?.videoId || '';
  const videoUrl = videoId ? `https://youtube.com/watch?v=${videoId}` : '';
  const thumbnailUrl = videoThumbnailEl?.src || (videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : '');
  const exportDate = new Date().toLocaleDateString();

  let conversationHtml = '';
  for (const msg of chatHistory) {
    const role = msg.type === 'user' ? 'You' : 'Lurnia';
    const roleClass = msg.type === 'user' ? 'user-msg' : 'assistant-msg';
    const content = msg.type === 'assistant' ? simpleMarkdownForPdf(msg.content) : escapeHtml(msg.content);
    conversationHtml += `
      <div class="message ${roleClass}">
        <div class="role">${role}</div>
        <div class="content">${content}</div>
      </div>
    `;
  }

  const printHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Lurnia Chat - ${escapeHtml(videoTitleText)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .header {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 16px;
      padding: 24px;
      margin-bottom: 32px;
      color: white;
    }
    .header-top {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
    }
    .logo-icon {
      width: 40px;
      height: 40px;
      background: rgba(255,255,255,0.2);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .logo-icon svg {
      width: 24px;
      height: 24px;
    }
    .logo-text {
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }
    .video-card {
      background: white;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      gap: 16px;
      color: #1a1a1a;
    }
    .video-thumbnail {
      width: 120px;
      height: 68px;
      border-radius: 8px;
      object-fit: cover;
      background: #e2e8f0;
      flex-shrink: 0;
    }
    .video-details {
      flex: 1;
      min-width: 0;
    }
    .video-title {
      font-size: 15px;
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
      line-height: 1.3;
    }
    .video-channel {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 6px;
    }
    .video-link {
      font-size: 11px;
      color: #3b82f6;
      text-decoration: none;
      word-break: break-all;
    }
    .meta {
      font-size: 12px;
      color: rgba(255,255,255,0.8);
      margin-top: 16px;
      text-align: right;
    }
    .conversation-header {
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 2px solid #e2e8f0;
    }
    .conversation {
      margin-top: 8px;
    }
    .message {
      margin-bottom: 20px;
      page-break-inside: avoid;
    }
    .role {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }
    .user-msg .role { color: #3b82f6; }
    .assistant-msg .role { color: #8b5cf6; }
    .content {
      background: #f8fafc;
      padding: 14px 18px;
      border-radius: 12px;
      font-size: 14px;
      line-height: 1.6;
    }
    .user-msg .content {
      background: linear-gradient(135deg, #eff6ff, #f0f9ff);
      border-left: 3px solid #3b82f6;
    }
    .assistant-msg .content {
      background: linear-gradient(135deg, #faf5ff, #f5f3ff);
      border-left: 3px solid #8b5cf6;
    }
    .content p { margin-bottom: 10px; }
    .content p:last-child { margin-bottom: 0; }
    .content ul, .content ol {
      margin: 10px 0;
      padding-left: 24px;
    }
    .content li { margin-bottom: 6px; }
    .content strong { font-weight: 600; }
    .content em { font-style: italic; }
    .content code {
      background: #e2e8f0;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: 'SF Mono', Monaco, monospace;
      font-size: 13px;
    }
    .footer {
      margin-top: 48px;
      padding-top: 24px;
      border-top: 2px solid #e2e8f0;
      text-align: center;
    }
    .footer-logo {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
    }
    .footer-logo-icon {
      width: 20px;
      height: 20px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 5px;
    }
    .footer-text {
      font-size: 12px;
      color: #94a3b8;
    }
    .footer a {
      color: #3b82f6;
      text-decoration: none;
    }
    @media print {
      body { padding: 20px; }
      .header { break-inside: avoid; }
      .message { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-top">
      <div class="logo-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
      <span class="logo-text">Lurnia</span>
    </div>
    <div class="video-card">
      ${thumbnailUrl ? `<img class="video-thumbnail" src="${thumbnailUrl}" alt="Video thumbnail">` : ''}
      <div class="video-details">
        <div class="video-title">${escapeHtml(videoTitleText)}</div>
        ${videoChannelText ? `<div class="video-channel">${escapeHtml(videoChannelText)}</div>` : ''}
        ${videoUrl ? `<a class="video-link" href="${videoUrl}">${videoUrl}</a>` : ''}
      </div>
    </div>
    <div class="meta">Exported on ${exportDate}</div>
  </div>
  <div class="conversation-header">Conversation</div>
  <div class="conversation">
    ${conversationHtml}
  </div>
  <div class="footer">
    <div class="footer-logo">
      <div class="footer-logo-icon"></div>
      <span style="font-weight: 600; color: #1e293b;">Lurnia</span>
    </div>
    <div class="footer-text">
      AI-powered YouTube learning assistant<br>
      <a href="https://lurnia.app">lurnia.app</a>
    </div>
  </div>
</body>
</html>
  `;

  // Open print window
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (printWindow) {
    printWindow.document.write(printHtml);
    printWindow.document.close();

    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      printWindow.print();
    };
  } else {
    alert('Please allow popups to export the chat as PDF.');
  }
}

/**
 * Simple markdown converter for PDF export (similar to simpleMarkdown but cleaner)
 */
function simpleMarkdownForPdf(text) {
  if (!text) return '';

  // Strip reference lines
  let cleanText = text
    .replace(/\n*R[ée]f[ée]rences?\s*:?\s*(\[\d+:\d+\],?\s*)+\.?/gi, '')
    .replace(/\n*References?\s*:?\s*(\[\d+:\d+\],?\s*)+\.?/gi, '')
    .trim();

  let html = escapeHtml(cleanText);

  // Headers
  html = html.replace(/^###\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^##\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^#\s+(.+)$/gm, '<h3>$1</h3>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  html = html.replace(/(?<!_)_([^_\n]+)_(?!_)/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Process lists
  const lines = html.split('\n');
  let result = [];
  let inBulletList = false;
  let inNumberedList = false;

  // Helper to check if a line is a numbered list item
  const isNumberedItem = (line) => /^(\d+)[.)]\s+.+/.test(line?.trim() || '');
  const isBulletItem = (line) => /^[-•]\s+.+/.test(line?.trim() || '');

  // Helper to find next non-empty line
  const peekNextContent = (fromIndex) => {
    for (let j = fromIndex + 1; j < lines.length; j++) {
      if (lines[j].trim()) return lines[j].trim();
    }
    return null;
  };

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      // Check if we should keep the list open
      if (inNumberedList) {
        const nextContent = peekNextContent(i);
        if (nextContent && isNumberedItem(nextContent)) {
          continue; // Stay in list
        }
        result.push('</ol>');
        inNumberedList = false;
      }
      if (inBulletList) {
        const nextContent = peekNextContent(i);
        if (nextContent && isBulletItem(nextContent)) {
          continue;
        }
        result.push('</ul>');
        inBulletList = false;
      }
      result.push('<br>');
      continue;
    }

    const bulletMatch = trimmed.match(/^[-•]\s+(.+)/);
    const numberedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)/);

    if (bulletMatch) {
      if (!inBulletList) {
        if (inNumberedList) { result.push('</ol>'); inNumberedList = false; }
        result.push('<ul>');
        inBulletList = true;
      }
      result.push(`<li>${bulletMatch[1]}</li>`);
    } else if (numberedMatch) {
      if (!inNumberedList) {
        if (inBulletList) { result.push('</ul>'); inBulletList = false; }
        result.push('<ol>');
        inNumberedList = true;
      }
      result.push(`<li>${numberedMatch[2]}</li>`);
    } else {
      if (inBulletList) { result.push('</ul>'); inBulletList = false; }
      if (inNumberedList) { result.push('</ol>'); inNumberedList = false; }
      result.push(`<p>${trimmed}</p>`);
    }
  }
  if (inBulletList) result.push('</ul>');
  if (inNumberedList) result.push('</ol>');

  return result.join('\n');
}

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
