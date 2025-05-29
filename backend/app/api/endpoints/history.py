# History Endpoints
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.db.history_store import save_browsing_history, get_user_history

router = APIRouter()

class HistoryRequest(BaseModel):
    url: str
    title: str
    timestamp: datetime
    metadata: Optional[Dict] = None

class HistoryItem(BaseModel):
    id: str
    url: str
    title: Optional[str] = None
    timestamp: datetime
    metadata: Optional[Dict] = None

class QueryHistoryItem(BaseModel):
    id: str
    query: str
    answer: str
    url: str
    timestamp: datetime

class HistoryResponse(BaseModel):
    browsing_history: List[HistoryItem]
    query_history: List[QueryHistoryItem]

@router.post("/record", status_code=status.HTTP_201_CREATED)
async def record_history(
    request_body: HistoryRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):

    
    if current_user:
        print(f"Authenticated user ID: {current_user.id}")
    else:
        print(f"User not authenticated or current_user is None.")

    return {"success": True, "message": "History recorded successfully"}

@router.get("", response_model=HistoryResponse)
async def get_history(
    limit: int = 100,
    offset: int = 0,
    current_user: User = Depends(get_current_user)
):
    try:
        history = get_user_history(
            user_id=current_user.id, 
            limit=limit,
            offset=offset
        )
        
        return history
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving history: {str(e)}"
        )
