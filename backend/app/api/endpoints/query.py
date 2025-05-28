# Query Endpoints
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.services.query_service import answer_query
from app.db.history_store import save_query_history

router = APIRouter()

class QueryRequest(BaseModel):
    query: str
    url: str
    timestamp: datetime

class QueryResponse(BaseModel):
    success: bool
    answer: str
    sources: Optional[Dict] = None
    confidence: Optional[float] = None

@router.post("/ask", response_model=QueryResponse)
async def ask_query(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    try:
        # Process the query using LangChain RAG
        result = answer_query(
            user_id=current_user.id,
            query=request.query,
            url=request.url
        )
        
        # Save query to history
        save_query_history(
            user_id=current_user.id,
            query=request.query,
            answer=result.get("answer"),
            url=request.url,
            timestamp=request.timestamp
        )
        
        return {
            "success": True,
            "answer": result.get("answer"),
            "sources": result.get("sources"),
            "confidence": result.get("confidence")
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}"
        )
