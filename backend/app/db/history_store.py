# History storage using Supabase
import uuid
from typing import Dict, Optional
from datetime import datetime
from supabase import create_client

from app.core.config import SUPABASE_URL, SUPABASE_KEY

# Initialize Supabase client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

def save_browsing_history(
    user_id: str,
    url: str,
    title: str,
    timestamp: datetime,
    metadata: Optional[Dict] = None
) -> str:
    """
    Save a browsing history entry
    
    Args:
        user_id: The user's ID
        url: The URL visited
        title: The title of the page
        timestamp: When the page was visited
        metadata: Additional metadata about the page
    
    Returns:
        The ID of the history entry
    """
    import traceback
    traceback.print_stack()
    
    history_id = str(uuid.uuid4())
    
    history_data = {
        "id": history_id,
        "user_id": user_id,
        "url": url,
        "title": title,
        "timestamp": timestamp.isoformat(),
        "metadata": metadata or {}
    }
    
    # Insert into Supabase

    supabase.table("browsing_history").insert(history_data).execute()

    
    return history_id

def save_query_history(
    user_id: str,
    query: str,
    answer: str,
    url: str,
    timestamp: datetime
) -> str:
    """
    Save a query history entry
    
    Args:
        user_id: The user's ID
        query: The query asked
        answer: The answer provided
        url: The URL where the query was asked
        timestamp: When the query was asked
    
    Returns:
        The ID of the query history entry
    """
    query_id = str(uuid.uuid4())
    
    query_data = {
        "id": query_id,
        "user_id": user_id,
        "query": query,
        "answer": answer,
        "url": url,
        "timestamp": timestamp.isoformat()
    }
    
    supabase.table("query_history").insert(query_data).execute()
    
    return query_id

def get_user_history(user_id: str, limit: int = 100, offset: int = 0):
    """
    Get a user's browsing and query history
    
    Args:
        user_id: The user's ID
        limit: Maximum number of items to return
        offset: Number of items to skip
    
    Returns:
        Dict containing browsing and query history
    """
    # Get browsing history
    browsing_response = supabase.table("browsing_history")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("timestamp", desc=True)\
        .limit(limit)\
        .offset(offset)\
        .execute()
    
    # Get query history
    query_response = supabase.table("query_history")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("timestamp", desc=True)\
        .limit(limit)\
        .offset(offset)\
        .execute()
    
    return {
        "browsing_history": browsing_response.data,
        "query_history": query_response.data
    }

def get_query_history(user_id: str, limit: int = 10, offset: int = 0):
    """
    Get a user's query history
    
    Args:
        user_id: The user's ID
        limit: Maximum number of items to return
        offset: Number of items to skip
    
    Returns:
        List of query history items
    """
    # Get query history
    query_response = supabase.table("query_history")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("timestamp", desc=True)\
        .limit(limit)\
        .offset(offset)\
        .execute()
    
    return query_response.data
