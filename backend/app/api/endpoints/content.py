# Content Processing Endpoints
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.services.content_service import process_webpage_content
from app.db.vector_store import add_to_vector_store

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
        # Process the content using LangChain and BeautifulSoup
        result = process_webpage_content(request.url)
        
        # Get the extracted content
        extracted_content = result.get("metadata", {}).get("extracted_content", "")
        
        # Store processed content in vector database
        content_id = add_to_vector_store(
            user_id=current_user.id,
            content=extracted_content,
            url=request.url,
            summary=result.get("summary"),
            embeddings=result.get("embeddings"),
            timestamp=request.timestamp
        )
        
        return {
            "success": True,
            "message": "Content processed successfully",
            "content_id": content_id,
            "summary": result.get("summary"),
            "key_topics": result.get("key_topics"),
            "metadata": result.get("metadata")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing content: {str(e)}"
        )
