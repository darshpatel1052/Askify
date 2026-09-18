# Local file-based history store for testing without Supabase
import json
import uuid
import os
from typing import Dict, List, Optional
from datetime import datetime

# Local storage file paths
LOCAL_DB_DIR = os.getenv("LOCAL_DB_DIR", "./local_db")
QUERY_HISTORY_FILE = os.path.join(LOCAL_DB_DIR, "query_history.json")
BROWSING_HISTORY_FILE = os.path.join(LOCAL_DB_DIR, "browsing_history.json")

def ensure_local_db_dir():
    """Ensure the local database directory exists"""
    os.makedirs(LOCAL_DB_DIR, exist_ok=True)

def load_json_file(file_path: str) -> List[Dict]:
    """Load data from a JSON file"""
    ensure_local_db_dir()
    if not os.path.exists(file_path):
        return []
    try:
        with open(file_path, 'r') as f:
            return json.load(f)
    except (json.JSONDecodeError, FileNotFoundError):
        return []

def save_json_file(file_path: str, data: List[Dict]):
    """Save data to a JSON file"""
    ensure_local_db_dir()
    with open(file_path, 'w') as f:
        json.dump(data, f, indent=2, default=str)

def save_query_history(
    user_id: str,
    query: str,
    answer: str,
    url: str,
    timestamp: datetime,
    metadata: Optional[Dict] = None
) -> str:
    """Save a query history entry"""
    query_id = str(uuid.uuid4())
    
    query_data = {
        "id": query_id,
        "user_id": user_id,
        "query": query,
        "answer": answer,
        "url": url,
        "timestamp": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
        "metadata": metadata or {}
    }
    
    history = load_json_file(QUERY_HISTORY_FILE)
    history.append(query_data)
    save_json_file(QUERY_HISTORY_FILE, history)
    return query_id

def get_query_history(user_id: str, limit: int = 10, offset: int = 0) -> List[Dict]:
    """Get a user's query history"""
    history = load_json_file(QUERY_HISTORY_FILE)
    user_history = [item for item in history if item.get("user_id") == user_id]
    user_history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return user_history[offset:offset+limit]

def get_user_history(user_id: str, limit: int = 100, offset: int = 0) -> Dict:
    """Get both browsing and query history for a user"""
    browsing = load_json_file(BROWSING_HISTORY_FILE)
    query = load_json_file(QUERY_HISTORY_FILE)
    user_browsing = [b for b in browsing if b.get("user_id") == user_id]
    user_query = [q for q in query if q.get("user_id") == user_id]
    user_browsing.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    user_query.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return {
        "browsing_history": user_browsing[offset:offset+limit],
        "query_history": user_query[offset:offset+limit]
    }

def delete_user_history(user_id: str, history_type: str = "all") -> bool:
    """Delete a user's history"""
    try:
        if history_type in ["query", "all"]:
            history = load_json_file(QUERY_HISTORY_FILE)
            filtered_history = [item for item in history if item.get("user_id") != user_id]
            save_json_file(QUERY_HISTORY_FILE, filtered_history)
        
        if history_type in ["browsing", "all"]:
            history = load_json_file(BROWSING_HISTORY_FILE)
            filtered_history = [item for item in history if item.get("user_id") != user_id]
            save_json_file(BROWSING_HISTORY_FILE, filtered_history)
        return True
    except Exception as e:
        print(f"[LOCAL] Error deleting user history: {str(e)}")
        return False

def delete_specific_query(user_id: str, query_id: str) -> bool:
    """Delete a specific query from user's history"""
    try:
        history = load_json_file(QUERY_HISTORY_FILE)
        filtered_history = [
            item for item in history 
            if not (item.get("user_id") == user_id and item.get("id") == query_id)
        ]
        if len(filtered_history) == len(history):
            return False
        save_json_file(QUERY_HISTORY_FILE, filtered_history)
        return True
    except Exception as e:
        return False

def save_browsing_history(
    user_id: str,
    url: str,
    title: str,
    timestamp: datetime,
    metadata: Optional[Dict] = None
) -> str:
    """Save a browsing history entry"""
    history_id = str(uuid.uuid4())
    history_data = {
        "id": history_id,
        "user_id": user_id,
        "url": url,
        "title": title,
        "timestamp": timestamp.isoformat() if hasattr(timestamp, 'isoformat') else str(timestamp),
        "metadata": metadata or {}
    }
    history = load_json_file(BROWSING_HISTORY_FILE)
    history.append(history_data)
    save_json_file(BROWSING_HISTORY_FILE, history)
    return history_id
