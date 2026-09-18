# Content Processing & Direct DOM Ingestion Endpoints (Askify Next-Gen)
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime

from app.api.endpoints.query import get_optional_current_user
from app.models.user import User
from app.services.content_service import process_and_store_content, ingest_direct_content
from app.db.vector_store import search_relevant_chunks

router = APIRouter()

class ContentRequest(BaseModel):
    url: str
    timestamp: Optional[datetime] = None

class IngestContentRequest(BaseModel):
    url: str
    content: str
    title: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

class ContentResponse(BaseModel):
    success: bool
    message: str
    url: str

@router.post("/process", response_model=ContentResponse)
async def process_content(
    request: ContentRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else "guest_user"
    try:
        success = process_and_store_content(user_id=user_id, url=request.url)
        return {
            "success": success,
            "message": "Content indexed successfully" if success else "Content already exists or blocked",
            "url": request.url
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing content: {str(e)}"
        )

@router.post("/ingest", response_model=ContentResponse)
async def ingest_content(
    request: IngestContentRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Direct in-browser DOM content ingestion endpoint.
    Receives parsed readable DOM from Chrome extension to bypass bot shields.
    """
    user_id = current_user.id if current_user else "guest_user"
    try:
        success = ingest_direct_content(
            user_id=user_id,
            url=request.url,
            content=request.content,
            title=request.title,
            metadata=request.metadata
        )
        return {
            "success": success,
            "message": "DOM content ingested and indexed" if success else "Failed to ingest content",
            "url": request.url
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error ingesting content: {str(e)}"
        )

@router.get("/chunks")
async def get_document_chunks(
    url: Optional[str] = None,
    limit: int = 20,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else "guest_user"
    try:
        chunks = search_relevant_chunks(user_id=user_id, query="", url=url, k=limit)
        return {
            "success": True,
            "count": len(chunks),
            "chunks": chunks
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving document chunks: {str(e)}"
        )
