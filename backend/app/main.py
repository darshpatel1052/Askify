# Main FastAPI application
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import CORS_ORIGINS, API_V1_PREFIX, PROJECT_NAME, DEBUG
from app.api.routes import api_router

app = FastAPI(
    title=PROJECT_NAME,
    openapi_url=f"{API_V1_PREFIX}/openapi.json",
    debug=DEBUG,
)

# Set up CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix=API_V1_PREFIX)

@app.get("/")
async def root():
    return {"message": f"Welcome to {PROJECT_NAME} API"}

@app.get("/health")
async def health_check():
    """Health check endpoint for Docker and load balancers"""
    return {
        "status": "healthy",
        "service": PROJECT_NAME,
        "version": "1.0.0"
    }
