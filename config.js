/**
 * ENVIRONMENT CONFIGURATION MODULE
 * =========================================================
 * Provides dynamic API base URL configuration with fallback priority:
 * 1. Window variable (window.__APP_CONFIG__.API_BASE_URL)
 * 2. localStorage override (app_api_base_url)
 * 3. Auto-detection based on hostname
 * 4. Hardcoded default (http://localhost:3000/api)
 */

const Config = (() => {
  'use strict';

  /**
   * Get the configured API base URL
   * @returns {string} The API base URL (e.g., "https://api.example.com/api")
   */
  function getApiBaseUrl() {
    // Priority 1: Window variable injected by HTML or Vercel
    if (typeof window !== 'undefined' && window.__APP_CONFIG__ && window.__APP_CONFIG__.API_BASE_URL) {
      return window.__APP_CONFIG__.API_BASE_URL;
    }

    // Priority 2: localStorage override (useful for development/testing)
    if (typeof localStorage !== 'undefined') {
      try {
        const stored = localStorage.getItem('app_api_base_url');
        if (stored && typeof stored === 'string' && stored.trim()) {
          return stored.trim();
        }
      } catch (e) {
        // Silently ignore localStorage errors
      }
    }

    // Priority 3: Auto-detect based on current hostname
    if (typeof window !== 'undefined' && window.location) {
      const protocol = window.location.protocol; // "http:" or "https:"
      const host = window.location.host; // "localhost:1234" or "example.com"

      // Development: localhost should use port 3000 for backend
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return 'http://localhost:3000/api';
      }

      // Production: same domain, /api path
      // e.g., "https://example.com" -> "https://example.com/api"
      return protocol + '//' + host + '/api';
    }

    // Absolute fallback
    return 'http://localhost:3000/api';
  }

  /**
   * Build a complete API URL from a path
   * @param {string} path - The API path (e.g., "/cases/123" or "cases/123")
   * @returns {string} The complete API URL
   */
  function getApiUrl(path) {
    const baseUrl = getApiBaseUrl();
    const cleanPath = String(path || '').startsWith('/') ? path : '/' + path;
    return baseUrl + cleanPath;
  }

  /**
   * Override the API base URL at runtime (useful for development/testing)
   * @param {string} url - The new API base URL
   */
  function setApiBaseUrl(url) {
    if (typeof localStorage !== 'undefined' && typeof url === 'string') {
      try {
        localStorage.setItem('app_api_base_url', url);
        console.log('[Config] API base URL set to:', url);
      } catch (e) {
        console.warn('[Config] Failed to set API base URL:', e);
      }
    }
  }

  /**
   * Clear any localStorage override and revert to defaults
   */
  function clearApiBaseUrl() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('app_api_base_url');
        console.log('[Config] API base URL cleared, using defaults');
      } catch (e) {
        console.warn('[Config] Failed to clear API base URL:', e);
      }
    }
  }

  /**
   * Log current configuration (useful for debugging)
   */
  function logConfig() {
    console.log('[Config] Current API Base URL:', getApiBaseUrl());
    if (typeof window !== 'undefined' && window.location) {
      console.log('[Config] Hostname:', window.location.hostname);
      console.log('[Config] Protocol:', window.location.protocol);
      console.log('[Config] Full URL:', window.location.href);
    }
  }

  // Return public API
  return {
    getApiBaseUrl: getApiBaseUrl,
    getApiUrl: getApiUrl,
    setApiBaseUrl: setApiBaseUrl,
    clearApiBaseUrl: clearApiBaseUrl,
    logConfig: logConfig
  };
})();

// Export for CommonJS or module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Config;
}
