# Query processing service using LangChain RAG
from typing import Dict, List, Any, Optional, Sequence
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.chains import RetrievalQAWithSourcesChain
from langchain_core.documents import Document
from langchain.prompts import PromptTemplate
from urllib.parse import urlparse
from langchain_core.retrievers import BaseRetriever

from app.core.config import OPENAI_API_KEY
from app.db.vector_store import get_vector_store_for_user, collection_has_documents
from app.services.content_service import process_and_store_content, extract_webpage_content

# Initialize LLM
llm = ChatOpenAI(
    openai_api_key=OPENAI_API_KEY,
    model_name="gpt-4o-mini",
    temperature=0.2
)

# Initialize embeddings
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

class PreFilteredRetriever(BaseRetriever):
    """A retriever that returns pre-filtered documents"""
    
    documents: Sequence[Document]
    
    model_config = {"arbitrary_types_allowed": True}
    
    def _get_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
        """Return the already filtered documents"""
        return list(self.documents)
    
    async def _aget_relevant_documents(self, query: str, *, run_manager=None) -> List[Document]:
        """Async version - return the already filtered documents"""
        return list(self.documents)

def answer_query(user_id: str, query: str, url: str) -> Dict:
    """
    Answer a query using RAG (Retrieval Augmented Generation)
    
    Args:
        user_id: The ID of the user asking the question
        query: The question asked by the user
        url: The URL of the current page
    
    Returns:
        Dict containing the answer and source information
    """
    # Process and store content if it doesn't already exist
    content_processed = process_and_store_content(user_id, url, embeddings)
    
    # If processing failed, check if it's because the site is blocking us
    if not content_processed:
        content = extract_webpage_content(url)
        if content.startswith("SITE_BLOCKED:"):
            return {
                "answer": "I'm unable to access content on this website. The site appears to be blocking automated access.",
                "sources": {},
                "confidence": 0.0
            }
    
    # Check if the collection has any documents at all
    has_documents = collection_has_documents(user_id, embeddings)
    if not has_documents:
        return {
            "answer": "I don't have any information about this page yet. Please try again after browsing the page for a moment.",
            "sources": {},
            "confidence": 0.0
        }
    
    # Get the user's vector store (now containing the URL's content if it was new)
    vector_store = get_vector_store_for_user(user_id, embeddings)
    
    # Extract URL details for exact URL-specific filtering
    parsed_url = urlparse(url)
    
    # Get documents from the exact URL only
    try:
        url_specific_docs = vector_store.similarity_search_with_relevance_scores(
            query=query,
            k=5,
            filter={"full_url": url}  # Filter for documents from this exact URL
        )
    except Exception as e:
        # Fall back to source filter if full_url filter fails
        try:
            url_specific_docs = vector_store.similarity_search_with_relevance_scores(
                query=query,
                k=5,
                filter={"source": url}  # Traditional source filter
            )
        except Exception:
            url_specific_docs = []
    
    # Use only URL-specific docs
    all_docs = url_specific_docs
    
    # Filter to only include documents with sufficient similarity (score > 0.5)
    relevant_docs = [doc for doc, score in all_docs if score > 0.5]
    
    if len(relevant_docs) == 0:
        return {
            "answer": "I couldn't find any relevant information about that topic on this page. Please try a different question.",
            "sources": {},
            "confidence": 0.0
        }
    
    # Create a custom document retriever with our pre-filtered documents
    retriever = PreFilteredRetriever(documents=relevant_docs)
    
    # Create retrieval chain
    qa_chain = RetrievalQAWithSourcesChain.from_chain_type(
        llm=llm,
        chain_type="stuff",  # "stuff" method concatenates all docs into one prompt
        retriever=retriever,
        return_source_documents=True,
        chain_type_kwargs={
            "prompt": PromptTemplate(
                template="""You are a helpful, professional assistant that provides accurate and well-formatted information.
                
                Use Markdown formatting to organize your answers with headings, bullet points, bold text, etc.
                For code blocks, use proper syntax highlighting with the appropriate language specified.
                For tables, use proper Markdown table formatting.
                For lists, use proper numbered or bulleted lists.
                Use bold formatting for key points.
                
                Please answer the following question based on the provided context:
                
                {question}
                
                Context:
                {summaries}
                
                Answer:""",
                input_variables=["summaries", "question"]
            )
        }
    )
    
    # Run the chain with invoke instead of __call__
    result = qa_chain.invoke({"question": query})
    
    # Format sources
    sources = {}
    for doc in result.get("source_documents", []):
        source_url = doc.metadata.get("source")
        if source_url:
            snippet = doc.page_content[:200] + "..." if len(doc.page_content) > 200 else doc.page_content
            if source_url in sources:
                sources[source_url].append(snippet)
            else:
                sources[source_url] = [snippet]
    
    return {
        "answer": result.get("answer"),
        "sources": sources,
        "confidence": 0.95
    }
