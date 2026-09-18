// Askify Next-Gen Content Script
// Resilient In-Browser Content Extractor & Floating Assistant Widget
(function () {
    'use strict';

    // Prevent double injection
    if (window.__ASKIFY_INJECTED__) return;
    window.__ASKIFY_INJECTED__ = true;

    // --- 1. Resilient Content Extraction Engine ---
    function extractPageData() {
        const url = window.location.href;
        const isYouTube = window.location.hostname.includes('youtube.com') && url.includes('/watch');

        // Check if on YouTube
        if (isYouTube) {
            return extractYouTubeData();
        }

        const metadata = {
            title: document.title || '',
            url: url,
            domain: window.location.hostname,
            description: getMetaContent('description') || getMetaContent('og:description') || '',
            author: getMetaContent('author') || getMetaContent('article:author') || '',
            timestamp: new Date().toISOString()
        };

        // Deep Readability DOM Extraction
        const extracted = extractArticleContent();

        return {
            metadata,
            content: extracted.text,
            headings: extracted.headings,
            tables: extracted.tables,
            codeBlocks: extracted.codeBlocks,
            selectedText: getSelectedText(),
            wordCount: countWords(extracted.text),
            isProtectedOrEmpty: extracted.text.trim().length < 50
        };
    }

    function getMetaContent(name) {
        const el = document.querySelector(`meta[name="${name}" i], meta[property="${name}" i]`);
        return el ? el.getAttribute('content') : '';
    }

    function countWords(str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).filter(Boolean).length;
    }

    function getSelectedText() {
        const selection = window.getSelection();
        return selection ? selection.toString().trim() : '';
    }

    // YouTube specific extractor
    function extractYouTubeData() {
        const titleEl = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, #title h1');
        const title = titleEl ? titleEl.innerText.trim() : document.title;
        const channelEl = document.querySelector('#channel-name #text a, ytd-channel-name yt-formatted-string');
        const channel = channelEl ? channelEl.innerText.trim() : '';
        const descEl = document.querySelector('#description-inline-expander, #description yt-formatted-string');
        const description = descEl ? descEl.innerText.trim() : '';

        // Try extracting rendered transcript if visible
        let transcript = '';
        const transcriptSegments = document.querySelectorAll('ytd-transcript-segment-renderer');
        if (transcriptSegments.length > 0) {
            transcript = Array.from(transcriptSegments)
                .map(seg => {
                    const time = seg.querySelector('.segment-timestamp')?.innerText?.trim() || '';
                    const text = seg.querySelector('.segment-text')?.innerText?.trim() || '';
                    return `[${time}] ${text}`;
                })
                .join('\n');
        }

        let fullContent = `YouTube Video: ${title}\nChannel: ${channel}\n\n`;
        if (description) {
            fullContent += `Description:\n${description}\n\n`;
        }
        if (transcript) {
            fullContent += `Transcript:\n${transcript}\n`;
        } else {
            fullContent += `(Note: Full transcript closed/not opened. To capture transcript, open YouTube transcript panel.)`;
        }

        return {
            metadata: {
                title: `[YouTube] ${title}`,
                url: window.location.href,
                domain: 'youtube.com',
                channel: channel,
                timestamp: new Date().toISOString()
            },
            content: fullContent,
            headings: [{ level: 1, text: title }],
            tables: [],
            codeBlocks: [],
            selectedText: getSelectedText(),
            wordCount: countWords(fullContent),
            isProtectedOrEmpty: false
        };
    }

    // Heuristic article & body extractor
    function extractArticleContent() {
        // Clone body to manipulate without breaking the live page
        const clone = (document.body || document.documentElement).cloneNode(true);

        // Remove elements that pollute context
        const unwantedSelectors = [
            'script', 'style', 'noscript', 'iframe', 'svg', 'canvas',
            'nav', 'footer', 'header', 'aside',
            '.nav', '.navbar', '.footer', '.header', '.sidebar', '.menu',
            '.advertisement', '.ad', '.ads', '.cookie-banner', '.consent-modal',
            '#cookie-notice', '#disclaimer', '[role="alert"]', '[aria-hidden="true"]',
            '.social-share', '.comments', '#comments'
        ];

        unwantedSelectors.forEach(sel => {
            clone.querySelectorAll(sel).forEach(el => el.remove());
        });

        // 1. Extract Code Blocks with language
        const codeBlocks = [];
        clone.querySelectorAll('pre, pre code').forEach(pre => {
            const lang = pre.getAttribute('class')?.match(/language-([a-zA-Z0-9_-]+)/)?.[1] || '';
            const code = pre.innerText.trim();
            if (code.length > 10) {
                codeBlocks.push({ language: lang, code });
            }
        });

        // 2. Extract and format HTML Tables into Markdown tables
        const tables = [];
        clone.querySelectorAll('table').forEach(table => {
            const mdTable = htmlTableToMarkdown(table);
            if (mdTable) {
                tables.push(mdTable);
                // Replace table with markdown text representation in clone
                const textNode = document.createTextNode('\n\n' + mdTable + '\n\n');
                table.parentNode?.replaceChild(textNode, table);
            }
        });

        // 3. Extract Headings for document outline
        const headings = [];
        document.querySelectorAll('h1, h2, h3').forEach(h => {
            const level = parseInt(h.tagName[1], 10);
            const text = h.innerText.trim();
            if (text && text.length < 150) {
                headings.push({ level, text });
            }
        });

        // 4. Determine main content container
        const mainSelectors = [
            'article',
            '[role="main"]',
            'main',
            '.post-content',
            '.article-content',
            '.entry-content',
            '#content',
            '.markdown-body',
            '.content'
        ];

        let target = null;
        for (const selector of mainSelectors) {
            const candidate = clone.querySelector(selector);
            if (candidate && candidate.innerText.trim().length > 300) {
                target = candidate;
                break;
            }
        }

        if (!target) {
            target = clone;
        }

        // Clean text formatting
        let rawText = target.innerText || target.textContent || '';
        // Normalize multiple linebreaks and whitespaces
        const cleanedText = rawText
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n');

        return {
            text: cleanedText,
            headings,
            tables,
            codeBlocks
        };
    }

    // Convert an HTML table into a clean GitHub Markdown table
    function htmlTableToMarkdown(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        if (rows.length === 0) return null;

        const tableData = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => cell.innerText.trim().replace(/\|/g, '\\|').replace(/\n/g, ' '));
        }).filter(row => row.length > 0);

        if (tableData.length === 0) return null;

        const maxCols = Math.max(...tableData.map(r => r.length));
        if (maxCols === 0) return null;

        // Normalize rows to same column count
        const normalized = tableData.map(r => {
            while (r.length < maxCols) r.push('');
            return r;
        });

        const headerRow = normalized[0];
        const separatorRow = new Array(maxCols).fill('---');
        const dataRows = normalized.slice(1);

        let md = `| ${headerRow.join(' | ')} |\n| ${separatorRow.join(' | ')} |\n`;
        dataRows.forEach(r => {
            md += `| ${r.join(' | ')} |\n`;
        });

        return md.trim();
    }

    // --- 2. Interactive In-Page Floating Selection Widget ---
    let floatingBubble = null;

    function createFloatingBubble() {
        if (floatingBubble) return floatingBubble;

        floatingBubble = document.createElement('div');
        floatingBubble.id = 'askify-floating-bubble';
        floatingBubble.innerHTML = `
            <div class="askify-bubble-inner">
                <div class="askify-bubble-brand">
                    <svg width="15" height="15" viewBox="0 0 128 128" fill="none">
                        <rect x="12" y="12" width="104" height="104" rx="28" fill="url(#bfg)"/>
                        <path d="M64 28L40 86H52.5L58 72H70L75.5 86H88L64 28ZM64 43.5L67.8 62.5H60.2L64 43.5Z" fill="#FFF"/>
                        <circle cx="88" cy="37" r="8" fill="#FDE047"/>
                        <defs>
                            <linearGradient id="bfg" x1="12" y1="12" x2="116" y2="116" gradientUnits="userSpaceOnUse">
                                <stop stop-color="#6366F1"/><stop offset="1" stop-color="#06B6D4"/>
                            </linearGradient>
                        </defs>
                    </svg>
                    <span>Askify</span>
                </div>
                <div class="askify-bubble-actions">
                    <button class="askify-bubble-btn" data-action="explain" title="Explain selected text">
                        <span>Explain</span>
                    </button>
                    <button class="askify-bubble-btn" data-action="summarize" title="Summarize selected text">
                        <span>Summarize</span>
                    </button>
                    <button class="askify-bubble-btn" data-action="ask" title="Open Askify Side Panel with selection">
                        <span>Ask AI</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(floatingBubble);

        // Attach action handlers
        floatingBubble.querySelectorAll('.askify-bubble-btn').forEach(btn => {
            btn.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const action = btn.getAttribute('data-action');
                const selectedText = getSelectedText();
                if (!selectedText) return;

                // Send message to background / side panel
                chrome.runtime.sendMessage({
                    action: 'quickAction',
                    actionType: action,
                    selectedText: selectedText,
                    pageTitle: document.title,
                    url: window.location.href
                });

                hideFloatingBubble();
            });
        });

        return floatingBubble;
    }

    function showFloatingBubble(x, y) {
        const bubble = createFloatingBubble();
        // Prevent bubble from going off screen
        const scrollX = window.scrollX || window.pageXOffset;
        const scrollY = window.scrollY || window.pageYOffset;
        const bubbleWidth = 240;
        const bubbleHeight = 42;

        let posX = x + scrollX - (bubbleWidth / 2);
        let posY = y + scrollY - bubbleHeight - 10;

        if (posX < 10) posX = 10;
        if (posX + bubbleWidth > window.innerWidth - 10) posX = window.innerWidth - bubbleWidth - 10;
        if (posY < 10) posY = y + scrollY + 25; // Flip below cursor if at very top

        bubble.style.left = `${posX}px`;
        bubble.style.top = `${posY}px`;
        bubble.classList.add('askify-bubble-visible');
    }

    function hideFloatingBubble() {
        if (floatingBubble) {
            floatingBubble.classList.remove('askify-bubble-visible');
        }
    }

    // Selection listener
    document.addEventListener('mouseup', (e) => {
        // Ignore clicks inside the bubble itself
        if (floatingBubble && floatingBubble.contains(e.target)) return;

        setTimeout(() => {
            const text = getSelectedText();
            if (text && text.length >= 8 && text.length <= 4000) {
                showFloatingBubble(e.clientX, e.clientY);
            } else {
                hideFloatingBubble();
            }
        }, 30);
    });

    document.addEventListener('mousedown', (e) => {
        if (floatingBubble && !floatingBubble.contains(e.target)) {
            hideFloatingBubble();
        }
    });

    // --- 3. Message Listener for Popup and Side Panel ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'extractContent') {
            try {
                const data = extractPageData();
                sendResponse({ success: true, data: data });
            } catch (error) {
                console.error('[Askify] Content extraction error:', error);
                sendResponse({ success: false, error: error.message });
            }
            return true;
        }

        if (request.action === 'getSelectedText') {
            sendResponse({ selectedText: getSelectedText() });
            return true;
        }

        if (request.action === 'highlightSnippet') {
            // Optional: highlight text on page if matched
            sendResponse({ success: true });
            return true;
        }
    });

})();
