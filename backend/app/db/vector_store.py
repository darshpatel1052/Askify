# Vector database storage using ChromaDB
import os
import uuid
import chromadb
from chromadb.config import Settings
from typing import Optional, List, Dict
from datetime import datetime
from urllib.parse import urlparse

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
    from langchain_chroma import Chroma
    
    # Create a unique collection name for this user
    collection_name = f"user_{user_id}"
    

    # Use get_or_create_collection for robustness
    try:
        collection = chroma_client.get_or_create_collection(
            name=collection_name,
        )
    except Exception as e:
        print(f"Error in get_or_create_collection for {collection_name}: {e}")
        # Re-raise the exception if you want to handle it further up
        # or handle it here (e.g., by raising an HTTPException)
        raise

    # Return as LangChain vectorstore
    return Chroma(
        client=chroma_client,
        collection_name=collection_name, 
        embedding_function=embeddings
    )

# Check if our collection has any documents
def collection_has_documents(user_id: str, embeddings) -> bool:
    """
    Check if the user's vector store collection has any documents at all.
    
    Args:
        user_id: The user's unique identifier
        embeddings: The embeddings model to use
        
    Returns:
        True if the collection has documents, False otherwise
    """
    vector_store = get_vector_store_for_user(user_id, embeddings)
    # A simple similarity search with an empty query to see if anything comes back
    try:
        results = vector_store.similarity_search_with_score(
            query=" ", 
            k=1
        )
        return len(results) > 0
    except Exception as e:
        print(f"[{user_id}] Error checking if collection has documents: {e}")
        return False

def url_exists_in_vector_store(user_id: str, url: str, embeddings) -> bool:
    """
    Check if content for a given URL already exists in the user's vector store.

    Args:
        user_id: The user's unique identifier.
        url: The URL to check.
        embeddings: The embeddings model to use.

    Returns:
        True if the URL exists, False otherwise.
    """

    try:
        vector_store = get_vector_store_for_user(user_id, embeddings)
        # Perform a search with a filter for the exact source URL
        results = vector_store.similarity_search_with_score(
            query=" ",  # Dummy query, filter is what matters
            k=1,
            filter={"source": url} 
        )
        exists = len(results) > 0

        return exists
    except Exception as e:
        return False

def add_to_vector_store(
    user_id: str,
    content: str,
    url: str,
    summary: Optional[str] = None,
    embeddings=None,
    timestamp: Optional[datetime] = None
) -> str:
    """
    Add content to the vector store using semantic chunking
    
    Args:
        user_id: The user's unique identifier
        content: The content to add
        url: The URL of the content
        summary: Optional summary of the content
        embeddings: The embeddings model to use
        timestamp: When the content was processed
    
    Returns:
        The ID of the added content
    """
    from langchain_openai import OpenAIEmbeddings
    from langchain_experimental.text_splitter import SemanticChunker
    from app.core.config import OPENAI_API_KEY
    
    # If no embeddings model provided, use OpenAI
    if embeddings is None:
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
    
    # Get vector store for user
    vector_store = get_vector_store_for_user(user_id, embeddings)
    
    # Use SemanticChunker for more intelligent, meaning-based chunking
    print(f"[{user_id}] Using SemanticChunker for URL '{url}'")
    text_splitter = SemanticChunker(
    OpenAIEmbeddings(), breakpoint_threshold_type="percentile", breakpoint_threshold_amount=80
    )
    
    # Extract URL details for metadata
    parsed_url = urlparse(url)
    url_path = parsed_url.path
    
    # Create detailed metadata for precise filtering
    metadata = {
        "source": url,
        "domain": parsed_url.netloc,
        "url_path": url_path,
        "full_url": url,  # Store the complete URL for exact matching
        "timestamp": timestamp.isoformat() if timestamp else datetime.utcnow().isoformat(),
    }
    
    if summary:
        metadata["summary"] = summary
    
    # Create a document with the content and metadata

    # SemanticChunker expects a list of texts, not Documents
    # So we'll create chunks first, then convert to Documents with metadata
    chunks = text_splitter.create_documents([content])
    
    
    # Generate a unique content ID
    content_id = str(uuid.uuid4())
    
    # Ensure each chunk has complete metadata
    for i, chunk in enumerate(chunks):
        # Add chunk ID and content ID to metadata
        chunk.metadata["chunk_id"] = f"{content_id}_{i}"
        chunk.metadata["content_id"] = content_id
        
        # Add all our custom metadata
        for key, value in metadata.items():
            chunk.metadata[key] = value
    
    # Add chunks to vector store

    vector_store.add_documents(chunks)

    
    return content_id

def get_user_document_chunks(user_id: str, embeddings, url: Optional[str] = None, limit: int = 50) -> List[Dict]:
    """
    Get document chunks stored for a user, optionally filtered by URL
    
    Args:
        user_id: The user's unique identifier
        embeddings: The embeddings model to use
        url: Optional URL to filter by
        limit: Maximum number of chunks to return
        
    Returns:
        List of document chunks with their metadata
    """
    try:
        print(f"[{user_id}] Retrieving document chunks" + (f" for URL: {url}" if url else ""))
        
        # Get vector store for user
        vector_store = get_vector_store_for_user(user_id, embeddings)
        
        # Get the raw client and collection
        collection = vector_store._collection
        
        # Prepare the filter
        filter_dict = {}
        if url:
            # Try full_url first
            try:
                # Try exact URL match
                filter_dict = {"full_url": url}
                results = collection.get(
                    where=filter_dict,
                    limit=limit
                )
                
                # If no results, try source filter
                if not results["metadatas"]:
                    filter_dict = {"source": url}
                    results = collection.get(
                        where=filter_dict,
                        limit=limit
                    )
                    
                    # If still no results, try domain
                    if not results["metadatas"]:
                        parsed_url = urlparse(url)
                        domain = parsed_url.netloc
                        filter_dict = {"domain": domain}
                        results = collection.get(
                            where=filter_dict,
                            limit=limit
                        )
            except Exception as e:
                print(f"[{user_id}] Error with URL filter: {e}. Getting all documents.")
                results = collection.get(limit=limit)
        else:
            # Get all documents
            results = collection.get(limit=limit)
        
        # Format the results
        chunks = []
        for i in range(len(results["ids"])):
            chunk = {
                "id": results["ids"][i],
                "content": results["documents"][i],
                "metadata": results["metadatas"][i] if i < len(results["metadatas"]) else {}
            }
            chunks.append(chunk)
        
        print(f"[{user_id}] Retrieved {len(chunks)} document chunks")
        return chunks
    except Exception as e:
        print(f"[{user_id}] Error retrieving document chunks: {e}")
        return []
