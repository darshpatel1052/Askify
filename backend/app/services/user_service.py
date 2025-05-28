# User service functions
from datetime import datetime
from supabase import create_client
import uuid

from app.core.config import SUPABASE_URL, SUPABASE_KEY
from app.models.user import User
from app.auth.password import verify_password

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user:
        return False
    
    # Get user's hashed password from Supabase
    response = supabase.table("user_credentials").select("password_hash").eq("user_id", user.id).execute()
    if len(response.data) == 0:
        return False
    
    stored_password_hash = response.data[0]["password_hash"]
    if not verify_password(password, stored_password_hash):
        return False
    
    return user

def get_user_by_email(email: str) -> User:
    response = supabase.table("users").select("*").eq("email", email).execute()
    
    if len(response.data) == 0:
        return None
    
    user_data = response.data[0]
    return User(
        id=user_data["id"],
        email=user_data["email"],
        full_name=user_data.get("full_name"),
        is_active=user_data.get("is_active", True),
        created_at=datetime.fromisoformat(user_data["created_at"].replace("Z", "+00:00"))
    )

def create_user(email: str, hashed_password: str, full_name: str = None) -> User:
    # Create user in the users table
    user_id = str(uuid.uuid4())
    
    user_data = {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "is_active": True,
        "created_at": datetime.utcnow().isoformat()
    }
    
    response = supabase.table("users").insert(user_data).execute()
    
    # Store credentials separately
    credentials_data = {
        "user_id": user_id,
        "password_hash": hashed_password
    }
    
    supabase.table("user_credentials").insert(credentials_data).execute()
    
    return User(**user_data)
