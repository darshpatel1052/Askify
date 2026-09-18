# User service functions with Supabase & Local fallback
import os
import json
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.core.config import SUPABASE_URL, SUPABASE_KEY, STORAGE_MODE, LOCAL_DB_DIR
from app.models.user import User
from app.auth.password import verify_password

# Initialize Supabase client if available
supabase = None
if STORAGE_MODE == "supabase" and SUPABASE_URL and SUPABASE_KEY:
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as e:
        print(f"[WARN] Supabase init failed: {e}. Falling back to local storage.")
        supabase = None

USERS_FILE = os.path.join(LOCAL_DB_DIR, "users.json")
CREDENTIALS_FILE = os.path.join(LOCAL_DB_DIR, "credentials.json")

def _ensure_local_files():
    os.makedirs(LOCAL_DB_DIR, exist_ok=True)
    if not os.path.exists(USERS_FILE):
        with open(USERS_FILE, 'w') as f:
            json.dump([], f)
    if not os.path.exists(CREDENTIALS_FILE):
        with open(CREDENTIALS_FILE, 'w') as f:
            json.dump([], f)

def _load_json(file_path):
    _ensure_local_files()
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except Exception:
        return []

def _save_json(file_path, data):
    _ensure_local_files()
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2)

def authenticate_user(email: str, password: str):
    user = get_user_by_email(email)
    if not user:
        return False

    if supabase:
        try:
            response = supabase.table("user_credentials").select("password_hash").eq("user_id", user.id).execute()
            if len(response.data) == 0:
                return False
            stored_password_hash = response.data[0]["password_hash"]
            if not verify_password(password, stored_password_hash):
                return False
            return user
        except Exception:
            return False
    else:
        # Local storage check
        creds = _load_json(CREDENTIALS_FILE)
        cred = next((c for c in creds if c.get("user_id") == user.id), None)
        if not cred or not verify_password(password, cred.get("password_hash")):
            return False
        return user

def get_user_by_email(email: str) -> Optional[User]:
    if supabase:
        try:
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
        except Exception:
            pass

    # Local fallback
    users = _load_json(USERS_FILE)
    u = next((item for item in users if item.get("email") == email), None)
    if not u:
        return None
    return User(
        id=u["id"],
        email=u["email"],
        full_name=u.get("full_name"),
        is_active=u.get("is_active", True),
        created_at=datetime.fromisoformat(u["created_at"])
    )

def create_user(email: str, hashed_password: str, full_name: Optional[str] = None) -> User:
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    user_data = {
        "id": user_id,
        "email": email,
        "full_name": full_name,
        "is_active": True,
        "created_at": now
    }

    if supabase:
        try:
            supabase.table("users").insert(user_data).execute()
            supabase.table("user_credentials").insert({
                "user_id": user_id,
                "password_hash": hashed_password
            }).execute()
            return User(**user_data)
        except Exception as e:
            print(f"[WARN] Supabase create user failed: {e}. Writing locally.")

    # Local storage
    users = _load_json(USERS_FILE)
    users.append(user_data)
    _save_json(USERS_FILE, users)

    creds = _load_json(CREDENTIALS_FILE)
    creds.append({
        "user_id": user_id,
        "password_hash": hashed_password
    })
    _save_json(CREDENTIALS_FILE, creds)

    return User(**user_data)
