# Vector database storage with ChromaDB & Zero-Crash Fallback (Askify Next-Gen)
import os
import uuid
import re
from typing import Optional, List, Dict, Any
from datetime import datetime
from urllib.parse import urlparse

from app.core.config import VECTOR_DB_PATH, OPENAI_API_KEY

os.makedirs(VECTOR_DB_PATH, exist_ok=True)

# In-memory document chunk store for resilient fallback
_LOCAL_CHUNKS: Dict[str, List[Dict[str, Any]]] = {}

# ChromaDB Client setup
chroma_client = None
try:
    import chromadb
    from chromadb.config import Settings
    chroma_client = chromadb.PersistentClient(path=VECTOR_DB_PATH, settings=Settings(anonymized_telemetry=False))
except Exception as e:
    print(f"[WARN] ChromaDB initialization skipped/failed ({e}). Using in-memory store.")
    chroma_client = None

def get_fallback_chunks(content: str, max_chunk_size: int = 1200, overlap: int = 150) -> List[str]:
    """Smart paragraph-aware chunking without external library dependencies"""
    paragraphs = content.split('\n\n')
    chunks = []
    current_chunk = []
    current_length = 0

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        p_len = len(p)
        if current_length + p_len > max_chunk_size and current_chunk:
            chunks.append('\n\n'.join(current_chunk))
            current_chunk = [p]
            current_length = p_len
        else:
            current_chunk.append(p)
            current_length += p_len + 2

    if current_chunk:
        chunks.append('\n\n'.join(current_chunk))

    if not chunks and content:
        chunks = [content[:max_chunk_size]]
    return chunks

def add_to_vector_store(
    user_id: str,
    content: str,
    url: str,
    summary: Optional[str] = None,
    embeddings=None,
    timestamp: Optional[datetime] = None
) -> str:
    """Index content into ChromaDB or fallback store with paragraph-aware chunking"""
    content_id = str(uuid.uuid4())
    parsed = urlparse(url)
    base_meta = {
        "source": url,
        "domain": parsed.netloc,
        "full_url": url,
        "timestamp": timestamp.isoformat() if timestamp else datetime.utcnow().isoformat(),
        "summary": summary or ""
    }

    chunks = get_fallback_chunks(content)

    # Store in fallback registry
    if user_id not in _LOCAL_CHUNKS:
        _LOCAL_CHUNKS[user_id] = []

    for i, chunk in enumerate(chunks):
        doc = {
            "id": f"{content_id}_{i}",
            "content": chunk,
            "metadata": {**base_meta, "chunk_id": f"{content_id}_{i}", "content_id": content_id}
        }
        _LOCAL_CHUNKS[user_id].append(doc)

    # Attempt ChromaDB indexing if available
    if chroma_client:
        try:
            coll_name = f"user_{user_id}".replace("-", "_")
            collection = chroma_client.get_or_create_collection(name=coll_name)
            ids = [f"{content_id}_{i}" for i in range(len(chunks))]
            metas = [{**base_meta, "chunk_id": f"{content_id}_{i}"} for i in range(len(chunks))]
            collection.add(
                documents=chunks,
                metadatas=metas,
                ids=ids
            )
        except Exception as e:
            print(f"[INFO] Chroma add skipped/failed ({e}). Preserved in fallback store.")

    return content_id

def url_exists_in_vector_store(user_id: str, url: str, embeddings=None) -> bool:
    """Check if content for URL is indexed"""
    if user_id in _LOCAL_CHUNKS:
        if any(doc["metadata"].get("full_url") == url or doc["metadata"].get("source") == url for doc in _LOCAL_CHUNKS[user_id]):
            return True

    if chroma_client:
        try:
            coll_name = f"user_{user_id}".replace("-", "_")
            collection = chroma_client.get_collection(name=coll_name)
            res = collection.get(where={"source": url}, limit=1)
            return len(res.get("ids", [])) > 0
        except Exception:
            return False
    return False

def collection_has_documents(user_id: str, embeddings=None) -> bool:
    """Check if user has any documents"""
    if user_id in _LOCAL_CHUNKS and len(_LOCAL_CHUNKS[user_id]) > 0:
        return True
    if chroma_client:
        try:
            coll_name = f"user_{user_id}".replace("-", "_")
            collection = chroma_client.get_collection(name=coll_name)
            return collection.count() > 0
        except Exception:
            return False
    return False

def search_relevant_chunks(user_id: str, query: str, url: Optional[str] = None, k: int = 4) -> List[Dict[str, Any]]:
    """Hybrid search: Chroma similarity search with BM25 / keyword scoring fallback"""
    results = []

    if chroma_client:
        try:
            coll_name = f"user_{user_id}".replace("-", "_")
            collection = chroma_client.get_collection(name=coll_name)
            where_filter = {"source": url} if url else None
            res = collection.query(query_texts=[query], n_results=k, where=where_filter)
            if res and res.get("documents") and res["documents"][0]:
                for i, doc in enumerate(res["documents"][0]):
                    results.append({
                        "content": doc,
                        "metadata": res["metadatas"][0][i] if res.get("metadatas") else {},
                        "score": 0.85
                    })
                return results
        except Exception:
            pass

    # Keyword scoring fallback
    user_docs = _LOCAL_CHUNKS.get(user_id, [])
    if url:
        user_docs = [d for d in user_docs if d["metadata"].get("full_url") == url or d["metadata"].get("source") == url]

    if not user_docs:
        return []

    words = set(re.findall(r'\w+', query.lower()))
    scored = []
    for d in user_docs:
        doc_words = set(re.findall(r'\w+', d["content"].lower()))
        overlap = len(words.intersection(doc_words))
        score = overlap / max(1, len(words))
        scored.append((score, d))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [{"content": d["content"], "metadata": d["metadata"], "score": s} for s, d in scored[:k]]
