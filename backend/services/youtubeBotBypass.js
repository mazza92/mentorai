const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

/**
 * YouTube Bot Bypass Service
 *
 * Automatically handles YouTube's bot detection by:
 * 1. Using real browser (Puppeteer) to extract fresh cookies
 * 2. Rotating user agents and headers
 * 3. Implementing retry logic with exponential backoff
 * 4. Auto-refreshing cookies when they expire or get rotated
 *
 * Similar to our custom transcript scraper approach
 */
class YouTubeBotBypass {
  constructor() {
    this.browser = null;
    this.cookiesCache = null;
    this.cookiesCacheTime = null;
    this.cookiesCacheDuration = 30 * 60 * 1000; // 30 minutes
    this.isRefreshing = false;

    // User agents pool for rotation
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    ];

    console.log('[YouTubeBotBypass] Service initialized');
  }

  /**
   * Get random user agent
   */
  getRandomUserAgent() {
    return this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
  }

  /**
   * Initialize Puppeteer browser
   */
  async initBrowser() {
    if (this.browser) {
      try {
        // Check if browser is still connected
        await this.browser.version();
        return this.browser;
      } catch (error) {
        console.log('[YouTubeBotBypass] Browser disconnected, reinitializing...');
        this.browser = null;
      }
    }

    console.log('[YouTubeBotBypass] Launching headless browser...');

    this.browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
        '--window-size=1920,1080',
        '--disable-blink-features=AutomationControlled', // Hide automation
        '--disable-web-security',
        '--disable-features=IsolateOrigins,site-per-process'
      ],
      ignoreDefaultArgs: ['--enable-automation'], // Hide automation
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    });

    console.log('[YouTubeBotBypass] ✓ Browser launched');
    return this.browser;
  }

  /**
   * Extract fresh cookies from YouTube using Puppeteer
   */
  async extractFreshCookies() {
    const startTime = Date.now();
    console.log('[YouTubeBotBypass] Extracting fresh cookies from YouTube...');

    try {
      const browser = await this.initBrowser();
      const page = await browser.newPage();

      // Set random user agent
      const userAgent = this.getRandomUserAgent();
      await page.setUserAgent(userAgent);

      // Set extra headers to appear more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Cache-Control': 'max-age=0'
      });

      // Hide webdriver property
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined
        });

        // Add chrome property
        window.chrome = {
          runtime: {}
        };

        // Override permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: Notification.permission }) :
            originalQuery(parameters)
        );
      });

      console.log('[YouTubeBotBypass] Navigating to YouTube...');

      // Navigate to YouTube homepage with timeout
      await page.goto('https://www.youtube.com', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait a bit for cookies to be set
      await page.waitForTimeout(2000);

      // Scroll down to trigger more cookie setting
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
      });

      await page.waitForTimeout(1000);

      // Extract cookies
      const cookies = await page.cookies();

      console.log(`[YouTubeBotBypass] ✓ Extracted ${cookies.length} cookies`);

      // Convert to Netscape format (yt-dlp compatible)
      const netscapeCookies = this.convertToNetscapeFormat(cookies);

      await page.close();

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[YouTubeBotBypass] ✓ Fresh cookies extracted in ${elapsed}s`);

      return {
        success: true,
        cookies: netscapeCookies,
        cookiesArray: cookies,
        userAgent
      };

    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.error(`[YouTubeBotBypass] ✗ Failed to extract cookies after ${elapsed}s:`, error.message);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Convert cookies to Netscape format for yt-dlp
   */
  convertToNetscapeFormat(cookies) {
    let netscape = '# Netscape HTTP Cookie File\n';
    netscape += '# This file was generated by YouTubeBotBypass\n';
    netscape += '# Edit at your own risk\n\n';

    for (const cookie of cookies) {
      // Netscape format: domain, flag, path, secure, expiration, name, value
      const domain = cookie.domain.startsWith('.') ? cookie.domain : '.' + cookie.domain;
      const flag = 'TRUE'; // domain flag
      const path = cookie.path || '/';
      const secure = cookie.secure ? 'TRUE' : 'FALSE';
      const expiration = cookie.expires || 0;
      const name = cookie.name;
      const value = cookie.value;

      netscape += `${domain}\t${flag}\t${path}\t${secure}\t${expiration}\t${name}\t${value}\n`;
    }

    return netscape;
  }

  /**
   * Get fresh cookies (with caching)
   */
  async getFreshCookies(forceRefresh = false) {
    // Return cached cookies if still valid
    if (!forceRefresh && this.cookiesCache && this.cookiesCacheTime) {
      const age = Date.now() - this.cookiesCacheTime;
      if (age < this.cookiesCacheDuration) {
        const minutesLeft = Math.floor((this.cookiesCacheDuration - age) / 60000);
        console.log(`[YouTubeBotBypass] Using cached cookies (${minutesLeft}min left)`);
        return this.cookiesCache;
      }
    }

    // Prevent multiple simultaneous refresh attempts
    if (this.isRefreshing) {
      console.log('[YouTubeBotBypass] Cookie refresh already in progress, waiting...');
      // Wait for refresh to complete
      while (this.isRefreshing) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      return this.cookiesCache;
    }

    this.isRefreshing = true;

    try {
      const result = await this.extractFreshCookies();

      if (result.success) {
        this.cookiesCache = result.cookies;
        this.cookiesCacheTime = Date.now();
        console.log('[YouTubeBotBypass] ✓ Cookies cached for 30 minutes');
      }

      return result.cookies;
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Save cookies to file (for yt-dlp)
   */
  async saveCookiesToFile(cookies, filename = null) {
    try {
      const cookiesPath = filename || path.join('/tmp', `yt-cookies-${Date.now()}.txt`);
      fs.writeFileSync(cookiesPath, cookies);
      console.log(`[YouTubeBotBypass] ✓ Cookies saved to ${cookiesPath}`);
      return cookiesPath;
    } catch (error) {
      console.error('[YouTubeBotBypass] ✗ Failed to save cookies:', error.message);
      throw error;
    }
  }

  /**
   * Execute yt-dlp command with fresh cookies and retry logic
   */
  async executeWithRetry(command, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.baseDelay || 2000;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[YouTubeBotBypass] Attempt ${attempt}/${maxRetries}...`);

        // Get fresh cookies
        const cookies = await this.getFreshCookies(attempt > 1); // Force refresh on retry

        // Save to temp file
        const cookiesPath = await this.saveCookiesToFile(cookies);

        // Execute command with cookies
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);

        const fullCommand = command.replace('{{cookies}}', cookiesPath);
        console.log(`[YouTubeBotBypass] Executing: ${fullCommand.substring(0, 150)}...`);

        const result = await execAsync(fullCommand, {
          timeout: options.timeout || 60000,
          maxBuffer: options.maxBuffer || 10 * 1024 * 1024
        });

        // Clean up temp cookies
        if (fs.existsSync(cookiesPath)) {
          fs.unlinkSync(cookiesPath);
        }

        console.log(`[YouTubeBotBypass] ✓ Command executed successfully`);
        return result;

      } catch (error) {
        lastError = error;

        // Check if it's a bot detection error
        const isBotDetection = error.stderr && (
          error.stderr.includes('Sign in to confirm') ||
          error.stderr.includes('bot') ||
          error.stderr.includes('cookies are no longer valid')
        );

        if (isBotDetection) {
          console.warn(`[YouTubeBotBypass] ⚠️ Bot detection on attempt ${attempt}`);

          if (attempt < maxRetries) {
            const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff
            console.log(`[YouTubeBotBypass] Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));

            // Force fresh cookies on next attempt
            this.cookiesCache = null;
            continue;
          }
        } else {
          // Not a bot detection error, don't retry
          throw error;
        }
      }
    }

    console.error(`[YouTubeBotBypass] ✗ All ${maxRetries} attempts failed`);
    throw lastError;
  }

  /**
   * Clean up resources
   */
  async cleanup() {
    if (this.browser) {
      console.log('[YouTubeBotBypass] Closing browser...');
      await this.browser.close();
      this.browser = null;
    }
    this.cookiesCache = null;
    this.cookiesCacheTime = null;
  }
}

module.exports = new YouTubeBotBypass();
