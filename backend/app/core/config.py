# Main application configuration (Askify Next-Gen)
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# API settings
API_V1_PREFIX = "/api/v1"
PROJECT_NAME = "Askify API"
DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

# Authentication
SECRET_KEY = os.getenv("SECRET_KEY", "askify-super-secret-jwt-key-change-in-production-12345")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# LLM Providers
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
DEFAULT_MODEL = os.getenv("DEFAULT_MODEL", "gpt-4o-mini")

# Database & Storage
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
STORAGE_MODE = os.getenv("STORAGE_MODE", "local" if not (SUPABASE_URL and SUPABASE_KEY) else "supabase").lower()

LOCAL_DB_DIR = os.getenv("LOCAL_DB_DIR", "./local_db")
VECTOR_DB_PATH = os.getenv("VECTOR_DB_PATH", "./chromadb")

# CORS Settings
CORS_ORIGIN_REGEX = r"^(chrome-extension://.*|http://localhost(:\d+)?|http://127\.0\.0\.1(:\d+)?)$"
CORS_ORIGINS = [
    "*",
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://localhost:5173",
]
