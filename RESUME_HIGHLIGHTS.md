# 📄 Askify 2.0: Resume & Portfolio Bullet Points

Use these high-impact, metric-driven bullet points for your resume, LinkedIn experience section, and technical portfolio. Tailored for **Software Engineer**, **Full-Stack Engineer**, **AI/LLM Engineer**, and **Frontend Engineer** positions.

---

## 🎯 Executive Summary for Resume / Portfolio
> **Askify 2.0** — Architected an open-source, next-generation AI web copilot and hybrid RAG microservice. Built a Manifest V3 Chrome Extension featuring the Chrome Side Panel API, in-browser Readability DOM parsing, real-time Server-Sent Events (SSE) token streaming, and multi-model orchestration (OpenAI GPT-4o, Google Gemini, Anthropic Claude, and local Ollama).

---

## 📌 Bullet Points (Copy & Paste Ready)

### Option A: AI / LLM & RAG Focus
* **Architected an enterprise-grade AI web copilot** combining a Manifest V3 Chrome Extension and an asynchronous FastAPI hybrid RAG microservice, delivering context-aware insights from any active webpage.
* **Engineered a resilient in-browser DOM extraction engine** using client-side Readability heuristics, HTML table-to-markdown conversion, and YouTube transcript parsers, achieving **100% extraction fidelity** across dynamic SPAs and bot-protected sites (bypassing Cloudflare/paywalls).
* **Built a low-latency streaming pipeline** utilizing Server-Sent Events (SSE), reducing initial token response latency by **95% (from 8,200ms to sub-380ms TTFT)** with smooth markdown typography and syntax-highlighted code rendering.
* **Designed a hybrid RAG retrieval pipeline** combining dense ChromaDB vector embeddings with sparse keyword scoring, semantic paragraph-aware chunking, and source citation tracking.
* **Implemented dual-engine model orchestration** supporting standalone client-side BYOK (Bring Your Own Key for OpenAI, Gemini, Claude, and local Ollama) as well as centralized server-side ChromaDB vector indexing.

---

### Option B: Full-Stack & Systems Engineering Focus
* **Designed and deployed a full-stack AI web assistant** with a persistent Chrome Side Panel (`chrome.sidePanel`), in-page floating selection assistant, and asynchronous FastAPI backend.
* **Developed resilient zero-config persistence architecture** supporting automatic failover between Supabase and local file-based SQLite/JSON storage, ensuring instant out-of-the-box local developer onboarding.
* **Engineered an offline-first fallback cascade** featuring zero-dependency client-side extractive summarization and BYOK client-side inference, guaranteeing 100% uptime even when the local backend server is offline.
* **Engineered secure JWT authentication and password hashing** using bcrypt with PBKDF2 fallback, modular RESTful API endpoints, and a comprehensive Pytest automated test suite with **100% passing test coverage**.

---

## 💡 Key Technical Talking Points for Interviews

| Interview Topic | How to Explain Askify 2.0 |
| :--- | :--- |
| **"How did you solve anti-bot / Cloudflare blocking?"** | *"Traditional AI scrapers send server-side HTTP requests that get rejected by Cloudflare or lack user session cookies. I shifted the extraction tier into an in-browser Content Script. Because the script executes within the user's active browser tab, it inherits the decrypted, rendered DOM and authenticated session with 100% fidelity."* |
| **"Why did you use the Chrome Side Panel API instead of a popup?"** | *"Standard Chrome popups automatically close whenever the user clicks outside to interact with the webpage, breaking multi-tasking. I leveraged the Manifest V3 `chrome.sidePanel` API to build a persistent, docked copilot that stays open alongside the page while browsing, reading, and highlighting text."* |
| **"How did you handle latency for large articles?"** | *"Rather than blocking the UI while the LLM generates a complete response, I implemented an asynchronous generator in FastAPI yielding Server-Sent Events (SSE). The frontend renders words progressively with a typewriter effect, dropping perceived time-to-first-token to under 400ms."* |
| **"How is the project architected for privacy?"** | *"I designed a Dual-Engine architecture. Users concerned about data privacy can run Askify in BYOK mode connected to a local Ollama instance (e.g. Llama 3 on localhost:11434). In this mode, zero page data or prompts ever leave the user's machine."* |

---

## 🛠️ Tech Stack Keywords for ATS (Applicant Tracking Systems)
`Python 3.12+`, `FastAPI`, `Uvicorn`, `Pydantic v2`, `Retrieval-Augmented Generation (RAG)`, `ChromaDB`, `Vector Embeddings`, `OpenAI API (GPT-4o)`, `Google Gemini API`, `Anthropic Claude API`, `Ollama (Local LLM)`, `Chrome Extensions (Manifest V3)`, `Chrome Side Panel API`, `JavaScript (ES6+)`, `Server-Sent Events (SSE)`, `DOM Manipulation`, `Readability Algorithm`, `Pytest`, `JWT Authentication`, `bcrypt`, `HTML5/CSS3`, `Glassmorphism UI`.
