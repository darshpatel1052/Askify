// Background Service Worker
// Handles communication between the extension popup and content scripts
// Also manages communication with the backend API

// Import configuration
importScripts('../config.js');

// The CONFIG object will be available globally
const API_BASE_URL = typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : 'http://localhost:8000/api/v1';

// Keep track of popup state
let isPopupOpen = false;
let popupPort = null;
let popupKeepAlive = null;
let aggressiveKeepAlive = null;

// Function to keep popup alive with aggressive persistence
function keepPopupAlive() {
    if (popupPort) {
        try {
            popupPort.postMessage({ action: 'keepAlive' });
        } catch (error) {
            console.error('Error keeping popup alive:', error);
            isPopupOpen = false;
            popupPort = null;
            if (popupKeepAlive) {
                clearInterval(popupKeepAlive);
                popupKeepAlive = null;
            }
            if (aggressiveKeepAlive) {
                clearInterval(aggressiveKeepAlive);
                aggressiveKeepAlive = null;
            }
        }
    }
}

// Aggressive function to prevent service worker from sleeping
function preventServiceWorkerSleep() {
    // Keep service worker alive by performing minimal operations
    chrome.storage.local.get(['keepAlive'], () => {
        chrome.storage.local.set({
            keepAlive: Date.now(),
            popupActive: isPopupOpen
        });
    });
}

// Keep popup open when switching tabs - register listeners once
chrome.tabs.onActivated.addListener((activeInfo) => {
    if (isPopupOpen && popupPort) {
        try {
            popupPort.postMessage({ action: 'tabSwitched' });
        } catch (error) {
            // Port might be disconnected
            isPopupOpen = false;
            popupPort = null;
        }
    }
});

// Also track window focus changes
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId !== chrome.windows.WINDOW_ID_NONE && isPopupOpen && popupPort) {
        try {
            popupPort.postMessage({ action: 'windowFocused' });
        } catch (error) {
            // Port might be disconnected
            isPopupOpen = false;
            popupPort = null;
        }
    }
});

// Handle long-lived connections from popup
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "popup") {
        popupPort = port;
        isPopupOpen = true;
        console.log('Popup connected - starting aggressive keep-alive');

        // Start multiple keep-alive intervals for maximum persistence
        popupKeepAlive = setInterval(keepPopupAlive, 500); // Every 500ms
        aggressiveKeepAlive = setInterval(preventServiceWorkerSleep, 1000); // Every 1s

        // Send initial connection confirmation
        try {
            port.postMessage({ action: 'connected' });
        } catch (error) {
            console.error('Error sending connection confirmation:', error);
        }

        port.onDisconnect.addListener(() => {
            isPopupOpen = false;
            popupPort = null;
            if (popupKeepAlive) {
                clearInterval(popupKeepAlive);
                popupKeepAlive = null;
            }
            if (aggressiveKeepAlive) {
                clearInterval(aggressiveKeepAlive);
                aggressiveKeepAlive = null;
            }
            console.log('Popup disconnected - stopping keep-alive');
        });

        port.onMessage.addListener((message) => {
            if (message.action === 'ping') {
                // Respond to ping to keep connection alive
                try {
                    port.postMessage({ action: 'pong' });
                } catch (error) {
                    // Port disconnected
                    isPopupOpen = false;
                    popupPort = null;
                    if (popupKeepAlive) {
                        clearInterval(popupKeepAlive);
                        popupKeepAlive = null;
                    }
                    if (aggressiveKeepAlive) {
                        clearInterval(aggressiveKeepAlive);
                        aggressiveKeepAlive = null;
                    }
                }
            } else if (message.action === 'forceKeepAlive') {
                // Force keep alive from popup
                keepPopupAlive();
                preventServiceWorkerSleep();
            }
        });
    }
});

// Handle general messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

    // Handle API requests
    if (message.action === 'processPage') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const processResult = await processContent(tabs[0].url, message.authToken);
                sendResponse({ success: true, data: processResult });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        });
        return true; // Keep the message channel open for the asynchronous response
    }

    if (message.action === 'sendQuery') {
        chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
            try {
                const queryResult = await sendQuery(message.query, tabs[0].url, message.authToken);
                sendResponse({ success: true, data: queryResult });
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        });
        return true; // Keep the message channel open for the asynchronous response
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

// We no longer track browsing history automatically
// History is only recorded when a user makes a query
