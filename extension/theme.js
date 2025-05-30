// Theme loader - loads immediately to prevent flicker
// This script should be loaded in the <head> before the body renders

(function () {
    // Apply theme function
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else if (theme === 'light') {
            document.documentElement.removeAttribute('data-theme');
        } else if (theme === 'system') {
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                document.documentElement.removeAttribute('data-theme');
            }
        }
    }

    // Load and apply theme immediately
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.local.get(['theme'], (result) => {
            const theme = result.theme || 'dark'; // Default to dark theme
            applyTheme(theme);
        });
    } else {
        // Fallback for when chrome API is not available - default to dark
        applyTheme('dark');
    }

    // Make applyTheme globally available for other scripts
    window.applyTheme = applyTheme;
})();
