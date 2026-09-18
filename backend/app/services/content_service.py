# Content processing service (Askify Next-Gen)
import re
import requests
from bs4 import BeautifulSoup
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from app.core.config import OPENAI_API_KEY
from app.db.vector_store import add_to_vector_store, url_exists_in_vector_store

def extract_webpage_content(url: str) -> str:
    """
    Fallback extractor using requests + BeautifulSoup with realistic browser headers.
    (Note: Primary extraction happens directly in the Chrome extension content script).
    """
    try:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Sec-Ch-Ua": '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Upgrade-Insecure-Requests": "1"
        }
        response = requests.get(url, headers=headers, timeout=12)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')

        # Clean noise
        for tag in soup(['script', 'style', 'noscript', 'iframe', 'svg', 'header', 'footer', 'nav', 'aside']):
            tag.decompose()

        title = soup.title.string.strip() if soup.title and soup.title.string else ""

        # Priority main content container
        main_content = soup.select_one('article, [role="main"], main, .post-content, #content, .content')
        if not main_content:
            main_content = soup.body

        if not main_content:
            return ""

        text = main_content.get_text(separator='\n')
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        cleaned = '\n'.join(lines)

        if title:
            return f"Title: {title}\n\n{cleaned}"
        return cleaned

    except Exception as e:
        return f"SITE_BLOCKED: Could not fetch content from {url} due to bot protection or network block ({str(e)}). Using client-side DOM extraction."

def ingest_direct_content(user_id: str, url: str, content: str, title: Optional[str] = None, metadata: Optional[Dict] = None) -> bool:
    """
    Directly ingest pre-extracted DOM content from the Chrome Extension into Vector DB.
    Bypasses all server-side bot-blocking, CAPTCHAs, and paywalls!
    """
    if not content or len(content.strip()) < 10:
        return False

    formatted_content = f"Title: {title}\n\n{content}" if title and not content.startswith("Title:") else content
    
    try:
        add_to_vector_store(
            user_id=user_id,
            content=formatted_content,
            url=url,
            summary=None,
            timestamp=datetime.now(timezone.utc)
        )
        return True
    except Exception as e:
        print(f"[WARN] Failed to index content into vector store: {e}")
        return False

def process_and_store_content(user_id: str, url: str, embeddings=None) -> bool:
    """
    Process and store content from URL if not already in vector store.
    """
    if url_exists_in_vector_store(user_id=user_id, url=url, embeddings=embeddings):
        return False

    content = extract_webpage_content(url)
    if content.startswith("SITE_BLOCKED:"):
        return False

    if content:
        try:
            add_to_vector_store(
                user_id=user_id,
                content=content,
                url=url,
                summary=None,
                embeddings=embeddings,
                timestamp=datetime.now(timezone.utc)
            )
            return True
        except Exception:
            return False
    return False
