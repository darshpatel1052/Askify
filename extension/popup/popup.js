document.addEventListener('DOMContentLoaded', () => {
    // Aggressive popup persistence - prevent auto-closing
    window.keepAlive = true;
    let isPopupManuallyClosing = false;

    // DOM elements
    const authSection = document.getElementById('auth-section');
    const loginForm = document.getElementById('login-form');
    const userInfo = document.getElementById('user-info');
    const userEmail = document.getElementById('user-email');
    const querySection = document.getElementById('query-section');
    const historySection = document.getElementById('history-section');
    const queryInput = document.getElementById('query-input');
    const queryBtn = document.getElementById('query-btn');
    const clearBtn = document.getElementById('clear-btn');
    const copyBtn = document.getElementById('copy-btn');
    const regenerateBtn = document.getElementById('regenerate-btn');
    const answerBox = document.getElementById('answer-box');
    const answerSection = document.getElementById('answer-section');
    const loading = document.getElementById('loading');
    const historyList = document.getElementById('history-list');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authStatus = document.getElementById('auth-status');
    const queryStatus = document.getElementById('query-status');
    const charCount = document.getElementById('char-count');
    const settingsBtn = document.getElementById('settings-btn');
    const userAvatar = document.getElementById('user-avatar');
    const userMenu = document.getElementById('user-menu');
    const menuAvatar = document.getElementById('menu-avatar');
    const clearHistoryBtn = document.getElementById('clear-history');
    const headerControls = document.getElementById('header-controls');
    const headerBrand = document.querySelector('.header-brand');

    const API_BASE_URL = CONFIG.API_BASE_URL || 'http://localhost:8000/api/v1';
    let currentUrl = '';
    let authToken = '';
    let isProcessing = false;
    let maxHistoryItems = CONFIG.DEFAULT_MAX_HISTORY || 5;
    let isOfflineMode = CONFIG.DEFAULT_OFFLINE_MODE || false;

    // Establish long-lived connection to prevent popup from closing
    let port = null;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 50; // Increased attempts
    let keepAliveInterval = null;

    function connectToBackground() {
        try {
            port = chrome.runtime.connect({ name: "popup" });
            reconnectAttempts = 0; // Reset on successful connection

            port.onMessage.addListener((message) => {
                if (message.action === 'connected') {
                    console.log('Successfully connected to background script');
                } else if (message.action === 'tabSwitched' || message.action === 'windowFocused') {
                    // Keep popup alive when tab or window changes
                    if (window.keepAlive && !isPopupManuallyClosing) {
                        window.focus();
                    }
                }
            });

            port.onDisconnect.addListener(() => {
                port = null;
                // Only reconnect if we're not manually closing and haven't exceeded max attempts
                if (!isPopupManuallyClosing && reconnectAttempts < maxReconnectAttempts) {
                    reconnectAttempts++;
                    console.log(`Reconnecting to background (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                    setTimeout(connectToBackground, Math.min(500 * reconnectAttempts, 2000));
                }
            });

        } catch (error) {
            console.error('Failed to connect to background:', error);
            // Retry connection after a delay if we haven't exceeded max attempts
            if (!isPopupManuallyClosing && reconnectAttempts < maxReconnectAttempts) {
                reconnectAttempts++;
                setTimeout(connectToBackground, Math.min(500 * reconnectAttempts, 2000));
            }
        }
    }

    // Initial connection
    connectToBackground();

    // Simple keep-alive mechanism - less aggressive
    keepAliveInterval = setInterval(() => {
        if (window.keepAlive && !isPopupManuallyClosing && port) {
            try {
                port.postMessage({ action: 'ping' });
            } catch (error) {
                console.log('Ping failed, reconnecting...');
                connectToBackground();
            }
        }
    }, 5000); // Ping every 5 seconds instead of every second

    // Basic activity tracking to keep popup alive
    const activityEvents = ['click', 'input'];
    activityEvents.forEach(eventType => {
        document.addEventListener(eventType, () => {
            if (port && !isPopupManuallyClosing) {
                try {
                    port.postMessage({ action: 'ping' });
                } catch (error) {
                    connectToBackground();
                }
            }
        });
    });

    // Detect when user manually closes popup (clicks extension icon)
    chrome.action.onClicked.addListener(() => {
        isPopupManuallyClosing = true;
        window.keepAlive = false;
        if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
        }
        if (port) {
            port.disconnect();
        }
    });

    // Check if user is logged in and restore previous state
    chrome.storage.local.get(['authToken', 'userEmail', 'lastQuery', 'lastAnswer', 'isProcessing', 'maxHistory', 'saveOffline'], (result) => {
        if (result.authToken && result.userEmail) {
            authToken = result.authToken;
            showLoggedInState(result.userEmail);

            // Restore previous query and answer if they exist
            if (result.lastQuery) {
                queryInput.value = result.lastQuery;
                updateCharCounter();
            }

            if (result.lastAnswer) {
                const formattedAnswer = markdownToHTML(result.lastAnswer);
                answerBox.innerHTML = formattedAnswer;
                answerSection.style.display = 'block';
            }

            // Resume processing state if it was interrupted
            if (result.isProcessing) {
                loading.style.display = 'block';
                isProcessing = true;
            }

            // Get user preferences
            if (result.maxHistory) {
                maxHistoryItems = parseInt(result.maxHistory);
            }

            if (result.saveOffline !== undefined) {
                isOfflineMode = result.saveOffline;
            }
        }
    });

    // Get current tab URL
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        currentUrl = tabs[0].url;
        if (authToken) {
            fetchQueryHistory();
        }
    });

    // Login button click handler
    loginBtn.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showStatus(authStatus, 'Please enter both email and password', 'error');
            return;
        }

        // Show loading status
        showStatus(authStatus, 'Logging in...', 'info');

        fetch(`${API_BASE_URL}/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 401) {
                        throw new Error('Incorrect email or password');
                    } else if (response.status === 404) {
                        throw new Error('User does not exist');
                    } else {
                        throw new Error(`Server error: ${response.status}`);
                    }
                }
                return response.json();
            })
            .then(data => {
                if (data.access_token) {
                    authToken = data.access_token;
                    chrome.storage.local.set({
                        authToken: data.access_token,
                        userEmail: email
                    });
                    showLoggedInState(email);
                    fetchQueryHistory();
                    showStatus(authStatus, '', ''); // Clear any error messages
                } else {
                    showStatus(authStatus, data.detail || 'Login failed', 'error');
                }
            })
            .catch(error => {
                showStatus(authStatus, `${error.message}`, 'error');
            });
    });

    // Sign up button click handler
    signupBtn.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            showStatus(authStatus, 'Please enter both email and password', 'error');
            return;
        }

        if (password.length < 8) {
            showStatus(authStatus, 'Password must be at least 8 characters long', 'error');
            return;
        }

        // Show loading status
        showStatus(authStatus, 'Creating account...', 'info');

        fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
            .then(response => {
                if (!response.ok) {
                    if (response.status === 400) {
                        return response.json().then(data => {
                            throw new Error(data.detail || 'User already exists');
                        });
                    }
                    throw new Error(`Server error: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Registration response:', data);
                // Check for both possible successful response formats
                if (data.id || data.user_id) {
                    showStatus(authStatus, 'Account created successfully!', 'success');

                    // Auto login after successful signup
                    fetch(`${API_BASE_URL}/auth/token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
                    })
                        .then(response => {
                            console.log('Auto-login response status:', response.status);
                            if (!response.ok) {
                                throw new Error('Auto-login failed with status: ' + response.status);
                            }
                            return response.json();
                        })
                        .then(loginData => {
                            console.log('Auto-login response data:', loginData);
                            if (loginData.access_token) {
                                authToken = loginData.access_token;
                                chrome.storage.local.set({
                                    authToken: loginData.access_token,
                                    userEmail: email
                                });
                                showLoggedInState(email);
                                fetchQueryHistory();
                                showStatus(authStatus, 'Account created and logged in successfully!', 'success');
                            } else {
                                showStatus(authStatus, 'Account created, but auto-login failed. Please login manually.', 'info');
                            }
                        })
                        .catch(error => {
                            console.error('Auto-login error:', error);
                            // Still show successful registration even if auto-login fails
                            showStatus(authStatus, 'Account created! Please login with your credentials.', 'success');
                        });
                } else if (data.message && data.message.includes('successfully')) {
                    // Alternative success message format
                    showStatus(authStatus, 'Account created successfully!', 'success');

                    // Auto login after successful signup
                    fetch(`${API_BASE_URL}/auth/token`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        },
                        body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
                    })
                        .then(response => response.json())
                        .then(loginData => {
                            if (loginData.access_token) {
                                authToken = loginData.access_token;
                                chrome.storage.local.set({
                                    authToken: loginData.access_token,
                                    userEmail: email
                                });
                                showLoggedInState(email);
                                fetchQueryHistory();
                            } else {
                                showStatus(authStatus, 'Account created! Please login with your credentials.', 'success');
                            }
                        })
                        .catch(error => {
                            console.error('Auto-login error:', error);
                            showStatus(authStatus, 'Account created! Please login with your credentials.', 'success');
                        });
                } else {
                    console.error('Unexpected registration response format:', data);
                    showStatus(authStatus, data.detail || data.message || 'Registration failed. Please try again.', 'error');
                }
            })
            .catch(error => {
                console.error('Registration error:', error);
                showStatus(authStatus, `${error.message}`, 'error');
            });
    });

    // Clear button click handler
    clearBtn.addEventListener('click', () => {
        // Clear the query input and answer box
        queryInput.value = '';
        answerBox.innerHTML = '';
        answerSection.style.display = 'none';
        queryStatus.innerHTML = '';
        queryStatus.className = 'status-message';
        updateCharCounter(); // Update the character counter

        // Clear the saved query and answer
        chrome.storage.local.remove(['lastQuery', 'lastAnswer'], () => {
            console.log('Cleared last query and answer');
        });

        // Remove highlight from any selected history item
        document.querySelectorAll('.history-item').forEach(histItem => {
            histItem.classList.remove('selected');
        });
    });
    queryBtn.addEventListener('click', () => {
        const query = queryInput.value.trim();

        if (!query) {
            displayMessage('Please enter a question');
            return;
        }

        // Send the query with the current URL (backend will extract content)
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            currentUrl = tabs[0].url;
            sendQuery(query, currentUrl);
        });
    });    // Send query to backend
    function sendQuery(query, url) {
        loading.style.display = 'block';
        answerBox.innerHTML = '';
        answerSection.style.display = 'none';
        isProcessing = true;

        // Save the current state
        chrome.storage.local.set({
            lastQuery: query,
            isProcessing: true
        });

        // Check if offline and no connection
        if (!navigator.onLine && isOfflineMode) {
            // Try to find answer in history
            chrome.storage.local.get(['offlineHistory'], (result) => {
                if (result.offlineHistory) {
                    const matchingItem = result.offlineHistory.find(item =>
                        item.query.toLowerCase() === query.toLowerCase());

                    if (matchingItem) {
                        // Found a match in history
                        setTimeout(() => {
                            loading.style.display = 'none';
                            isProcessing = false;
                            chrome.storage.local.set({ isProcessing: false });

                            const formattedAnswer = markdownToHTML(matchingItem.answer);
                            answerBox.innerHTML = formattedAnswer;
                            answerSection.style.display = 'block';
                            chrome.storage.local.set({ lastAnswer: matchingItem.answer });
                            showStatus(queryStatus, 'Using cached answer (offline mode)', 'info');
                        }, 500);
                        return;
                    }
                }

                // No matching query found
                loading.style.display = 'none';
                isProcessing = false;
                chrome.storage.local.set({ isProcessing: false });
                showStatus(queryStatus, 'No internet connection and no cached answer for this query', 'error');
            });
            return;
        }

        fetch(`${API_BASE_URL}/query/ask`, {
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
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                loading.style.display = 'none';
                isProcessing = false;
                chrome.storage.local.set({ isProcessing: false });

                if (data.answer) {
                    // Convert markdown to HTML for proper rendering
                    const formattedAnswer = markdownToHTML(data.answer);
                    answerBox.innerHTML = formattedAnswer;
                    answerSection.style.display = 'block';

                    // Save the answer for state persistence
                    chrome.storage.local.set({ lastAnswer: data.answer });

                    // Update history
                    fetchQueryHistory();

                    // Clear any previous status messages
                    showStatus(queryStatus, '', '');
                } else {
                    const errorMessage = data.message || 'Failed to get an answer';
                    showStatus(queryStatus, errorMessage, 'error');
                    chrome.storage.local.set({ lastAnswer: errorMessage });
                }
            })
            .catch(error => {
                loading.style.display = 'none';
                isProcessing = false;
                chrome.storage.local.set({ isProcessing: false });
                const errorMessage = 'Error: ' + error.message;
                showStatus(queryStatus, errorMessage, 'error');
                chrome.storage.local.set({ lastAnswer: errorMessage });
            });
    }

    // Fetch user's query history
    function fetchQueryHistory() {
        // Check for offline mode first
        if (isOfflineMode) {
            chrome.storage.local.get(['offlineHistory'], (result) => {
                if (result.offlineHistory && result.offlineHistory.length > 0) {
                    displayHistoryItems(result.offlineHistory);
                } else {
                    // If no offline history, try to fetch from server
                    fetchHistoryFromServer();
                }
            });
        } else {
            fetchHistoryFromServer();
        }
    }

    // Fetch history from server
    function fetchHistoryFromServer() {
        fetch(`${API_BASE_URL}/query/history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.history && data.history.length > 0) {
                    // Save for offline use if enabled
                    if (isOfflineMode) {
                        chrome.storage.local.set({ offlineHistory: data.history });
                    }

                    displayHistoryItems(data.history);
                } else {
                    historySection.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Error fetching history:', error);

                // Try to use offline history if available
                if (isOfflineMode) {
                    chrome.storage.local.get(['offlineHistory'], (result) => {
                        if (result.offlineHistory && result.offlineHistory.length > 0) {
                            displayHistoryItems(result.offlineHistory);
                            showStatus(queryStatus, 'Using offline history', 'info');
                        }
                    });
                }
            });
    }

    // Display history items
    function displayHistoryItems(historyData) {
        historySection.style.display = 'block';
        historyList.innerHTML = '';

        historyData.slice(0, maxHistoryItems).forEach(item => {
            const li = document.createElement('li');
            li.className = 'history-item';

            // Create history item content wrapper
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'history-content';

            // Create query display
            const queryText = document.createElement('div');
            queryText.className = 'history-query';
            queryText.textContent = `${item.query}`;

            // Create timestamp display
            const timestamp = document.createElement('div');
            timestamp.className = 'history-timestamp';
            timestamp.textContent = `${new Date(item.timestamp).toLocaleDateString()}`;

            // Create delete button
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete this query';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent triggering the item click
                if (confirm('Delete this query from history?')) {
                    deleteSpecificQuery(item.id, li);
                }
            });

            // Add elements to content wrapper
            contentWrapper.appendChild(queryText);
            contentWrapper.appendChild(timestamp);

            // Add content wrapper and delete button to item
            li.appendChild(contentWrapper);
            li.appendChild(deleteBtn);

            // Store the answer in a data attribute
            li.dataset.answer = item.answer;

            // Add click event to display the answer (only on content wrapper)
            contentWrapper.addEventListener('click', () => {
                // Set the query in the input
                queryInput.value = item.query;
                updateCharCounter();

                // Display the answer
                const formattedAnswer = markdownToHTML(item.answer);
                answerBox.innerHTML = formattedAnswer;
                answerSection.style.display = 'block';

                // Save as current query and answer
                chrome.storage.local.set({
                    lastQuery: item.query,
                    lastAnswer: item.answer
                });

                // Highlight the selected history item
                document.querySelectorAll('.history-item').forEach(histItem => {
                    histItem.classList.remove('selected');
                });
                li.classList.add('selected');
            });

            historyList.appendChild(li);
        });
    }

    // Function to delete a specific query
    function deleteSpecificQuery(queryId, listItem) {
        if (!authToken) {
            showStatus(queryStatus, 'Please login to delete queries', 'error');
            return;
        }

        // Add loading state to the delete button
        const deleteBtn = listItem.querySelector('.history-delete-btn');
        if (deleteBtn) {
            deleteBtn.classList.add('loading');
            deleteBtn.innerHTML = '⟳';
        }

        fetch(`${API_BASE_URL}/query/history/query/${queryId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Remove the item from the UI with animation
                    listItem.style.transition = 'all 0.3s ease';
                    listItem.style.transform = 'translateX(100%)';
                    listItem.style.opacity = '0';

                    setTimeout(() => {
                        listItem.remove();

                        // Update offline storage
                        if (isOfflineMode) {
                            chrome.storage.local.get(['offlineHistory'], (result) => {
                                if (result.offlineHistory) {
                                    const updatedHistory = result.offlineHistory.filter(item => item.id !== queryId);
                                    chrome.storage.local.set({ offlineHistory: updatedHistory });
                                }
                            });
                        }

                        // Check if history is empty and hide section
                        if (historyList.children.length === 0) {
                            historySection.style.display = 'none';
                        }

                        // Refresh history from server to ensure consistency
                        fetchQueryHistory();
                    }, 300);

                    showStatus(queryStatus, 'Query deleted successfully', 'success');
                } else {
                    // Remove loading state on error
                    if (deleteBtn) {
                        deleteBtn.classList.remove('loading');
                        deleteBtn.innerHTML = '×';
                    }
                    showStatus(queryStatus, 'Failed to delete query', 'error');
                }
            })
            .catch(error => {
                console.error('Error deleting query:', error);
                // Remove loading state on error
                if (deleteBtn) {
                    deleteBtn.classList.remove('loading');
                    deleteBtn.innerHTML = '×';
                }
                showStatus(queryStatus, 'Error deleting query: ' + error.message, 'error');
            });
    }

    // Character counter for query input
    queryInput.addEventListener('input', updateCharCounter);

    function updateCharCounter() {
        const length = queryInput.value.length;
        charCount.textContent = length;

        // Add warning class if approaching limit
        if (length > 250) {
            charCount.classList.add('warning');
        } else {
            charCount.classList.remove('warning');
        }

        // Add error class if over limit
        if (length > 280) {
            charCount.classList.add('error');
            queryBtn.disabled = true;
        } else {
            charCount.classList.remove('error');
            queryBtn.disabled = false;
        }
    }

    // Settings button
    settingsBtn.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });

    // Copy button for answer
    copyBtn.addEventListener('click', () => {
        // Get text content from answer box (including formatting)
        const textToCopy = answerBox.innerText || answerBox.textContent || '';

        if (!textToCopy.trim()) {
            showStatus(queryStatus, 'No content to copy', 'warning');
            return;
        }

        navigator.clipboard.writeText(textToCopy).then(() => {
            // Show success message with visual feedback
            const originalContent = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
            `;
            copyBtn.style.color = '#10b981';

            setTimeout(() => {
                copyBtn.innerHTML = originalContent;
                copyBtn.style.color = '';
            }, 2000);

            showStatus(queryStatus, 'Copied to clipboard!', 'success');
        }).catch(err => {
            // Show error message
            showStatus(queryStatus, 'Failed to copy text', 'error');
            console.error('Copy failed:', err);
        });
    });

    // Regenerate button for answer
    if (regenerateBtn) {
        regenerateBtn.addEventListener('click', () => {
            const currentQuery = queryInput.value.trim();
            if (!currentQuery) {
                showStatus(queryStatus, 'No query to regenerate', 'warning');
                return;
            }

            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                currentUrl = tabs[0].url;
                sendQuery(currentQuery, currentUrl);
            });
        });
    }

    // Simple markdown to HTML converter
    function markdownToHTML(markdown) {
        if (!markdown) return '';

        // Process code blocks with language
        let html = markdown.replace(/```(\w+)?\n([\s\S]*?)```/g, function (match, lang, code) {
            return `<pre class="code-block ${lang || ''}"><code>${code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`;
        });

        // Process headers
        html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');

        // Process bold
        html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Process italic
        html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');

        // Process lists
        html = html.replace(/^\* (.*$)/gm, '<ul><li>$1</li></ul>');
        html = html.replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>');
        html = html.replace(/^(\d+)\. (.*$)/gm, '<ol><li>$2</li></ol>');

        // Fix multiple lists
        html = html.replace(/<\/ul>\s*<ul>/g, '');
        html = html.replace(/<\/ol>\s*<ol>/g, '');

        // Process paragraphs
        html = html.replace(/^(?!<[a-z])/gm, '<p>');
        html = html.replace(/^<p>(.*?)$/gm, '<p>$1</p>');

        // Process links
        html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank">$1</a>');

        return html;
    }

    // Display error/success messages
    function displayMessage(message, type = 'info') {
        showStatus(queryStatus, message, type);
    }

    // Show status message in a specific status element
    function showStatus(statusElement, message, type = 'info') {
        statusElement.textContent = message;
        statusElement.className = `status-message ${type}`;

        // Clear status message after 5 seconds for success messages
        if (type === 'success') {
            setTimeout(() => {
                if (statusElement.textContent === message) {
                    statusElement.textContent = '';
                    statusElement.className = 'status-message';
                }
            }, 5000);
        }
    }
    function showLoggedInState(email) {
        authSection.style.display = 'none';
        querySection.style.display = 'block';
        userEmail.textContent = email;

        // Show header controls when logged in
        if (headerControls) {
            headerControls.style.display = 'flex';
        }

        // Show header brand when logged in
        if (headerBrand) {
            headerBrand.style.display = 'flex';
        }

        // Generate avatar from email using modern RoboHash service
        const avatarSeed = email.split('@')[0] || 'User';
        const avatarUrl = `https://robohash.org/${encodeURIComponent(email)}?set=set4&size=100x100`;
        document.getElementById('avatar-img').src = avatarUrl;

        // Apply user's font size preference when logged in
        applyFontSizeToPopup();

        fetchQueryHistory();
    }

    function showLoggedOutState() {
        authSection.style.display = 'block';
        querySection.style.display = 'none';
        historySection.style.display = 'none';
        answerSection.style.display = 'none';

        // Hide header controls when logged out
        if (headerControls) {
            headerControls.style.display = 'none';
        }

        // Hide header brand when logged out (show in auth area instead)
        if (headerBrand) {
            headerBrand.style.display = 'none';
        }

        // Reset to default large font size for login/signup interface
        applyFontSizeToPopup(true);
    }

    // Apply font sizes based on saved settings (only when logged in)
    function applyFontSizeToPopup(forceDefault = false) {
        const root = document.documentElement;

        if (forceDefault) {
            // Always use large font for login/signup interface
            root.style.setProperty('font-size', '16px');
            if (answerBox) answerBox.style.fontSize = '16px';
            return;
        }

        chrome.storage.local.get(['fontSize'], (result) => {
            const size = result.fontSize || 'large'; // Default to large

            switch (size) {
                case 'small':
                    root.style.setProperty('font-size', '12px');
                    if (answerBox) answerBox.style.fontSize = '12px';
                    break;
                case 'medium':
                    root.style.setProperty('font-size', '14px');
                    if (answerBox) answerBox.style.fontSize = '14px';
                    break;
                case 'large':
                    root.style.setProperty('font-size', '16px');
                    if (answerBox) answerBox.style.fontSize = '16px';
                    break;
            }
        });
    }

    // Apply font size when page loads (default large for login interface)
    applyFontSizeToPopup(true);

    // Logout button click handler
    logoutBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['authToken', 'userEmail', 'lastQuery', 'lastAnswer', 'isProcessing'], () => {
            authToken = '';
            showLoggedOutState();
            showStatus(authStatus, 'Logged out successfully', 'success');
            // Close the user menu popup
            userMenu.style.display = 'none';
        });
    });

    // Save current state to prevent losing data when popup closes
    function saveCurrentState() {
        const state = {
            lastQuery: queryInput.value,
            isProcessing: isProcessing,
            currentUrl: currentUrl
        };

        // Only save answer if it exists
        if (answerBox.innerHTML) {
            state.lastAnswer = answerBox.innerHTML;
        }

        chrome.runtime.sendMessage({
            action: 'saveState',
            state: state
        }, (response) => {
            console.log('State saved:', response?.success);
        });
    }

    // Add event listener to save state before popup closes
    window.addEventListener('beforeunload', saveCurrentState);

    // Handle user avatar click to toggle user menu
    userAvatar.addEventListener('click', () => {
        userMenu.style.display = userMenu.style.display === 'none' ? 'block' : 'none';

        // Set the avatar in the menu to match the main avatar
        menuAvatar.src = document.getElementById('avatar-img').src;
    });

    // Close user menu when clicking outside
    document.addEventListener('click', (event) => {
        if (!userAvatar.contains(event.target) && !userMenu.contains(event.target)) {
            userMenu.style.display = 'none';
        }
    });

    // Clear history button
    if (clearHistoryBtn) {
        clearHistoryBtn.addEventListener('click', () => {
            if (confirm('Are you sure you want to clear all your query history? This action cannot be undone.')) {
                clearHistoryFromServer();
            }
        });
    }

    // Function to clear history from server
    function clearHistoryFromServer() {
        if (!authToken) {
            showStatus(queryStatus, 'Please login to clear history', 'error');
            return;
        }

        fetch(`${API_BASE_URL}/query/history`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                history_type: 'query'
            })
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // Clear local storage as well
                    chrome.storage.local.remove(['offlineHistory'], () => {
                        historyList.innerHTML = '';
                        historySection.style.display = 'none';
                        showStatus(queryStatus, 'History cleared successfully', 'success');
                    });
                } else {
                    showStatus(queryStatus, 'Failed to clear history', 'error');
                }
            })
            .catch(error => {
                console.error('Error clearing server history:', error);
                showStatus(queryStatus, 'Error clearing history: ' + error.message, 'error');

                // Fallback: clear only local storage if server fails
                chrome.storage.local.remove(['offlineHistory'], () => {
                    historyList.innerHTML = '';
                    historySection.style.display = 'none';
                    showStatus(queryStatus, 'Local history cleared (server error)', 'warning');
                });
            });
    }

    // Note: Theme loading is handled by theme.js in the HTML head to prevent flicker
});
