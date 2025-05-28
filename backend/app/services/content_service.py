# Content processing service using LangChain
from langchain_openai import ChatOpenAI
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain.chains.summarize import load_summarize_chain
from langchain.chains import create_extraction_chain
from langchain.prompts import PromptTemplate
from typing import Dict, List
import requests
from bs4 import BeautifulSoup
import re

from app.core.config import OPENAI_API_KEY

# Initialize LLM
llm = ChatOpenAI(
    openai_api_key=OPENAI_API_KEY,
    model_name="gpt-3.5-turbo-16k",
    temperature=0
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
        # Send GET request to the URL
        response = requests.get(url, headers={"User-Agent": "Paperwise/1.0"})
        response.raise_for_status()
        
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
        print(f"Error extracting content from {url}: {str(e)}")
        return f"Failed to extract content from {url}. Error: {str(e)}"

def process_webpage_content(url: str) -> Dict:
    """
    Process the content of a webpage using LangChain.
    
    Args:
        url: The URL of the webpage
    
    Returns:
        Dict with processed data including summary, key topics, and metadata
    """
    # Extract content from URL
    content = extract_webpage_content(url)
    
    # Split the content into chunks for processing
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=4000,
        chunk_overlap=200,
        separators=["\n\n", "\n", " ", ""]
    )
    
    # Create documents from content
    docs = [Document(page_content=content, metadata={"source": url})]
    split_docs = text_splitter.split_documents(docs)
    
    # Generate a summary
    summary_template = """
    Please summarize the following text from the webpage:
    
    {text}
    
    CONCISE SUMMARY:
    """
    SUMMARY_PROMPT = PromptTemplate.from_template(summary_template)
    summary_chain = load_summarize_chain(
        llm=llm,
        chain_type="stuff",
        prompt=SUMMARY_PROMPT,
        verbose=False
    )
    
    summary = summary_chain.run(split_docs[:5])  # Use first 5 chunks for summary
    
    # Extract key topics
    schema = {
        "properties": {
            "topics": {
                "type": "array",
                "items": {
                    "type": "string",
                    "description": "A key topic or concept from the text"
                },
                "description": "The main topics or key concepts discussed in the text"
            }
        },
        "required": ["topics"]
    }
    
    # Extract topics from first 3 chunks only to keep it focused
    topic_extraction_chain = create_extraction_chain(schema=schema, llm=llm)
    topics_result = topic_extraction_chain.run(split_docs[0].page_content)
    
    # Build metadata
    metadata = {
        "url": url,
        "content_length": len(content),
        "chunk_count": len(split_docs),
        "extracted_content": content  # Include the extracted content
    }
    
    return {
        "summary": summary,
        "key_topics": topics_result.get("topics", []),
        "metadata": metadata,
        "embeddings": None  # This would be handled by the vector store
    }
