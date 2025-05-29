document.addEventListener('DOMContentLoaded', () => {
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
    const answerBox = document.getElementById('answer-box');
    const loading = document.getElementById('loading');
    const historyList = document.getElementById('history-list');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const authStatus = document.getElementById('auth-status');
    const queryStatus = document.getElementById('query-status');
    const charCount = document.getElementById('char-count');
    const themeToggle = document.getElementById('theme-toggle');
    const settingsBtn = document.getElementById('settings-btn');

    const API_BASE_URL = 'http://localhost:8000/api/v1'; // Change this in production
    let currentUrl = '';
    let authToken = '';
    let isProcessing = false;
    let maxHistoryItems = 5;
    let isOfflineMode = false;

    // Apply theme
    chrome.storage.local.get(['theme'], (result) => {
        if (result.theme === 'dark') {
            document.body.classList.add('dark-mode');
        } else if (result.theme === 'system') {
            // Check system preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                document.body.classList.add('dark-mode');
            }
        }
    });

    // Prevent popup from closing when switching tabs
    chrome.runtime.sendMessage({ action: 'keepPopupOpen' }, (response) => {
        console.log('Keeping popup open:', response?.success);
    });

    // Listen for tab switched events
    chrome.runtime.onMessage.addListener((message) => {
        if (message.action === 'tabSwitched') {
            // Re-focus the popup window when tab is switched
            window.focus();
            return true;
        }
    });

    // Create a ping interval to keep the popup alive
    const pingInterval = setInterval(() => {
        chrome.runtime.sendMessage({ action: 'keepPopupOpen' }, (response) => {
            if (!response) {
                // If we get no response, the background script might be inactive
                clearInterval(pingInterval);
            }
        });
    }, 5000); // Send a ping every 5 seconds (reduced from 25s for better responsiveness)

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
    });

    // Send query to backend
    function sendQuery(query, url) {
        loading.style.display = 'block';
        answerBox.innerHTML = '';
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

                    // Save the answer for state persistence
                    chrome.storage.local.set({ lastAnswer: data.answer });

                    // Update history
                    fetchQueryHistory();
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

            // Create query display
            const queryText = document.createElement('div');
            queryText.className = 'history-query';
            queryText.textContent = `${item.query}`;

            // Create timestamp display
            const timestamp = document.createElement('div');
            timestamp.className = 'history-timestamp';
            timestamp.textContent = `${new Date(item.timestamp).toLocaleDateString()}`;

            // Add query and timestamp to item
            li.appendChild(queryText);
            li.appendChild(timestamp);

            // Store the answer in a data attribute
            li.dataset.answer = item.answer;

            // Add click event to display the answer
            li.addEventListener('click', () => {
                // Set the query in the input
                queryInput.value = item.query;
                updateCharCounter();

                // Display the answer
                const formattedAnswer = markdownToHTML(item.answer);
                answerBox.innerHTML = formattedAnswer;

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

    // Theme toggle button
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const newTheme = document.body.classList.contains('dark-mode') ? 'dark' : 'light';
        chrome.storage.local.set({ theme: newTheme });
    });

    // Settings button
    settingsBtn.addEventListener('click', () => {
        window.location.href = 'settings.html';
    });

    // Copy button for answer
    copyBtn.addEventListener('click', () => {
        // Get text content from answer box (including formatting)
        const textToCopy = answerBox.innerText;

        navigator.clipboard.writeText(textToCopy).then(() => {
            // Show success message
            showStatus(queryStatus, 'Copied to clipboard!', 'success');
        }).catch(err => {
            // Show error message
            showStatus(queryStatus, 'Failed to copy text', 'error');
        });
    });

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
        loginForm.style.display = 'none';
        userInfo.style.display = 'block';
        querySection.style.display = 'block';
        userEmail.textContent = email;
        fetchQueryHistory();
    }

    function showLoggedOutState() {
        loginForm.style.display = 'block';
        userInfo.style.display = 'none';
        querySection.style.display = 'none';
        historySection.style.display = 'none';
    }

    // Apply font sizes based on saved settings
    function applyFontSizeToPopup() {
        chrome.storage.local.get(['fontSize'], (result) => {
            const root = document.documentElement;
            const size = result.fontSize || 'medium';

            switch (size) {
                case 'small':
                    root.style.setProperty('font-size', '12px');
                    answerBox.style.fontSize = '12px';
                    break;
                case 'medium':
                    root.style.setProperty('font-size', '14px');
                    answerBox.style.fontSize = '14px';
                    break;
                case 'large':
                    root.style.setProperty('font-size', '16px');
                    answerBox.style.fontSize = '16px';
                    break;
            }
        });
    }

    // Apply font size when page loads
    applyFontSizeToPopup();

    // Logout button click handler
    logoutBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['authToken', 'userEmail', 'lastQuery', 'lastAnswer', 'isProcessing'], () => {
            authToken = '';
            showLoggedOutState();
            showStatus(authStatus, 'Logged out successfully', 'success');
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
});
