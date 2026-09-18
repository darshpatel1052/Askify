# Query Endpoints with Real-time SSE Streaming (Askify Next-Gen)
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Optional, List, Any
from datetime import datetime, timezone

from app.api.endpoints.auth import oauth2_scheme
from app.models.user import User
from app.services.user_service import get_user_by_email
from app.core.config import SECRET_KEY, ALGORITHM
from jose import jwt, JWTError

from app.services.query_service import answer_query, stream_query_tokens
from app.db.storage_factory import save_query_history, get_query_history, delete_user_history, delete_specific_query

router = APIRouter()

# Optional authentication helper
async def get_optional_current_user(request: Request) -> Optional[User]:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email:
            return get_user_by_email(email)
    except JWTError:
        return None
    return None

class QueryRequest(BaseModel):
    query: str
    url: str
    page_content: Optional[str] = None
    selected_text: Optional[str] = None
    timestamp: Optional[datetime] = None

class StreamQueryRequest(BaseModel):
    query: str
    url: str
    page_content: Optional[str] = None
    selected_text: Optional[str] = None
    model: Optional[str] = None

class QueryResponse(BaseModel):
    success: bool
    answer: str
    sources: Optional[Dict] = None
    confidence: Optional[float] = None

class QueryHistoryResponse(BaseModel):
    history: list

class DeleteHistoryRequest(BaseModel):
    history_type: Optional[str] = "query"

@router.post("/ask", response_model=QueryResponse)
async def ask_query(
    request_body: QueryRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else "guest_user"

    try:
        result = answer_query(
            user_id=user_id,
            query=request_body.query,
            url=request_body.url,
            page_content=request_body.page_content,
            selected_text=request_body.selected_text
        )

        # Save history if possible
        try:
            save_query_history(
                user_id=user_id,
                query=request_body.query,
                answer=result.get("answer"),
                url=request_body.url,
                timestamp=request_body.timestamp or datetime.now(timezone.utc)
            )
        except Exception as e:
            print(f"[WARN] History save notice: {e}")

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

@router.post("/stream")
async def stream_query(
    request_body: StreamQueryRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    """
    Real-time Server-Sent Events (SSE) streaming endpoint:
    Returns text/event-stream chunks as the AI generates words.
    """
    user_id = current_user.id if current_user else "guest_user"

    generator = stream_query_tokens(
        user_id=user_id,
        query=request_body.query,
        url=request_body.url,
        page_content=request_body.page_content,
        selected_text=request_body.selected_text,
        model=request_body.model
    )

    return StreamingResponse(
        generator,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.get("/history", response_model=QueryHistoryResponse)
async def read_query_history(
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else "guest_user"
    try:
        history_data = get_query_history(user_id)
        return {"history": history_data}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving query history: {str(e)}"
        )

@router.delete("/history", status_code=status.HTTP_200_OK)
async def clear_user_history(
    request_body: DeleteHistoryRequest,
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    user_id = current_user.id if current_user else "guest_user"
    try:
        success = delete_user_history(user_id, request_body.history_type)
        return {
            "success": True,
            "message": f"{request_body.history_type.title()} history cleared successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error clearing history: {str(e)}"
        )
