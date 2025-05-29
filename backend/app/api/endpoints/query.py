# Query Endpoints
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.services.query_service import answer_query
from app.db.history_store import save_query_history, get_query_history

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

class QueryHistoryResponse(BaseModel):
    history: list

@router.post("/ask", response_model=QueryResponse)
async def ask_query(
    request: QueryRequest,
    current_user: User = Depends(get_current_user)
):
    print(f"--- Entering /ask endpoint ---")
    print(f"Request received: query='{request.query}', url='{request.url}', timestamp='{request.timestamp}'")
    if current_user:
        print(f"Authenticated user ID: {current_user.id}")
    else:
        print(f"User not authenticated or current_user is None.")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        print(f"[{current_user.id}] Calling answer_query with query='{request.query}', url='{request.url}'")
        result = answer_query(
            user_id=current_user.id,
            query=request.query,
            url=request.url
        )
        print(f"[{current_user.id}] answer_query result: {result}")
        
        if not result or not result.get("answer"):
            print(f"[{current_user.id}] answer_query did not return a valid answer. Result: {result}")
            # Optionally, raise an HTTPException or return a specific error response
            # For now, we'll proceed but this might be a point of failure to investigate
        
        print(f"[{current_user.id}] Calling save_query_history with query='{request.query}', answer='{result.get('answer')}', url='{request.url}'")
        save_query_history(
            user_id=current_user.id,
            query=request.query,
            answer=result.get("answer"), # Ensure this is correctly passed
            url=request.url,
            timestamp=request.timestamp
        )
        print(f"[{current_user.id}] Query history saved successfully.")
        
        print(f"--- Exiting /ask endpoint successfully ---")
        return {
            "success": True,
            "answer": result.get("answer"),
            "sources": result.get("sources"),
            "confidence": result.get("confidence")
        }
    except Exception as e:
        print(f"!!! Exception in /ask endpoint for user {current_user.id if current_user else 'Unknown'} !!!")
        import traceback
        print(f"Error type: {type(e)}")
        print(f"Error message: {str(e)}")
        print(f"Traceback: {traceback.format_exc()}")
        print(f"--- Exiting /ask endpoint with error ---")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {str(e)}"
        )

@router.get("/history", response_model=QueryHistoryResponse)
async def read_query_history(
    current_user: User = Depends(get_current_user)
):
    try:
        # Get query history for user
        history_data = get_query_history(current_user.id)
        
        return {
            "history": history_data
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving query history: {str(e)}"
        )
