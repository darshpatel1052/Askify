# Modern Query processing service with SSE Streaming RAG (Askify Next-Gen)
import json
import asyncio
from typing import Dict, List, Any, Optional, AsyncGenerator
from datetime import datetime

from app.core.config import OPENAI_API_KEY, DEFAULT_MODEL
from app.db.vector_store import (
    search_relevant_chunks,
    add_to_vector_store,
    url_exists_in_vector_store
)
from app.services.content_service import extract_webpage_content, ingest_direct_content

# Setup OpenAI client if available
openai_client = None
if OPENAI_API_KEY:
    try:
        from openai import AsyncOpenAI
        openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    except Exception as e:
        print(f"[WARN] AsyncOpenAI init error: {e}")
        openai_client = None

def get_context_for_query(user_id: str, query: str, url: str, page_content: Optional[str] = None, selected_text: Optional[str] = None) -> tuple[str, Dict]:
    """Retrieve or build the most relevant context and source citations"""
    sources = {}

    # Priority 1: User explicitly highlighted a selection
    if selected_text and len(selected_text.strip()) > 5:
        sources[url] = [selected_text[:200] + "..."]
        return f"[User Selected Text Focus]:\n{selected_text}", sources

    # Priority 2: In-browser pre-extracted DOM content passed from extension
    if page_content and len(page_content.strip()) > 50:
        # Auto-index into vector store if not already present
        if not url_exists_in_vector_store(user_id, url):
            add_to_vector_store(user_id=user_id, content=page_content, url=url)

        # Retrieve relevant chunks
        chunks = search_relevant_chunks(user_id, query, url=url, k=4)
        if chunks:
            context_text = "\n\n---\n\n".join([c["content"] for c in chunks])
            sources[url] = [c["content"][:180] + "..." for c in chunks]
            return context_text, sources
        else:
            sources[url] = [page_content[:200] + "..."]
            return page_content[:8000], sources

    # Priority 3: Query ChromaDB vector store
    chunks = search_relevant_chunks(user_id, query, url=url, k=4)
    if chunks:
        context_text = "\n\n---\n\n".join([c["content"] for c in chunks])
        sources[url] = [c["content"][:180] + "..." for c in chunks]
        return context_text, sources

    # Priority 4: Fallback server-side scrape
    scraped = extract_webpage_content(url)
    if scraped and not scraped.startswith("SITE_BLOCKED:"):
        add_to_vector_store(user_id=user_id, content=scraped, url=url)
        sources[url] = [scraped[:200] + "..."]
        return scraped[:8000], sources

    return "No page context could be retrieved.", sources

def answer_query(user_id: str, query: str, url: str, page_content: Optional[str] = None, selected_text: Optional[str] = None) -> Dict:
    """Non-streaming query answering for backward compatibility"""
    context, sources = get_context_for_query(user_id, query, url, page_content, selected_text)

    if openai_client and OPENAI_API_KEY:
        try:
            import openai
            client = openai.OpenAI(api_key=OPENAI_API_KEY)
            resp = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are Askify, an expert AI web copilot. "
                            "Answer questions based strictly on the provided context. "
                            "Use clean Markdown with bold points, bullet lists, and code blocks."
                        )
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {query}"
                    }
                ],
                temperature=0.25
            )
            answer = resp.choices[0].message.content
            return {
                "answer": answer,
                "sources": sources,
                "confidence": 0.95
            }
        except Exception as e:
            return {
                "answer": f"Error communicating with OpenAI API ({str(e)}). Please verify your OPENAI_API_KEY in backend/.env.",
                "sources": sources,
                "confidence": 0.0
            }

    # Mock / Demo fallback if OpenAI key is not set
    mock_answer = (
        f"**Analysis for:** `{query}`\n\n"
        f"Based on the webpage content analyzed ({len(context)} characters evaluated):\n\n"
        f"- **Primary Finding:** The content addresses the query regarding *{query}*.\n"
        f"- **Key Point:** Askify successfully parsed the page structure and extracted relevant text blocks.\n"
        f"- **Context Status:** {len(sources.get(url, []))} document chunk(s) matched your query.\n\n"
        f"> *Note: Running in test/demo mode. Provide an `OPENAI_API_KEY` in `backend/.env` for live GPT-4o model generation.*"
    )
    return {
        "answer": mock_answer,
        "sources": sources,
        "confidence": 0.90
    }

async def stream_query_tokens(
    user_id: str,
    query: str,
    url: str,
    page_content: Optional[str] = None,
    selected_text: Optional[str] = None,
    model: Optional[str] = None
) -> AsyncGenerator[str, None]:
    """
    Async SSE stream generator yielding real-time word tokens:
    data: {"token": "..."}\n\n
    """
    context, sources = get_context_for_query(user_id, query, url, page_content, selected_text)
    selected_model = model or DEFAULT_MODEL

    if openai_client and OPENAI_API_KEY:
        try:
            stream = await openai_client.chat.completions.create(
                model=selected_model,
                messages=[
                    {
                        "role": "system",
                        "content": (
                            "You are Askify, a helpful AI web assistant. "
                            "Answer questions accurately using the provided page context. "
                            "Format clearly with Markdown (headings, bullet points, bold key points, code blocks with languages, and tables)."
                        )
                    },
                    {
                        "role": "user",
                        "content": f"Context:\n{context}\n\nQuestion: {query}"
                    }
                ],
                stream=True,
                temperature=0.25
            )

            async for chunk in stream:
                delta = chunk.choices[0].delta.content if chunk.choices else None
                if delta:
                    payload = json.dumps({"token": delta})
                    yield f"data: {payload}\n\n"

            yield "data: [DONE]\n\n"
            return

        except Exception as e:
            err_msg = json.dumps({"token": f"\n\n[API Error: {str(e)}]"})
            yield f"data: {err_msg}\n\n"
            yield "data: [DONE]\n\n"
            return

    # Simulated fluid streaming when running without an API key (for local tests & demos)
    demo_tokens = [
        "**Summary & Analysis**\n\n",
        f"Based on the webpage `{url}`",
        f" regarding **\"{query}\"**:\n\n",
        "- **Key Insight:** ",
        "Askify's resilient DOM parser successfully captured the rendered webpage content, ",
        "bypassing bot blockers and paywall shields.\n",
        "- **Structured Extraction:** ",
        "Content was chunked and indexed into the vector store with sub-50ms hybrid retrieval.\n",
        "- **Recommendation:** ",
        "You can explore follow-up questions, request structured data tables, or generate a quiz!\n\n",
        "> *Tip: Add your `OPENAI_API_KEY` in `backend/.env` or client settings for live model generation.*"
    ]

    for tok in demo_tokens:
        await asyncio.sleep(0.06)
        payload = json.dumps({"token": tok})
        yield f"data: {payload}\n\n"

    yield "data: [DONE]\n\n"
