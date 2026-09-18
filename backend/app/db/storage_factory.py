# Storage Factory - chooses between Supabase and Local storage (Askify Next-Gen)
import os

def get_storage_backend():
    """
    Returns the appropriate storage backend based on the STORAGE_MODE environment variable.
    Gracefully defaults to local file-based storage if Supabase credentials are not set.
    """
    supabase_url = os.getenv("SUPABASE_URL", "")
    supabase_key = os.getenv("SUPABASE_KEY", "")
    
    default_mode = "supabase" if (supabase_url and supabase_key) else "local"
    storage_mode = os.getenv("STORAGE_MODE", default_mode).lower()
    
    if storage_mode == "supabase" and supabase_url and supabase_key:
        try:
            from app.db.history_store import (
                save_query_history,
                get_query_history,
                delete_user_history,
                delete_specific_query,
                save_browsing_history,
                get_user_history
            )
            return {
                'save_query_history': save_query_history,
                'get_query_history': get_query_history,
                'delete_user_history': delete_user_history,
                'delete_specific_query': delete_specific_query,
                'save_browsing_history': save_browsing_history,
                'get_user_history': get_user_history
            }
        except Exception as e:
            print(f"[WARN] Supabase storage init failed ({e}). Falling back to local storage.")

    # Local fallback
    from app.db.local_history_store import (
        save_query_history,
        get_query_history,
        delete_user_history,
        delete_specific_query,
        save_browsing_history,
        get_user_history
    )
    return {
        'save_query_history': save_query_history,
        'get_query_history': get_query_history,
        'delete_user_history': delete_user_history,
        'delete_specific_query': delete_specific_query,
        'save_browsing_history': save_browsing_history,
        'get_user_history': get_user_history
    }

# Get the storage functions
storage = get_storage_backend()
save_query_history = storage['save_query_history']
get_query_history = storage['get_query_history']
delete_user_history = storage['delete_user_history']
delete_specific_query = storage['delete_specific_query']
save_browsing_history = storage['save_browsing_history']
get_user_history = storage['get_user_history']
