// Configuration for Askify Chrome Extension (v2.0 Next-Gen)
const CONFIG = {
    // API Endpoints
    API_BASE_URL: 'http://localhost:8000/api/v1',
    STREAM_ENDPOINT: 'http://localhost:8000/api/v1/query/stream',
    INGEST_ENDPOINT: 'http://localhost:8000/api/v1/content/ingest',

    // Engine Mode: 'backend' (FastAPI + ChromaDB RAG) or 'byok' (Direct Client-Side Keys)
    DEFAULT_ENGINE_MODE: 'backend',

    // Model Defaults
    DEFAULT_PROVIDER: 'openai', // 'openai', 'gemini', 'anthropic', 'ollama'
    DEFAULT_MODEL: 'gpt-4o-mini',
    
    AVAILABLE_MODELS: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Smart)', provider: 'openai' },
        { id: 'gpt-4o', name: 'GPT-4o (Deep Reasoning)', provider: 'openai' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra Fast)', provider: 'gemini' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Large Context)', provider: 'gemini' },
        { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet (Nuanced)', provider: 'anthropic' },
        { id: 'llama3:8b', name: 'Ollama Llama 3 (100% Local/Private)', provider: 'ollama' }
    ],

    // Local Ollama default URL
    OLLAMA_BASE_URL: 'http://localhost:11434',

    // Preferences
    DEFAULT_THEME: 'system',      // 'dark', 'light', 'system'
    DEFAULT_FONT_SIZE: 'medium',
    DEFAULT_STREAMING: true,
    FLOATING_BUBBLE_ENABLED: true,
    MAX_HISTORY: 20,

    VERSION: '2.0.0'
};

try {
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CONFIG;
    } else if (typeof exports !== 'undefined') {
        exports.CONFIG = CONFIG;
    } else if (typeof window !== 'undefined') {
        window.CONFIG = CONFIG;
    }
} catch (e) {
    console.debug('Config load notice:', e);
}
