// This content script runs on the webpages the user visits
// It will extract content from the page when requested by the popup or background script

// Function to extract relevant content from the page
function extractPageContent() {
    // Get page metadata
    const metadata = {
        title: document.title,
        url: window.location.href,
        timestamp: new Date().toISOString()
    };

    // Get main content - this is a simplified approach
    // In a production version, you would use more sophisticated content extraction
    function getMainContent() {
        // Try to get content from main elements first
        const mainElements = document.querySelectorAll('main, article, .content, .main, .article, #content, #main, #article');

        if (mainElements.length > 0) {
            // Use the first main element found
            return Array.from(mainElements)
                .map(el => el.innerText)
                .join('\n\n');
        }

        // Fallback to body content, excluding script and style elements
        const bodyClone = document.body.cloneNode(true);
        const unwantedElements = bodyClone.querySelectorAll('script, style, nav, footer, header, aside');

        unwantedElements.forEach(el => el.remove());

        return bodyClone.innerText;
    }

    // Extract headings for structure
    const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(h => ({
            level: parseInt(h.tagName[1]),
            text: h.innerText.trim()
        }))
        .filter(h => h.text.length > 0);

    // Get links that might be relevant
    const links = Array.from(document.querySelectorAll('a[href]'))
        .map(a => ({
            text: a.innerText.trim(),
            href: a.href
        }))
        .filter(link => link.text.length > 0);

    // Get images with alt text for context
    const images = Array.from(document.querySelectorAll('img[alt]'))
        .filter(img => img.alt && img.alt.trim().length > 0)
        .map(img => ({
            alt: img.alt.trim(),
            src: img.src
        }));

    return {
        metadata,
        content: getMainContent(),
        headings,
        links: links.slice(0, 20), // Limit to top 20 links
        images: images.slice(0, 10), // Limit to top 10 images
    };
}

// Listen for messages from the popup or background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractContent') {
        try {
            const pageData = extractPageContent();
            sendResponse({ success: true, data: pageData });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true; // Keep the message channel open for the asynchronous response
    }
});
