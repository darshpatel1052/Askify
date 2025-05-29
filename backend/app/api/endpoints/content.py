# Content Processing Endpoints
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.services.content_service import process_and_store_content
from app.db.vector_store import get_user_document_chunks
from langchain_openai import OpenAIEmbeddings
from app.core.config import OPENAI_API_KEY

router = APIRouter()

class ContentRequest(BaseModel):
    url: str
    timestamp: datetime

class ContentResponse(BaseModel):
    success: bool
    message: str
    content_id: Optional[str] = None
    summary: Optional[str] = None
    key_topics: Optional[List[str]] = None
    metadata: Optional[Dict] = None

@router.post("/process", response_model=ContentResponse)
async def process_content(
    request: ContentRequest, 
    current_user: User = Depends(get_current_user)
):
    try:
        # Initialize OpenAI embeddings
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        
        # Process and store content directly using the updated function
        processing_result = process_and_store_content(
            user_id=current_user.id,
            url=request.url,
            embeddings=embeddings
        )
        
        if processing_result:
            # If content was successfully processed and stored
            return {
                "success": True,
                "message": "Content processed and stored successfully",
                "content_id": None,  # The actual content_id is not returned by process_and_store_content
                "summary": None,  # No summary is generated with the new approach
                "key_topics": None,  # No key topics are extracted with the new approach
                "metadata": {"url": request.url, "timestamp": request.timestamp.isoformat()}
            }
        else:
            # If content already exists or couldn't be processed
            return {
                "success": False,
                "message": "Content already exists or couldn't be processed",
                "content_id": None,
                "summary": None,
                "key_topics": None,
                "metadata": {"url": request.url, "timestamp": request.timestamp.isoformat()}
            }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing content: {str(e)}"
        )

class DocumentChunkResponse(BaseModel):
    success: bool
    chunks: List[Dict]
    count: int
    message: Optional[str] = None

@router.get("/chunks", response_model=DocumentChunkResponse)
async def get_document_chunks(
    url: Optional[str] = None,
    limit: int = 50,
    current_user: User = Depends(get_current_user)
):
    """
    Get document chunks stored for the current user, optionally filtered by URL
    
    Args:
        url: Optional URL to filter by
        limit: Maximum number of chunks to return
    
    Returns:
        List of document chunks with their metadata
    """
    try:
        # Initialize OpenAI embeddings
        embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)
        
        # Get document chunks
        chunks = get_user_document_chunks(
            user_id=current_user.id,
            embeddings=embeddings,
            url=url,
            limit=limit
        )
        
        return {
            "success": True,
            "chunks": chunks,
            "count": len(chunks),
            "message": f"Retrieved {len(chunks)} document chunks"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving document chunks: {str(e)}"
        )
