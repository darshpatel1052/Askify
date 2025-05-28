# API Routes
from fastapi import APIRouter

from app.api.endpoints import auth, content, query, history

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["authentication"])
api_router.include_router(content.router, prefix="/content", tags=["content"])
api_router.include_router(query.router, prefix="/query", tags=["query"])
api_router.include_router(history.router, prefix="/history", tags=["history"])
