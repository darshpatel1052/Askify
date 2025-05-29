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

        // Clear success messages after 3 seconds
        if (type === 'success') {
            setTimeout(() => {
                if (settingsStatus.textContent === message) {
                    settingsStatus.textContent = '';
                    settingsStatus.className = 'status-message';
                }
            }, 3000);
        }
    }

    // Apply font size function
    function applyFontSize(size) {
        const root = document.documentElement;
        switch (size) {
            case 'small':
                root.style.setProperty('--font-size-base', '12px');
                root.style.setProperty('--font-size-h1', '20px');
                root.style.setProperty('--font-size-h2', '16px');
                break;
            case 'medium':
                root.style.setProperty('--font-size-base', '14px');
                root.style.setProperty('--font-size-h1', '24px');
                root.style.setProperty('--font-size-h2', '18px');
                break;
            case 'large':
                root.style.setProperty('--font-size-base', '16px');
                root.style.setProperty('--font-size-h1', '28px');
                root.style.setProperty('--font-size-h2', '20px');
                break;
        }
    }

    // Load settings from storage with a try-catch for better error handling
    try {
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

            if (result.theme) {
                themeSelect.value = result.theme;
            }

            if (result.fontSize) {
                fontSizeSelect.value = result.fontSize;
                applyFontSize(result.fontSize);
            } else {
                // Default to medium if not set
                fontSizeSelect.value = 'medium';
                applyFontSize('medium');
            }

            if (result.maxHistory) {
                maxHistorySelect.value = result.maxHistory;
            }

            if (result.saveOffline !== undefined) {
                saveOfflineCheckbox.checked = result.saveOffline;
            }

            // Apply theme to settings page
            if (result.theme === 'dark') {
                document.body.classList.add('dark-mode');
            } else if (result.theme === 'system') {
                // Check system preference
                if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                    document.body.classList.add('dark-mode');
                }
            }

            showStatus('Settings loaded successfully', 'success');
        });
    } catch (error) {
        showStatus('Error initializing settings: ' + error.message, 'error');
    }

    // Save settings when changed
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        chrome.storage.local.set({ theme }, () => {
            showStatus('Theme updated', 'success');
        });

        // Apply theme immediately
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (theme === 'light') {
            document.body.classList.remove('dark-mode');
        } else if (theme === 'system') {
            // Check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
            } else {
                document.body.classList.remove('dark-mode');
            }
        }
    });

    fontSizeSelect.addEventListener('change', () => {
        chrome.storage.local.set({ fontSize: fontSizeSelect.value }, () => {
            showStatus('Font size updated', 'success');
            applyFontSize(fontSizeSelect.value);
        });
    });

    maxHistorySelect.addEventListener('change', () => {
        chrome.storage.local.set({ maxHistory: maxHistorySelect.value }, () => {
            showStatus('Max history items updated', 'success');
        });
    });

    saveOfflineCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ saveOffline: saveOfflineCheckbox.checked }, () => {
            if (saveOfflineCheckbox.checked) {
                showStatus('Offline access enabled', 'success');
            } else {
                showStatus('Offline access disabled', 'success');
            }
        });
    });

    // Go back to main popup
    backBtn.addEventListener('click', () => {
        // Save current settings before navigating back
        const currentSettings = {
            theme: themeSelect.value,
            fontSize: fontSizeSelect.value,
            maxHistory: maxHistorySelect.value,
            saveOffline: saveOfflineCheckbox.checked
        };

        chrome.storage.local.set(currentSettings, () => {
            window.location.href = 'popup.html';
        });
    });

    // Handle system theme changes
    if (window.matchMedia) {
        const darkModeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        darkModeMediaQuery.addEventListener('change', e => {
            if (themeSelect.value === 'system') {
                if (e.matches) {
                    document.body.classList.add('dark-mode');
                } else {
                    document.body.classList.remove('dark-mode');
                }
            }
        });
    }
});
