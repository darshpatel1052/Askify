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

// Track browsing history (if the user has granted permission)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Only proceed if the page has finished loading and the URL is valid
    if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
        // Check if user is logged in
        chrome.storage.local.get(['authToken'], async (result) => {
            if (result.authToken) {
                // Send page visit information to the backend
                try {
                    // Send only tab info, not content (content will be extracted by backend)
                    fetch(`${API_BASE_URL}/history/record`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${result.authToken}`
                        },
                        body: JSON.stringify({
                            url: tab.url,
                            title: tab.title,
                            timestamp: new Date().toISOString(),
                            metadata: {
                                pageTitle: tab.title
                            }
                        })
                    }).catch(error => {
                        console.error('Error recording history:', error);
                    });
                } catch (error) {
                    console.error('Error recording history:', error);
                }
            }
        });
    }
});
