// Lurnia Extension - Storage Module

const STORAGE_KEYS = {
  USER: 'lurnia_user',
  TOKEN: 'lurnia_token',
  SETTINGS: 'lurnia_settings',
  CACHE: 'lurnia_cache'
};

export const storage = {
  /**
   * Get the current user
   */
  async getUser() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.USER, (result) => {
        resolve(result[STORAGE_KEYS.USER] || null);
      });
    });
  },

  /**
   * Save user data
   */
  async setUser(user) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.USER]: user }, resolve);
    });
  },

  /**
   * Get the auth token
   */
  async getToken() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.TOKEN, (result) => {
        resolve(result[STORAGE_KEYS.TOKEN] || null);
      });
    });
  },

  /**
   * Save auth token
   */
  async setToken(token) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: token }, resolve);
    });
  },

  /**
   * Get settings
   */
  async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.SETTINGS, (result) => {
        resolve(result[STORAGE_KEYS.SETTINGS] || getDefaultSettings());
      });
    });
  },

  /**
   * Save settings
   */
  async setSettings(settings) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [STORAGE_KEYS.SETTINGS]: settings }, resolve);
    });
  },

  /**
   * Get cached data for a video
   */
  async getVideoCache(videoId) {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.CACHE, (result) => {
        const cache = result[STORAGE_KEYS.CACHE] || {};
        resolve(cache[videoId] || null);
      });
    });
  },

  /**
   * Cache data for a video
   */
  async setVideoCache(videoId, data) {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEYS.CACHE, (result) => {
        const cache = result[STORAGE_KEYS.CACHE] || {};

        // Keep only last 50 videos in cache
        const videoIds = Object.keys(cache);
        if (videoIds.length >= 50) {
          // Remove oldest entries
          const toRemove = videoIds.slice(0, videoIds.length - 49);
          toRemove.forEach(id => delete cache[id]);
        }

        cache[videoId] = {
          ...data,
          cachedAt: Date.now()
        };

        chrome.storage.local.set({ [STORAGE_KEYS.CACHE]: cache }, resolve);
      });
    });
  },

  /**
   * Clear all storage
   */
  async clear() {
    return new Promise((resolve) => {
      chrome.storage.local.remove(
        [STORAGE_KEYS.USER, STORAGE_KEYS.TOKEN],
        resolve
      );
    });
  },

  /**
   * Clear all data including cache
   */
  async clearAll() {
    return new Promise((resolve) => {
      chrome.storage.local.clear(resolve);
    });
  }
};

function getDefaultSettings() {
  return {
    autoDetect: true,
    showTimestamps: true,
    theme: 'auto'
  };
}

export default storage;
