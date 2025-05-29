# Content processing service using LangChain
from langchain_openai import ChatOpenAI
import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime

from app.core.config import OPENAI_API_KEY
from app.db.vector_store import add_to_vector_store, url_exists_in_vector_store

# Initialize LLM
llm = ChatOpenAI(
    openai_api_key=OPENAI_API_KEY,
    model_name="gpt-4o-mini",
    temperature=0.2
)

def extract_webpage_content(url: str) -> str:
    """
    Extract content from a webpage URL using BeautifulSoup.
    
    Args:
        url: The URL of the webpage
    
    Returns:
        Extracted text content from the webpage
    """
    try:
        # Send GET request to the URL with a standard browser user agent
        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"}
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()  # This will raise an exception for HTTP errors
        
        # Parse HTML with BeautifulSoup
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script and style elements
        for script_or_style in soup(['script', 'style', 'header', 'footer', 'nav']):
            script_or_style.decompose()
        
        # Extract title
        title = soup.title.string if soup.title else ""
        
        # Find the main content (prioritize content containers)
        main_content = soup.select_one('main, article, .content, #content')
        if not main_content:
            main_content = soup.body
        
        # Extract text content
        text = main_content.get_text(separator='\n')
        
        # Clean up the text
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = '\n'.join(chunk for chunk in chunks if chunk)
        
        # Prepend title
        if title:
            text = f"Title: {title}\n\n{text}"
        
        return text
    except Exception as e:

        # Return a special error message that can be recognized by the frontend
        return f"SITE_BLOCKED: Could not access content from {url}. The site may be blocking automated access."

def process_and_store_content(user_id: str, url: str, embeddings) -> bool:
    """
    Process and store content from a URL only if it doesn't already exist in the vector store.
    No summarization is performed - just extract and store the raw content.

    Args:
        user_id: The ID of the user.
        url: The URL of the webpage to process.
        embeddings: The embeddings model to use for the vector store.

    Returns:
        True if new content was processed and stored, False if it already existed.
    """
    # Check if content for this URL already exists in the vector store
    if url_exists_in_vector_store(user_id=user_id, url=url, embeddings=embeddings):
        return False

    # Extract content from the URL
    content = extract_webpage_content(url)
    
    # Check if the site is blocked
    if content.startswith("SITE_BLOCKED:"):
        return False
    
    if content and not content.startswith("Failed to extract content"):
        # Store content in vector store
        add_to_vector_store(
            user_id=user_id,
            content=content,
            url=url,
            summary=None,
            embeddings=embeddings,
            timestamp=datetime.utcnow()
        )
        return True
    else:
        return False

