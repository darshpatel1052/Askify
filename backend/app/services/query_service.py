# Query processing service using LangChain RAG
from typing import Dict
from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain.chains import RetrievalQAWithSourcesChain
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain.prompts import PromptTemplate
from langchain_community.document_loaders import WebBaseLoader

from app.core.config import OPENAI_API_KEY
from app.db.vector_store import get_vector_store_for_user

# Initialize LLM
llm = ChatOpenAI(
    openai_api_key=OPENAI_API_KEY,
    model_name="gpt-4o-mini",
    temperature=0.2
)

# Initialize embeddings
embeddings = OpenAIEmbeddings(openai_api_key=OPENAI_API_KEY)

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
    # Get the user's vector store
    vector_store = get_vector_store_for_user(user_id, embeddings)
    
    # Load content from the webpage using WebBaseLoader
    loader = WebBaseLoader(url)
    current_docs = loader.load()
    
    # Split documents into chunks
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=100
    )
    
    current_chunks = text_splitter.split_documents(current_docs)
    
    # Add current content to temporary vector store
    for chunk in current_chunks:
        vector_store.add_documents([chunk])
    
    # Create retrieval chain
    qa_chain = RetrievalQAWithSourcesChain.from_chain_type(
        llm=llm,
        chain_type="stuff",
        retriever=vector_store.as_retriever(search_kwargs={"k": 5}),
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
        "confidence": 0.95  # This could be calculated based on various factors
    }
