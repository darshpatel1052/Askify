document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-btn');
    const themeSelect = document.getElementById('theme-select');
    const fontSizeSelect = document.getElementById('font-size');
    const maxHistorySelect = document.getElementById('max-history');
    const saveOfflineCheckbox = document.getElementById('save-offline');
    const settingsStatus = document.getElementById('settings-status');

    // Show status message function
    function showStatus(message, type = 'info') {
        settingsStatus.textContent = message;
        settingsStatus.className = `status-message ${type}`;

        if (type === 'success') {
            setTimeout(() => {
                if (settingsStatus.textContent === message) {
                    settingsStatus.textContent = '';
                    settingsStatus.className = 'status-message';
                }
            }, 3000);
        }
    }

    // Apply theme function (use global applyTheme from theme.js if available)
    function applyTheme(theme) {
        if (window.applyTheme) {
            window.applyTheme(theme);
        } else {
            // Fallback if theme.js is not loaded
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
    }

    // Load settings
    chrome.storage.local.get([
        'theme',
        'fontSize',
        'maxHistory',
        'saveOffline'
    ], (result) => {
        if (chrome.runtime.lastError) {
            showStatus('Error loading settings: ' + chrome.runtime.lastError.message, 'error');
            return;
        }

        // Set theme
        if (result.theme) {
            themeSelect.value = result.theme;
            applyTheme(result.theme);
        } else {
            // Use default from config if available
            if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_THEME) {
                themeSelect.value = CONFIG.DEFAULT_THEME;
                applyTheme(CONFIG.DEFAULT_THEME);
            }
        }

        // Set font size
        if (result.fontSize) {
            fontSizeSelect.value = result.fontSize;
        } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_FONT_SIZE) {
            fontSizeSelect.value = CONFIG.DEFAULT_FONT_SIZE;
        }

        // Set max history
        if (result.maxHistory) {
            maxHistorySelect.value = result.maxHistory;
        } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_MAX_HISTORY) {
            maxHistorySelect.value = CONFIG.DEFAULT_MAX_HISTORY;
        }

        // Set offline mode
        if (result.saveOffline !== undefined) {
            saveOfflineCheckbox.checked = result.saveOffline;
        } else if (typeof CONFIG !== 'undefined' && CONFIG.DEFAULT_OFFLINE_MODE !== undefined) {
            saveOfflineCheckbox.checked = CONFIG.DEFAULT_OFFLINE_MODE;
        }

        // Settings loaded silently without notification
    });

    // Theme change handler
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        chrome.storage.local.set({ theme }, () => {
            applyTheme(theme);
            showStatus('Theme updated', 'success');
        });
    });

    // Font size change handler
    fontSizeSelect.addEventListener('change', () => {
        chrome.storage.local.set({ fontSize: fontSizeSelect.value }, () => {
            showStatus('Font size updated', 'success');
        });
    });

    // Max history change handler
    maxHistorySelect.addEventListener('change', () => {
        chrome.storage.local.set({ maxHistory: maxHistorySelect.value }, () => {
            showStatus('History limit updated', 'success');
        });
    });

    // Offline mode change handler
    saveOfflineCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ saveOffline: saveOfflineCheckbox.checked }, () => {
            showStatus(
                saveOfflineCheckbox.checked ? 'Offline mode enabled' : 'Offline mode disabled',
                'success'
            );
        });
    });

    // Back button handler
    backBtn.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });

    // Listen for system theme changes
    if (window.matchMedia) {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', e => {
            if (themeSelect.value === 'system') {
                applyTheme('system');
            }
        });
    }
});