// Askify Next-Gen Side Panel Controller
document.addEventListener('DOMContentLoaded', async () => {
    // --- State Variables ---
    let activeTab = null;
    let pageData = null;
    let selectedFocusText = '';
    let isStreaming = false;
    let currentAbortController = null;
    let chatHistory = []; // { role: 'user' | 'assistant', content: string, sources?: any[] }
    let preferences = {
        theme: 'dark',
        engineMode: CONFIG.DEFAULT_ENGINE_MODE || 'backend',
        model: CONFIG.DEFAULT_MODEL || 'gpt-4o-mini',
        backendUrl: CONFIG.API_BASE_URL || 'http://localhost:8000/api/v1',
        openaiKey: '',
        geminiKey: '',
        anthropicKey: '',
        ollamaUrl: CONFIG.OLLAMA_BASE_URL || 'http://localhost:11434'
    };

    // --- DOM Elements ---
    const chatFeed = document.getElementById('chat-feed');
    const welcomeState = document.getElementById('welcome-state');
    const queryTextarea = document.getElementById('query-textarea');
    const sendBtn = document.getElementById('send-btn');
    const activeTabTitle = document.getElementById('active-tab-title');
    const wordCountChip = document.getElementById('word-count-chip');
    const statusDot = document.getElementById('status-dot');
    const refreshPageBtn = document.getElementById('refresh-page-btn');
    const modelSelect = document.getElementById('model-select');
    const themeToggleBtn = document.getElementById('theme-toggle-btn');
    const clearChatBtn = document.getElementById('clear-chat-btn');
    const exportChatBtn = document.getElementById('export-chat-btn');
    const focusIndicator = document.getElementById('focus-indicator');
    const focusText = document.getElementById('focus-text');
    const clearFocusBtn = document.getElementById('clear-focus-btn');
    const quickActionsBar = document.getElementById('quick-actions-bar');

    // Settings Modal DOM
    const settingsModal = document.getElementById('settings-modal');
    const settingsOpenBtn = document.getElementById('settings-open-btn');
    const settingsCloseBtn = document.getElementById('settings-close-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const engineModeSelect = document.getElementById('engine-mode-select');
    const backendUrlInput = document.getElementById('backend-url-input');
    const openaiKeyInput = document.getElementById('openai-key-input');
    const geminiKeyInput = document.getElementById('gemini-key-input');
    const anthropicKeyInput = document.getElementById('anthropic-key-input');
    const ollamaUrlInput = document.getElementById('ollama-url-input');

    // --- 1. Initialization ---
    await loadPreferences();
    setupEventListeners();
    await loadActiveTabContent();
    checkPendingAction();

    // --- 2. Load & Sync Preferences ---
    async function loadPreferences() {
        return new Promise((resolve) => {
            chrome.storage.local.get([
                'theme', 'engineMode', 'model', 'backendUrl',
                'openaiKey', 'geminiKey', 'anthropicKey', 'ollamaUrl', 'chatHistory'
            ], (res) => {
                if (res.theme) preferences.theme = res.theme;
                if (res.engineMode) preferences.engineMode = res.engineMode;
                if (res.model) preferences.model = res.model;
                if (res.backendUrl) preferences.backendUrl = res.backendUrl;
                if (res.openaiKey) preferences.openaiKey = res.openaiKey;
                if (res.geminiKey) preferences.geminiKey = res.geminiKey;
                if (res.anthropicKey) preferences.anthropicKey = res.anthropicKey;
                if (res.ollamaUrl) preferences.ollamaUrl = res.ollamaUrl;
                if (res.chatHistory && Array.isArray(res.chatHistory)) {
                    chatHistory = res.chatHistory;
                    restoreChatHistory();
                }

                // Apply UI preferences
                applyTheme(preferences.theme);
                modelSelect.value = preferences.model;
                engineModeSelect.value = preferences.engineMode;
                backendUrlInput.value = preferences.backendUrl;
                openaiKeyInput.value = preferences.openaiKey;
                geminiKeyInput.value = preferences.geminiKey;
                anthropicKeyInput.value = preferences.anthropicKey;
                ollamaUrlInput.value = preferences.ollamaUrl;

                resolve();
            });
        });
    }

    function applyTheme(theme) {
        if (theme === 'system') {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.body.setAttribute('data-theme', isDark ? 'dark' : 'light');
        } else {
            document.body.setAttribute('data-theme', theme);
        }
    }

    // --- 3. Active Tab Content Extraction ---
    async function loadActiveTabContent() {
        statusDot.className = 'sp-status-dot';
        activeTabTitle.textContent = 'Inspecting webpage...';
        wordCountChip.textContent = '...';

        try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs || tabs.length === 0) {
                setTabStatusRestricted('No active tab found');
                return;
            }
            activeTab = tabs[0];

            // Check if restricted URL (chrome://, edge://, webstore)
            if (isRestrictedUrl(activeTab.url)) {
                setTabStatusRestricted('Internal browser page');
                return;
            }

            // Request extraction from content script
            chrome.tabs.sendMessage(activeTab.id, { action: 'extractContent' }, (response) => {
                if (chrome.runtime.lastError || !response || !response.success) {
                    // Content script might need manual injection if loaded before extension
                    injectAndExtractContent(activeTab.id);
                    return;
                }
                handleExtractedContent(response.data);
            });

        } catch (err) {
            console.error('[Askify] Tab inspection error:', err);
            setTabStatusRestricted('Unable to read tab');
        }
    }

    function isRestrictedUrl(url) {
        if (!url) return true;
        return url.startsWith('chrome://') ||
               url.startsWith('chrome-extension://') ||
               url.startsWith('https://chromewebstore.google.com') ||
               url.startsWith('edge://') ||
               url.startsWith('view-source:');
    }

    function setTabStatusRestricted(reason) {
        statusDot.className = 'sp-status-dot restricted';
        activeTabTitle.textContent = reason;
        wordCountChip.textContent = 'General Mode';
        pageData = null;
    }

    function injectAndExtractContent(tabId) {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        }, () => {
            if (chrome.runtime.lastError) {
                setTabStatusRestricted('Protected webpage');
                return;
            }
            chrome.tabs.sendMessage(tabId, { action: 'extractContent' }, (response) => {
                if (response && response.success) {
                    handleExtractedContent(response.data);
                } else {
                    setTabStatusRestricted('Protected / Empty page');
                }
            });
        });
    }

    function handleExtractedContent(data) {
        pageData = data;
        statusDot.className = 'sp-status-dot online';
        activeTabTitle.textContent = data.metadata.title || activeTab.title || 'Active Page';
        activeTabTitle.title = data.metadata.url || activeTab.url;
        wordCountChip.textContent = `${data.wordCount.toLocaleString()} words`;

        // Check if user has selected text
        if (data.selectedText && data.selectedText.length > 5) {
            setFocusSelection(data.selectedText);
        }
    }

    function setFocusSelection(text) {
        selectedFocusText = text;
        const words = text.split(/\s+/).filter(Boolean).length;
        focusText.textContent = `Focus: Selected text (${words} words)`;
        focusIndicator.style.display = 'flex';
    }

    function clearFocusSelection() {
        selectedFocusText = '';
        focusIndicator.style.display = 'none';
    }

    // --- 4. Pending Actions Handler (Context Menus & Floating Widget) ---
    function checkPendingAction() {
        chrome.storage.local.get(['pendingAction'], (res) => {
            if (res.pendingAction && Date.now() - res.pendingAction.timestamp < 10000) {
                const action = res.pendingAction;
                chrome.storage.local.remove(['pendingAction']);

                if (action.text) {
                    setFocusSelection(action.text);
                }

                if (action.type === 'explain') {
                    handleUserQuery(`Please explain the following selected text clearly and concisely:\n\n"${action.text}"`);
                } else if (action.type === 'summarize') {
                    handleUserQuery(`Please provide a concise summary with key takeaways of this section:\n\n"${action.text}"`);
                }
            }
        });
    }

    // --- 5. Event Listeners ---
    function setupEventListeners() {
        // Textarea auto-resize & Enter to send
        queryTextarea.addEventListener('input', () => {
            queryTextarea.style.height = 'auto';
            queryTextarea.style.height = Math.min(queryTextarea.scrollHeight, 120) + 'px';
        });

        queryTextarea.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submitQuery();
            }
        });

        sendBtn.addEventListener('click', submitQuery);

        // Quick Action Chips
        quickActionsBar.querySelectorAll('.sp-action-chip').forEach(btn => {
            btn.addEventListener('click', () => {
                const prompt = btn.getAttribute('data-prompt');
                if (prompt) handleUserQuery(prompt);
            });
        });

        // Suggested Cards in Welcome State
        document.querySelectorAll('.sp-suggested-card').forEach(card => {
            card.addEventListener('click', () => {
                const prompt = card.getAttribute('data-prompt');
                if (prompt) handleUserQuery(prompt);
            });
        });

        // Model Selector
        modelSelect.addEventListener('change', () => {
            preferences.model = modelSelect.value;
            chrome.storage.local.set({ model: preferences.model });
        });

        // Theme Toggle
        themeToggleBtn.addEventListener('click', () => {
            const current = document.body.getAttribute('data-theme') || 'dark';
            const next = current === 'dark' ? 'light' : 'dark';
            preferences.theme = next;
            applyTheme(next);
            chrome.storage.local.set({ theme: next });
        });

        // Refresh Page Extraction
        refreshPageBtn.addEventListener('click', loadActiveTabContent);

        // Clear Selection Focus
        clearFocusBtn.addEventListener('click', clearFocusSelection);

        // Clear Chat
        clearChatBtn.addEventListener('click', () => {
            if (confirm('Clear current conversation history?')) {
                chatHistory = [];
                chrome.storage.local.remove(['chatHistory']);
                renderChatFeed();
            }
        });

        // Export Chat to Markdown
        exportChatBtn.addEventListener('click', exportChatToMarkdown);

        // Settings Modal
        settingsOpenBtn.addEventListener('click', () => settingsModal.style.display = 'flex');
        settingsCloseBtn.addEventListener('click', () => settingsModal.style.display = 'none');
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) settingsModal.style.display = 'none';
        });

        saveSettingsBtn.addEventListener('click', () => {
            preferences.engineMode = engineModeSelect.value;
            preferences.backendUrl = backendUrlInput.value.trim() || CONFIG.API_BASE_URL;
            preferences.openaiKey = openaiKeyInput.value.trim();
            preferences.geminiKey = geminiKeyInput.value.trim();
            preferences.anthropicKey = anthropicKeyInput.value.trim();
            preferences.ollamaUrl = ollamaUrlInput.value.trim() || CONFIG.OLLAMA_BASE_URL;

            chrome.storage.local.set({
                engineMode: preferences.engineMode,
                backendUrl: preferences.backendUrl,
                openaiKey: preferences.openaiKey,
                geminiKey: preferences.geminiKey,
                anthropicKey: preferences.anthropicKey,
                ollamaUrl: preferences.ollamaUrl
            });

            settingsModal.style.display = 'none';
        });
    }

    function submitQuery() {
        const query = queryTextarea.value.trim();
        if (!query || isStreaming) return;

        queryTextarea.value = '';
        queryTextarea.style.height = 'auto';
        handleUserQuery(query);
    }

    // --- 6. Query Processing & Streaming ---
    async function handleUserQuery(userPrompt) {
        if (welcomeState) welcomeState.style.display = 'none';

        // Add user message
        const userMsg = { role: 'user', content: userPrompt };
        chatHistory.push(userMsg);
        appendMessageUI('user', userPrompt);

        // Add assistant placeholder with streaming cursor
        const assistantIndex = chatHistory.length;
        const assistantMsg = { role: 'assistant', content: '' };
        chatHistory.push(assistantMsg);
        const bubbleEl = appendMessageUI('assistant', '', true);

        isStreaming = true;
        sendBtn.disabled = true;
        currentAbortController = new AbortController();

        try {
            // Determine context
            let contextText = '';
            if (selectedFocusText) {
                contextText = `[User Selected Text Context]:\n${selectedFocusText}`;
            } else if (pageData && pageData.content) {
                contextText = `Page Title: ${pageData.metadata.title}\nPage URL: ${pageData.metadata.url}\n\nPage Content:\n${pageData.content.slice(0, 30000)}`;
            }

            // Stream response based on selected engine mode
            if (preferences.engineMode === 'backend') {
                try {
                    await streamFromBackend(userPrompt, contextText, bubbleEl, assistantIndex);
                } catch (backendErr) {
                    console.warn('[Askify] Backend fetch error:', backendErr);
                    // Check if user has an API key for automatic BYOK fallback
                    if (preferences.openaiKey || preferences.geminiKey || preferences.anthropicKey) {
                        console.log('[Askify] Falling back to client-side BYOK mode...');
                        await streamFromClientBYOK(userPrompt, contextText, bubbleEl, assistantIndex);
                    } else {
                        // Instant in-browser analysis fallback for summaries / power tools
                        const qLower = userPrompt.toLowerCase();
                        if (pageData && pageData.content && (qLower.includes('summar') || qLower.includes('tldr') || qLower.includes('point') || qLower.includes('bullet') || qLower.includes('insight') || qLower.includes('faq') || qLower.includes('data'))) {
                            const summaryText = generateClientSideSummary(pageData.content, pageData.headings, userPrompt);
                            bubbleEl.innerHTML = renderMarkdown(summaryText);
                            chatHistory[assistantIndex].content = summaryText;
                        } else {
                            const offlineMsg = `### 🔌 Backend Server Offline\n\nCould not connect to the local server at \`${preferences.backendUrl}\`.\n\n**To resolve this (choose one):**\n\n1. **Use Standalone Mode (Zero Server Required):**\n   Click **Settings** (⚙️ top right) and enter your OpenAI, Gemini, or Anthropic API key.\n\n2. **Start the Local Backend Server:**\n   Run this in your terminal:\n   \`\`\`bash\n   cd backend && python run.py\n   \`\`\``;
                            bubbleEl.innerHTML = renderMarkdown(offlineMsg);
                            chatHistory[assistantIndex].content = offlineMsg;
                        }
                    }
                }
            } else {
                await streamFromClientBYOK(userPrompt, contextText, bubbleEl, assistantIndex);
            }

        } catch (err) {
            console.error('[Askify] Stream error:', err);
            bubbleEl.innerHTML = `<span style="color: var(--error);">Error generating answer: ${escapeHTML(err.message)}</span>`;
            chatHistory[assistantIndex].content = `Error: ${err.message}`;
        } finally {
            isStreaming = false;
            sendBtn.disabled = false;
            currentAbortController = null;
            // Save history
            chrome.storage.local.set({ chatHistory: chatHistory });
            // Remove cursor
            const cursor = bubbleEl.querySelector('.sp-cursor');
            if (cursor) cursor.remove();
        }
    }

    // Client-side extractive summary fallback when offline/no backend
    function generateClientSideSummary(content, headings, query) {
        const sentences = content
            .replace(/\n+/g, ' ')
            .split(/(?<=[.?!])\s+/)
            .map(s => s.trim())
            .filter(s => s.length > 35 && s.length < 280 && !s.toLowerCase().includes('cookie') && !s.toLowerCase().includes('privacy'));

        let bullets = [];
        if (sentences.length >= 3) {
            bullets = [
                `**1. Core Subject:** ${sentences[0]}`,
                `**2. Key Finding:** ${sentences[Math.floor(sentences.length / 2)]}`,
                `**3. Conclusion:** ${sentences[sentences.length - 1]}`
            ];
        } else if (sentences.length > 0) {
            bullets = sentences.slice(0, 3).map((s, idx) => `**${idx + 1}.** ${s}`);
        } else {
            bullets = [`**Extracted Content:** ${content.slice(0, 250)}...`];
        }

        let topics = '';
        if (headings && headings.length > 0) {
            const topicList = headings.slice(0, 4).map(h => `\`${h.text}\``).join(' • ');
            topics = `\n\n**📌 Key Topics Detected:** ${topicList}`;
        }

        return `### ⚡ Page Summary (Client-Side Extraction)\n\n${bullets.join('\n\n')}${topics}\n\n---\n> 💡 *Extracted directly from live webpage DOM. To enable deep AI reasoning, click **Settings (⚙️)** to add an API key or start your backend (\`python run.py\`)*.`;
    }

    // --- 7. Streaming Engine: Backend FastAPI (Hybrid RAG) ---
    async function streamFromBackend(query, context, bubbleEl, msgIndex) {
        const url = activeTab?.url || 'https://example.com';
        let accumulatedText = '';

        const response = await fetch(CONFIG.STREAM_ENDPOINT || `${preferences.backendUrl}/query/stream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: query,
                url: url,
                page_content: pageData?.content || '',
                selected_text: selectedFocusText || '',
                model: preferences.model
            }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            // If backend is not running, fallback guidance
            if (response.status === 404 || response.status === 502 || response.status === 500) {
                throw new Error(`Backend service error (${response.status}). If backend server is not running, switch to 'Standalone BYOK' mode in Settings.`);
            }
            throw new Error(`Server returned HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // keep remainder

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.slice(6).trim();
                    if (dataStr === '[DONE]') continue;
                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.token) {
                            accumulatedText += parsed.token;
                            bubbleEl.innerHTML = renderMarkdown(accumulatedText) + '<span class="sp-cursor"></span>';
                            scrollChatToBottom();
                        }
                    } catch (e) {
                        // Plain token string fallback
                        accumulatedText += dataStr;
                        bubbleEl.innerHTML = renderMarkdown(accumulatedText) + '<span class="sp-cursor"></span>';
                        scrollChatToBottom();
                    }
                }
            }
        }

        chatHistory[msgIndex].content = accumulatedText;
        bubbleEl.innerHTML = renderMarkdown(accumulatedText);
        attachCodeCopyButtons(bubbleEl);
    }

    // --- 8. Streaming Engine: Client-Side BYOK (OpenAI / Gemini / Claude / Ollama) ---
    async function streamFromClientBYOK(query, context, bubbleEl, msgIndex) {
        const model = preferences.model;
        let accumulatedText = '';

        // Check provider
        if (model.startsWith('gemini') && preferences.geminiKey) {
            // Google Gemini API Stream
            accumulatedText = await streamGemini(query, context, preferences.geminiKey, model, bubbleEl);
        } else if (model.startsWith('claude') && preferences.anthropicKey) {
            // Anthropic Claude
            accumulatedText = await streamClaude(query, context, preferences.anthropicKey, model, bubbleEl);
        } else if (model.startsWith('llama') || model.startsWith('ollama')) {
            // Local Ollama
            accumulatedText = await streamOllama(query, context, preferences.ollamaUrl, model, bubbleEl);
        } else if (preferences.openaiKey) {
            // OpenAI GPT
            accumulatedText = await streamOpenAI(query, context, preferences.openaiKey, model, bubbleEl);
        } else {
            // No key provided
            const msg = `**API Key Required for BYOK Mode**\n\nPlease open **Settings** (⚙️ top right) and enter your OpenAI, Gemini, or Anthropic API key, or switch to **FastAPI Backend** mode if your server is running.`;
            bubbleEl.innerHTML = renderMarkdown(msg);
            chatHistory[msgIndex].content = msg;
            return;
        }

        chatHistory[msgIndex].content = accumulatedText;
        bubbleEl.innerHTML = renderMarkdown(accumulatedText);
        attachCodeCopyButtons(bubbleEl);
    }

    // OpenAI Streaming Implementation
    async function streamOpenAI(query, context, apiKey, model, bubbleEl) {
        let text = '';
        const systemPrompt = `You are Askify, a smart, context-aware web copilot.
Answer the user's questions based on the provided webpage content or selection.
Be concise, well-structured, and use Markdown (bullet points, bold key terms, tables, and code blocks).

Context:
${context || 'No specific page context available.'}`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model || 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...chatHistory.slice(-4, -2), // Previous turn for memory
                    { role: 'user', content: query }
                ],
                stream: true,
                temperature: 0.3
            }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || `OpenAI Error (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
                    try {
                        const json = JSON.parse(trimmed.slice(6));
                        const delta = json.choices[0]?.delta?.content || '';
                        text += delta;
                        bubbleEl.innerHTML = renderMarkdown(text) + '<span class="sp-cursor"></span>';
                        scrollChatToBottom();
                    } catch (e) {}
                }
            }
        }
        return text;
    }

    // Local Ollama Streaming Implementation
    async function streamOllama(query, context, ollamaUrl, model, bubbleEl) {
        let text = '';
        const prompt = `Webpage Context:\n${context}\n\nQuestion: ${query}`;

        const response = await fetch(`${ollamaUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'llama3:8b',
                prompt: prompt,
                stream: true
            }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            throw new Error(`Could not connect to Ollama at ${ollamaUrl}. Make sure Ollama is running.`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            chunk.split('\n').forEach(line => {
                if (!line.trim()) return;
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        text += json.response;
                        bubbleEl.innerHTML = renderMarkdown(text) + '<span class="sp-cursor"></span>';
                        scrollChatToBottom();
                    }
                } catch (e) {}
            });
        }
        return text;
    }

    // Google Gemini Streaming Implementation
    async function streamGemini(query, context, apiKey, model, bubbleEl) {
        let text = '';
        const fullPrompt = `You are Askify, a smart web assistant.\n\nContext:\n${context}\n\nUser Question:\n${query}`;
        const targetModel = model.includes('pro') ? 'gemini-1.5-pro' : 'gemini-1.5-flash';

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:streamGenerateContent?key=${apiKey}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: fullPrompt }] }]
            }),
            signal: currentAbortController.signal
        });

        if (!response.ok) {
            throw new Error(`Gemini API error (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            // Gemini streams JSON array chunks
            try {
                // Look for candidate text in chunks
                const matches = buffer.match(/"text":\s*"([^"\\]*(?:\\.[^"\\]*)*)"/g);
                if (matches) {
                    let chunkText = '';
                    matches.forEach(m => {
                        const sub = m.replace(/^"text":\s*"/, '').replace(/"$/, '');
                        chunkText += JSON.parse(`"${sub}"`);
                    });
                    text = chunkText;
                    bubbleEl.innerHTML = renderMarkdown(text) + '<span class="sp-cursor"></span>';
                    scrollChatToBottom();
                }
            } catch (e) {}
        }
        return text;
    }

    // --- 9. Markdown Parser & UI Helpers ---
    function renderMarkdown(md) {
        if (!md) return '';

        let html = md
            // Escape HTML tags to prevent XSS
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            // Code Blocks ```lang ... ```
            .replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
                const cleanLang = lang || 'code';
                return `<div class="sp-code-block">
                    <div class="sp-code-header">
                        <span>${cleanLang}</span>
                        <button class="sp-code-copy-btn">Copy</button>
                    </div>
                    <pre><code>${code.trim()}</code></pre>
                </div>`;
            })
            // Inline Code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            // Headings
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold and Italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Blockquotes
            .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
            // Bullet Lists
            .replace(/^\s*[\-\*]\s+(.*$)/gim, '<li>$1</li>')
            // Numbered Lists
            .replace(/^\s*\d+\.\s+(.*$)/gim, '<li>$1</li>')
            // Tables (simple line parse)
            .replace(/\|(.+)\|/g, (match) => {
                const cells = match.split('|').filter(c => c.trim().length > 0);
                if (cells.some(c => c.includes('---'))) return ''; // skip divider row
                const isHeader = !match.includes('---');
                return `<tr>${cells.map(c => `<td>${c.trim()}</td>`).join('')}</tr>`;
            })
            // Paragraph breaks
            .replace(/\n\n+/g, '</p><p>')
            .replace(/\n/g, '<br>');

        return `<p>${html}</p>`;
    }

    function attachCodeCopyButtons(container) {
        container.querySelectorAll('.sp-code-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const code = btn.closest('.sp-code-block').querySelector('code').innerText;
                navigator.clipboard.writeText(code).then(() => {
                    btn.textContent = 'Copied!';
                    setTimeout(() => btn.textContent = 'Copy', 1500);
                });
            });
        });
    }

    function appendMessageUI(role, text, withCursor = false) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `sp-msg ${role}`;

        if (role === 'assistant') {
            msgDiv.innerHTML = `
                <div class="sp-msg-header">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    <span>Askify</span>
                </div>
                <div class="sp-msg-bubble">${renderMarkdown(text)}${withCursor ? '<span class="sp-cursor"></span>' : ''}</div>
            `;
            chatFeed.appendChild(msgDiv);
            scrollChatToBottom();
            return msgDiv.querySelector('.sp-msg-bubble');
        } else {
            msgDiv.innerHTML = `
                <div class="sp-msg-bubble">${escapeHTML(text)}</div>
            `;
            chatFeed.appendChild(msgDiv);
            scrollChatToBottom();
            return msgDiv.querySelector('.sp-msg-bubble');
        }
    }

    function restoreChatHistory() {
        if (chatHistory.length > 0 && welcomeState) {
            welcomeState.style.display = 'none';
        }
        chatFeed.innerHTML = '';
        chatHistory.forEach(msg => {
            const bubble = appendMessageUI(msg.role, msg.content);
            if (msg.role === 'assistant') {
                attachCodeCopyButtons(bubble);
            }
        });
    }

    function scrollChatToBottom() {
        chatFeed.scrollTop = chatFeed.scrollHeight;
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- 10. Export to Markdown ---
    function exportChatToMarkdown() {
        if (chatHistory.length === 0) {
            alert('No conversation to export.');
            return;
        }

        let md = `# Askify Analysis: ${activeTab?.title || 'Webpage Notes'}\n`;
        md += `*URL:* ${activeTab?.url || 'N/A'}\n`;
        md += `*Date:* ${new Date().toLocaleString()}\n\n---\n\n`;

        chatHistory.forEach(item => {
            const speaker = item.role === 'user' ? '### 👤 User' : '### 🤖 Askify Copilot';
            md += `${speaker}\n\n${item.content}\n\n`;
        });

        // Trigger download
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Askify-Notes-${Date.now()}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }
});
