# Query Endpoints
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import Dict, Optional
from datetime import datetime

from app.api.endpoints.auth import get_current_user
from app.models.user import User
from app.services.query_service import answer_query
from app.db.history_store import save_query_history, get_query_history, delete_user_history, delete_specific_query

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

class DeleteHistoryRequest(BaseModel):
    history_type: Optional[str] = "query"  # "query", "browsing", or "all"

class DeleteQueryRequest(BaseModel):
    query_id: str

@router.post("/ask", response_model=QueryResponse)
async def ask_query(
    request_body: QueryRequest,
    request: Request,
    current_user: User = Depends(get_current_user)
):
    
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
        result = answer_query(
            user_id=current_user.id,
            query=request_body.query,
            url=request_body.url
        )
        
        print(f"[{current_user.id}] Calling save_query_history with query='{request_body.query}', answer='{result.get('answer')}', url='{request_body.url}'")
        save_query_history(
            user_id=current_user.id,
            query=request_body.query,
            answer=result.get("answer"), # Ensure this is correctly passed
            url=request_body.url,
            timestamp=request_body.timestamp
        )

        return {
            "success": True,
            "answer": result.get("answer"),
            "sources": result.get("sources"),
            "confidence": result.get("confidence")
        }
    except Exception as e:
        print(f"!!! Exception in /ask endpoint for user {current_user.id if current_user else 'Unknown'} !!!")
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

@router.delete("/history", status_code=status.HTTP_200_OK)
async def clear_user_history(
    request_body: DeleteHistoryRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Clear user's query history
    """
    try:
        success = delete_user_history(current_user.id, request_body.history_type)
        
        if success:
            return {
                "success": True,
                "message": f"{request_body.history_type.title()} history cleared successfully"
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to clear history"
            )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing history: {str(e)}"
        )

@router.delete("/history/query/{query_id}", status_code=status.HTTP_200_OK)
async def delete_specific_query_endpoint(
    query_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a specific query from user's history
    """
    print(f"DELETE request for query_id: {query_id}, user_id: {current_user.id}")
    
    try:
        success = delete_specific_query(current_user.id, query_id)
        
        if success:
            print(f"Successfully deleted query {query_id} for user {current_user.id}")
            return {
                "success": True,
                "message": "Query deleted successfully"
            }
        else:
            print(f"Failed to delete query {query_id} for user {current_user.id}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Query not found or already deleted"
            )
    except Exception as e:
        print(f"Exception while deleting query {query_id}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting query: {str(e)}"
        )
