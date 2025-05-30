# Main application configuration
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API settings
API_V1_PREFIX = "/api/v1"
PROJECT_NAME = "Askify"
DEBUG = os.getenv("DEBUG", "False") == "True"

# Authentication
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-for-jwt")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# OpenAI
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Database
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./chromadb")

# CORS
CORS_ORIGINS = [
    "chrome-extension://",  # Your Chrome extension ID will be added here
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8000",
]
