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

def delete_user_history(user_id: str, history_type: str = "all") -> bool:
    """
    Delete a user's history (query history, browsing history, or both)
    
    Args:
        user_id: The user's ID
        history_type: Type of history to delete ("query", "browsing", or "all")
    
    Returns:
        Boolean indicating success
    """
    try:
        if history_type in ["query", "all"]:
            # Delete query history
            supabase.table("query_history")\
                .delete()\
                .eq("user_id", user_id)\
                .execute()
        
        if history_type in ["browsing", "all"]:
            # Delete browsing history
            supabase.table("browsing_history")\
                .delete()\
                .eq("user_id", user_id)\
                .execute()
        
        return True
    except Exception as e:
        print(f"Error deleting user history: {str(e)}")
        return False

def delete_specific_query(user_id: str, query_id: str) -> bool:
    """
    Delete a specific query from user's history
    
    Args:
        user_id: The user's ID
        query_id: The specific query ID to delete
    
    Returns:
        Boolean indicating success
    """
    try:
        # First check if the query exists
        existing_query = supabase.table("query_history")\
            .select("id")\
            .eq("user_id", user_id)\
            .eq("id", query_id)\
            .execute()
        
        if not existing_query.data:
            print(f"Query with id {query_id} not found for user {user_id}")
            return False
        
        # Delete the query
        result = supabase.table("query_history")\
            .delete()\
            .eq("user_id", user_id)\
            .eq("id", query_id)\
            .execute()
        
        print(f"Successfully deleted query {query_id} for user {user_id}")
        return True
    except Exception as e:
        print(f"Error deleting specific query: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
