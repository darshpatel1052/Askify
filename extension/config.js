// Configuration file for Askify Chrome Extension
// Change these settings before building the extension

const CONFIG = {
    // API Base URL
    // In development: http://localhost:8000/api/v1
    // In production: Your deployed API URL
    API_BASE_URL: 'http://localhost:8000/api/v1',

    // Default settings
    DEFAULT_THEME: 'system',      // Options: 'light', 'dark', 'system'
    DEFAULT_FONT_SIZE: 'medium',  // Options: 'small', 'medium', 'large'
    DEFAULT_MAX_HISTORY: 5,       // Number of history items to display
    DEFAULT_OFFLINE_MODE: false,  // Whether to enable offline mode by default

    // Debug settings
    DEBUG: true,                  // Enable/disable debug logging

    // Version info
    VERSION: '1.0.0'
};

// Make it compatible with both module imports and plain JavaScript
// This way it can be used in both background.js and popup.js
try {
    if (typeof module !== 'undefined' && module.exports) {
        // CommonJS/Node.js
        module.exports = CONFIG;
    } else if (typeof exports !== 'undefined') {
        // CommonJS
        exports.CONFIG = CONFIG;
    } else if (typeof window !== 'undefined') {
        // Browser
        window.CONFIG = CONFIG;
    }
} catch (e) {
    // Ignore any errors, just make sure CONFIG is available globally
    console.debug('Config module setup error (harmless):', e);
}
