/**
 * Rate Limiter with Queue
 * Prevents overwhelming external APIs (Gemini, OpenAI) with too many concurrent requests
 */

class RateLimiter {
  constructor(maxConcurrent = 2, minDelay = 2000) {
    this.maxConcurrent = maxConcurrent; // Max concurrent requests
    this.minDelay = minDelay; // Minimum delay between requests (ms)
    this.queue = [];
    this.activeRequests = 0;
    this.lastRequestTime = 0;
  }

  /**
   * Add a request to the queue
   * @param {Function} fn - Async function to execute
   * @returns {Promise} - Resolves with the function result
   */
  async enqueue(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process the queue
   */
  async processQueue() {
    if (this.activeRequests >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    // Ensure minimum delay between requests
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minDelay) {
      setTimeout(() => this.processQueue(), this.minDelay - timeSinceLastRequest);
      return;
    }

    const { fn, resolve, reject } = this.queue.shift();
    this.activeRequests++;
    this.lastRequestTime = Date.now();

    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeRequests--;
      // Process next item in queue
      this.processQueue();
    }
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      activeRequests: this.activeRequests,
      queuedRequests: this.queue.length,
      maxConcurrent: this.maxConcurrent,
      minDelay: this.minDelay,
    };
  }
}

/**
 * Exponential Backoff Retry
 * Retries a function with exponential backoff
 */
async function retryWithExponentialBackoff(
  fn,
  maxRetries = 3,
  baseDelay = 2000,
  maxDelay = 30000,
  retryOn = [429, 503, 500]
) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      const status = error.response?.status || error.status || 0;
      const shouldRetry = retryOn.includes(status) ||
                         error.message?.includes('overloaded') ||
                         error.message?.includes('rate limit');

      if (!shouldRetry || attempt === maxRetries) {
        throw error;
      }

      // Calculate delay with exponential backoff + jitter
      const exponentialDelay = Math.min(
        baseDelay * Math.pow(2, attempt),
        maxDelay
      );
      const jitter = Math.random() * 1000; // Add 0-1s random jitter
      const delay = exponentialDelay + jitter;

      console.log(
        `Retry attempt ${attempt + 1}/${maxRetries} after ${Math.floor(delay)}ms (error: ${status || error.message})`
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

// Create rate limiters for different services
const geminiRateLimiter = new RateLimiter(2, 3000); // Max 2 concurrent, 3s between requests
const openaiRateLimiter = new RateLimiter(1, 5000); // Max 1 concurrent, 5s between requests (quota limited)

module.exports = {
  RateLimiter,
  retryWithExponentialBackoff,
  geminiRateLimiter,
  openaiRateLimiter,
};
