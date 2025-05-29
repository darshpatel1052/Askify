// Background Service Worker
// Handles communication between the extension popup and content scripts
// Also manages communication with the backend API

const API_BASE_URL = 'http://localhost:8000/api/v1'; // Change this in production

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
