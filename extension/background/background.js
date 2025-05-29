// Background Service Worker
// Handles communication between the extension popup and content scripts
// Also manages communication with the backend API

// Include the config.js script in manifest.json
// The CONFIG object will be available globally
const API_BASE_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8000/api/v1';

// Keep popup open when switching tabs
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'keepPopupOpen') {
        // Prevent the popup from closing by handling tab switching events
        chrome.tabs.onActivated.addListener((activeInfo) => {
            chrome.runtime.sendMessage({ action: 'tabSwitched' });
        });

        // Also track window focus changes
        chrome.windows.onFocusChanged.addListener((windowId) => {
            if (windowId !== chrome.windows.WINDOW_ID_NONE) {
                chrome.runtime.sendMessage({ action: 'tabSwitched' });
            }
        });

        // Keep a reference to the current window to prevent popup from closing
        chrome.windows.getCurrent(currentWindow => {
            chrome.windows.update(currentWindow.id, { focused: true });
        });

        sendResponse({ success: true });
        return true; // Required for async response
    }

    // Handle state persistence
    if (message.action === 'saveState') {
        chrome.storage.local.set(message.state, () => {
            sendResponse({ success: true });
        });
        return true; // Required for async response
    }

    if (message.action === 'loadState') {
        chrome.storage.local.get(message.keys, (result) => {
            sendResponse({ success: true, state: result });
        });
        return true; // Required for async response
    }
});

// Function to get tab information
async function getTabInfo(tabId) {
    return new Promise((resolve, reject) => {
        chrome.tabs.get(tabId, tab => {
            if (chrome.runtime.lastError) {
                return reject(chrome.runtime.lastError);
            }

            resolve({
                url: tab.url,
                title: tab.title
            });
        });
    });
}

// Function to send URL to the backend for processing
async function processContent(url, authToken) {
    try {
        const response = await fetch(`${API_BASE_URL}/content/process`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                url,
                timestamp: new Date().toISOString()
            })
        });

        return await response.json();
    } catch (error) {
        console.error('Error processing content:', error);
        throw error;
    }
}

// Function to send a query to the backend
async function sendQuery(query, url, authToken) {
    try {
        const response = await fetch(`${API_BASE_URL}/query/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                query,
                url,
                timestamp: new Date().toISOString()
            })
        });

        return await response.json();
    } catch (error) {
        console.error('Error sending query:', error);
        throw error;
    }
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'processPage') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const processResult = await processContent(tabs[0].url, request.authToken);
                sendResponse({ success: true, data: processResult });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        });
        return true; // Keep the message channel open for the asynchronous response
    }

    if (request.action === 'sendQuery') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const queryResult = await sendQuery(request.query, tabs[0].url, request.authToken);
                sendResponse({ success: true, data: queryResult });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        });
        return true; // Keep the message channel open for the asynchronous response
    }
});

// We no longer track browsing history automatically
// History is only recorded when a user makes a query
