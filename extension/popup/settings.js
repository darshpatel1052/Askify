document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('back-btn');
    const themeSelect = document.getElementById('theme-select');
    const fontSizeSelect = document.getElementById('font-size');
    const maxHistorySelect = document.getElementById('max-history');
    const saveOfflineCheckbox = document.getElementById('save-offline');

    // Load settings from storage
    chrome.storage.local.get([
        'theme',
        'fontSize',
        'maxHistory',
        'saveOffline'
    ], (result) => {
        if (result.theme) {
            themeSelect.value = result.theme;
        }

        if (result.fontSize) {
            fontSizeSelect.value = result.fontSize;
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
        }
    });

    // Save settings when changed
    themeSelect.addEventListener('change', () => {
        const theme = themeSelect.value;
        chrome.storage.local.set({ theme });

        // Apply theme immediately
        if (theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    });

    fontSizeSelect.addEventListener('change', () => {
        chrome.storage.local.set({ fontSize: fontSizeSelect.value });
    });

    maxHistorySelect.addEventListener('change', () => {
        chrome.storage.local.set({ maxHistory: maxHistorySelect.value });
    });

    saveOfflineCheckbox.addEventListener('change', () => {
        chrome.storage.local.set({ saveOffline: saveOfflineCheckbox.checked });
    });

    // Go back to main popup
    backBtn.addEventListener('click', () => {
        window.location.href = 'popup.html';
    });
});
