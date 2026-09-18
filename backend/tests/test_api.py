# Comprehensive Test Suite for Askify Backend (v2.0 Next-Gen)
import pytest
import os
import sys
import json

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Ensure test environment uses local storage
os.environ["STORAGE_MODE"] = "local"
os.environ["LOCAL_DB_DIR"] = os.path.join(backend_dir, "tests_local_db")
os.environ["VECTOR_DB_PATH"] = os.path.join(backend_dir, "tests_chromadb")

from fastapi.testclient import TestClient
from app.main import app
from app.auth.password import get_password_hash, verify_password
from app.db.vector_store import add_to_vector_store, search_relevant_chunks, get_fallback_chunks

client = TestClient(app)

def test_health_endpoint():
    """Verify health check endpoint returns 200 and healthy status"""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "Askify API"
    assert data["version"] == "2.0.0"
    assert "storage_mode" in data

def test_root_endpoint():
    """Verify root endpoint returns welcome and metadata"""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "Askify" in data["message"]
    assert data["version"] == "2.0.0"

def test_password_hashing():
    """Verify robust password hashing and verification"""
    plain = "SuperSecurePassword123!"
    hashed = get_password_hash(plain)
    assert hashed != plain
    assert verify_password(plain, hashed) is True
    assert verify_password("WrongPassword!", hashed) is False

def test_user_registration_and_login():
    """Verify user registration, JWT token generation, and /me endpoint"""
    test_email = f"test_engineer_{os.urandom(4).hex()}@example.com"
    test_password = "Password987!"

    # Register
    reg_resp = client.post("/api/v1/auth/register", json={
        "email": test_email,
        "password": test_password,
        "full_name": "Senior AI Engineer"
    })
    assert reg_resp.status_code == 201
    assert "user_id" in reg_resp.json()

    # Login for token
    login_resp = client.post("/api/v1/auth/token", data={
        "username": test_email,
        "password": test_password
    })
    assert login_resp.status_code == 200
    token_data = login_resp.json()
    assert "access_token" in token_data
    token = token_data["access_token"]

    # Verify protected /me
    me_resp = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == test_email

def test_direct_dom_content_ingestion():
    """Verify Chrome extension direct DOM content ingestion into Vector DB"""
    test_url = "https://tech-news.org/articles/ai-revolution-2026"
    test_content = (
        "Next-generation browser assistants combine live DOM parsing with hybrid RAG.\n\n"
        "By running content scripts directly inside the browser tab, the assistant bypasses bot-blocking.\n\n"
        "Benchmark results demonstrate a 95% reduction in initial token latency using Server-Sent Events."
    )

    resp = client.post("/api/v1/content/ingest", json={
        "url": test_url,
        "content": test_content,
        "title": "AI Revolution 2026",
        "metadata": {"author": "Darsh Patel", "word_count": 42}
    })
    assert resp.status_code == 200
    assert resp.json()["success"] is True

def test_query_ask_endpoint():
    """Verify query ask endpoint processes questions with context"""
    test_url = "https://tech-news.org/articles/ai-revolution-2026"
    resp = client.post("/api/v1/query/ask", json={
        "query": "What reduction in latency was demonstrated?",
        "url": test_url,
        "page_content": "Benchmark results demonstrate a 95% reduction in initial token latency using Server-Sent Events."
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["success"] is True
    assert len(data["answer"]) > 10
    assert "confidence" in data

def test_query_streaming_sse_endpoint():
    """Verify /query/stream returns text/event-stream SSE chunks"""
    test_url = "https://tech-news.org/articles/ai-revolution-2026"
    resp = client.post("/api/v1/query/stream", json={
        "query": "Summarize the core innovation.",
        "url": test_url,
        "page_content": "Next-generation browser assistants combine live DOM parsing with hybrid RAG."
    })
    assert resp.status_code == 200
    assert "text/event-stream" in resp.headers["content-type"]
    
    # Check stream content has data: tokens
    lines = resp.text.split("\n")
    data_lines = [l for l in lines if l.startswith("data: ")]
    assert len(data_lines) > 0

def test_paragraph_chunker():
    """Verify paragraph-aware chunking maintains semantic boundaries"""
    long_text = "\n\n".join([f"Paragraph {i}: This contains critical research findings." for i in range(25)])
    chunks = get_fallback_chunks(long_text, max_chunk_size=300)
    assert len(chunks) > 1
    for chunk in chunks:
        assert len(chunk) <= 400

# Cleanup test directory after run
@pytest.fixture(scope="session", autouse=True)
def cleanup_test_artifacts():
    yield
    import shutil
    for path in [os.environ.get("LOCAL_DB_DIR"), os.environ.get("VECTOR_DB_PATH")]:
        if path and os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
