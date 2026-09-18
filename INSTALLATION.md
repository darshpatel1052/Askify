# 🚀 Quick Installation Guide: Askify 2.0

Get Askify 2.0 running as a Chrome Extension in under 1 minute.

---

## ⚡ Option A: Standalone Extension (30 Seconds — No Server Required!)

If you want to use Askify immediately with your own API keys (OpenAI, Google Gemini, Anthropic Claude, or local Ollama):

1. Open Google Chrome and visit `chrome://extensions/`.
2. Toggle on **Developer mode** (top-right corner).
3. Click **Load unpacked** (top-left corner) and select the `extension/` folder in this repository:
   ```text
   /home/predator-linux/Documents/antigravity/zealous-heisenberg/extension
   ```
4. Pin **Askify** to your Chrome toolbar.
5. Click the Askify icon on any webpage to open the **Popup Assistant**!
6. Click **Settings** (⚙️ top right in the popup) and enter your API key (or point to local Ollama on `http://localhost:11434`).
7. **You're all set!** Browse to any webpage and ask questions or use one-click power tools directly in the popup!

---

## ⚡ Option B: Full-Stack Setup with FastAPI & ChromaDB

If you want to run the centralized FastAPI microservice with ChromaDB vector search and multi-user authentication:

### 1. Backend Setup
```bash
# Navigate to backend
cd backend

# Create & activate a virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# (Optional) Copy environment template
cp .env.sample .env
```

### 2. Configure Environment (Optional)
By default, the backend runs out of the box in **zero-config local mode** (using file-based SQLite/JSON storage, no database configuration needed).
If you want to use live OpenAI GPT-4o models or Supabase, edit `backend/.env`:
```env
OPENAI_API_KEY=your-openai-api-key-here
STORAGE_MODE=local
```

### 3. Start the Server
```bash
python run.py
```
You should see:
```
INFO:     Started server process
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000
```
Interactive API documentation is live at `http://localhost:8000/docs`.

### 4. Load the Chrome Extension
1. Go to `chrome://extensions/` in Chrome.
2. Enable **Developer mode**.
3. Click **Load unpacked** and choose the `extension/` folder.
4. Click the extension icon to start asking questions!
