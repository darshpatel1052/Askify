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
    const answerBox = document.getElementById('answer-box');
    const loading = document.getElementById('loading');
    const historyList = document.getElementById('history-list');
    const loginBtn = document.getElementById('login-btn');
    const signupBtn = document.getElementById('signup-btn');
    const logoutBtn = document.getElementById('logout-btn');

    const API_BASE_URL = 'http://localhost:8000/api/v1'; // Change this in production
    let currentUrl = '';
    let authToken = '';

    // Check if user is logged in
    chrome.storage.local.get(['authToken', 'userEmail'], (result) => {
        if (result.authToken && result.userEmail) {
            authToken = result.authToken;
            showLoggedInState(result.userEmail);
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
            displayMessage('Please enter both email and password');
            return;
        }

        fetch(`${API_BASE_URL}/auth/token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `username=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
        })
            .then(response => response.json())
            .then(data => {
                if (data.access_token) {
                    authToken = data.access_token;
                    chrome.storage.local.set({
                        authToken: data.access_token,
                        userEmail: email
                    });
                    showLoggedInState(email);
                    fetchQueryHistory();
                } else {
                    displayMessage(data.detail || 'Login failed');
                }
            })
            .catch(error => {
                displayMessage('Error: ' + error.message);
            });
    });

    // Sign up button click handler
    signupBtn.addEventListener('click', () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            displayMessage('Please enter both email and password');
            return;
        }

        fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, password })
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    displayMessage('Account created! Please login.');
                } else {
                    displayMessage(data.message || 'Registration failed');
                }
            })
            .catch(error => {
                displayMessage('Error: ' + error.message);
            });
    });

    // Logout button click handler
    logoutBtn.addEventListener('click', () => {
        chrome.storage.local.remove(['authToken', 'userEmail'], () => {
            authToken = '';
            showLoggedOutState();
        });
    });

    // Query button click handler
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
            .then(response => response.json())
            .then(data => {
                loading.style.display = 'none';
                if (data.answer) {
                    // Convert markdown to HTML for proper rendering
                    const formattedAnswer = markdownToHTML(data.answer);
                    answerBox.innerHTML = formattedAnswer;
                    // Update history
                    fetchQueryHistory();
                } else {
                    displayMessage(data.message || 'Failed to get an answer');
                }
            })
            .catch(error => {
                loading.style.display = 'none';
                displayMessage('Error: ' + error.message);
            });
    }

    // Fetch user's query history
    function fetchQueryHistory() {
        fetch(`${API_BASE_URL}/query/history`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.history && data.history.length > 0) {
                    historySection.style.display = 'block';
                    historyList.innerHTML = '';
                    data.history.slice(0, 5).forEach(item => {
                        const li = document.createElement('li');
                        li.textContent = `${item.query} (${new Date(item.timestamp).toLocaleDateString()})`;
                        li.addEventListener('click', () => {
                            queryInput.value = item.query;
                        });
                        historyList.appendChild(li);
                    });
                } else {
                    historySection.style.display = 'none';
                }
            })
            .catch(error => {
                console.error('Error fetching history:', error);
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
    function displayMessage(message) {
        answerBox.innerHTML = `<p>${message}</p>`;
    }

    // Toggle UI based on auth state
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
});
