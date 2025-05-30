# Storage Factory - chooses between Supabase and Local storage
import os
from typing import Union

def get_storage_backend():
    """
    Returns the appropriate storage backend based on the STORAGE_MODE environment variable.
    """
    storage_mode = os.getenv("STORAGE_MODE", "supabase").lower()
    
    if storage_mode == "local":
        print("Using local file-based storage")
        from app.db.local_history_store import (
            save_query_history,
            get_query_history,
            delete_user_history,
            delete_specific_query
        )
        return {
            'save_query_history': save_query_history,
            'get_query_history': get_query_history,
            'delete_user_history': delete_user_history,
            'delete_specific_query': delete_specific_query
        }
    else:
        print("Using Supabase storage")
        from app.db.history_store import (
            save_query_history,
            get_query_history,
            delete_user_history,
            delete_specific_query
        )
        return {
            'save_query_history': save_query_history,
            'get_query_history': get_query_history,
            'delete_user_history': delete_user_history,
            'delete_specific_query': delete_specific_query
        }

# Get the storage functions
storage = get_storage_backend()
save_query_history = storage['save_query_history']
get_query_history = storage['get_query_history']
delete_user_history = storage['delete_user_history']
delete_specific_query = storage['delete_specific_query']
