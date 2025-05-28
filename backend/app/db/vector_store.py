# Vector database storage using ChromaDB
import os
import uuid
import chromadb
from chromadb.config import Settings
from typing import Dict, List, Optional, Union
from datetime import datetime

from app.core.config import VECTOR_DB_PATH

# Ensure the vector DB directory exists
os.makedirs(VECTOR_DB_PATH, exist_ok=True)

# Initialize ChromaDB client
chroma_client = chromadb.PersistentClient(path=VECTOR_DB_PATH, settings=Settings(anonymized_telemetry=False))

def get_vector_store_for_user(user_id: str, embeddings):
    """
    Get or create a Chroma collection for the user
    
    Args:
        user_id: The user's unique identifier
        embeddings: The embeddings model to use
    
    Returns:
        A LangChain Chroma vector store instance
    """
    from langchain_community.vectorstores import Chroma
    
    # Create a unique collection for this user
    collection_name = f"user_{user_id}"
    
    try:
        # Try to get existing collection
        collection = chroma_client.get_collection(collection_name)
    except ValueError:
        # Collection doesn't exist, create it
        collection = chroma_client.create_collection(collection_name)
    
    # Return as LangChain vectorstore
    return Chroma(
        client=chroma_client,
        collection_name=collection_name,
        embedding_function=embeddings
    )

def add_to_vector_store(
    user_id: str,
    content: str,
    url: str,
    summary: Optional[str] = None,
    embeddings=None,
    timestamp: Optional[datetime] = None
) -> str:
    """
    Add content to the vector store
    
    Args:
        user_id: The user's unique identifier
        content: The content to add
        url: The URL of the content
        summary: Optional summary of the content
        embeddings: Optional pre-computed embeddings
        timestamp: When the content was processed
    
    Returns:
        The ID of the added content
    """
    from langchain_community.vectorstores import Chroma
    from langchain_openai import OpenAIEmbeddings
    from langchain.text_splitter import RecursiveCharacterTextSplitter
    from langchain.schema import Document
    from app.core.config import OPENAI_API_KEY
    
    # If no embeddings model provided, use OpenAI
    if embeddings is None:
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    
    # Get vector store for user
    vector_store = get_vector_store_for_user(user_id, embeddings)
    
    # Split content into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100
    )
    
    # Add metadata
    metadata = {
        "source": url,
        "timestamp": timestamp.isoformat() if timestamp else datetime.utcnow().isoformat(),
    }
    
    if summary:
        metadata["summary"] = summary
    
    # Create document
    doc = Document(page_content=content, metadata=metadata)
    chunks = text_splitter.split_documents([doc])
    
    # Add to vector store
    content_id = str(uuid.uuid4())
    for i, chunk in enumerate(chunks):
        # Add chunk ID to metadata
        chunk.metadata["chunk_id"] = f"{content_id}_{i}"
        chunk.metadata["content_id"] = content_id
    
    vector_store.add_documents(chunks)
    
    return content_id
