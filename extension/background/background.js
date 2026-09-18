// Askify Next-Gen Background Service Worker (Manifest V3)
importScripts('../config.js');

// 1. Setup on Install
chrome.runtime.onInstalled.addListener(() => {
    console.log('[Askify] Extension installed/updated to v2.0.0');

    // Create Context Menus
    chrome.contextMenus.create({
        id: 'askify-explain-selection',
        title: 'Askify: Explain "%s"',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'askify-summarize-selection',
        title: 'Askify: Summarize "%s"',
        contexts: ['selection']
    });

    chrome.contextMenus.create({
        id: 'askify-open-sidepanel',
        title: 'Open Askify Side Panel',
        contexts: ['page', 'action']
    });
});

// 2. Handle Context Menu Clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (!tab || !tab.id) return;

    if (info.menuItemId === 'askify-open-sidepanel') {
        if (chrome.sidePanel && chrome.sidePanel.open) {
            chrome.sidePanel.open({ windowId: tab.windowId });
        }
        return;
    }

    if (info.menuItemId === 'askify-explain-selection' || info.menuItemId === 'askify-summarize-selection') {
        const actionType = info.menuItemId === 'askify-summarize-selection' ? 'summarize' : 'explain';
        
        // Open Side Panel
        if (chrome.sidePanel && chrome.sidePanel.open) {
            await chrome.sidePanel.open({ windowId: tab.windowId });
        }

        // Forward action to storage so Side Panel picks it up immediately
        chrome.storage.local.set({
            pendingAction: {
                type: actionType,
                text: info.selectionText,
                pageTitle: tab.title,
                url: tab.url,
                timestamp: Date.now()
            }
        });
    }
});

// 3. Handle Keyboard Shortcuts
chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'open_side_panel') {
        if (chrome.sidePanel && chrome.sidePanel.open && tab) {
            chrome.sidePanel.open({ windowId: tab.windowId });
        }
    }
});

// 4. Message Router between Content Scripts, Popup, and Side Panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Quick action triggered from floating in-page bubble
    if (message.action === 'quickAction') {
        (async () => {
            const tab = sender.tab;
            if (tab && chrome.sidePanel && chrome.sidePanel.open) {
                await chrome.sidePanel.open({ windowId: tab.windowId });
            }
            await chrome.storage.local.set({
                pendingAction: {
                    type: message.actionType,
                    text: message.selectedText,
                    pageTitle: message.pageTitle,
                    url: message.url,
                    timestamp: Date.now()
                }
            });
            sendResponse({ success: true });
        })();
        return true;
    }

    // Open side panel request from popup
    if (message.action === 'openSidePanel') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && chrome.sidePanel && chrome.sidePanel.open) {
                chrome.sidePanel.open({ windowId: tabs[0].windowId });
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'SidePanel API not available' });
            }
        });
        return true;
    }
});
