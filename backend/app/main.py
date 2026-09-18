# Main FastAPI Application (Askify Next-Gen v2.0)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import (
    CORS_ORIGINS,
    CORS_ORIGIN_REGEX,
    API_V1_PREFIX,
    PROJECT_NAME,
    DEBUG,
    STORAGE_MODE
)
from app.api.routes import api_router

app = FastAPI(
    title=PROJECT_NAME,
    description="Next-Generation AI Web Copilot & Hybrid RAG Microservice",
    version="2.0.0",
    openapi_url=f"{API_V1_PREFIX}/openapi.json",
    debug=DEBUG,
)

# Robust CORS middleware allowing Chrome extensions & local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=CORS_ORIGIN_REGEX,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=API_V1_PREFIX)

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {PROJECT_NAME}",
        "version": "2.0.0",
        "docs": "/docs",
        "storage_mode": STORAGE_MODE
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for status monitoring"""
    return {
        "status": "healthy",
        "service": PROJECT_NAME,
        "version": "2.0.0",
        "storage_mode": STORAGE_MODE
    }
