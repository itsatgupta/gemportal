from __future__ import annotations
import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root
ROOT_DIR = Path(__file__).resolve().parent.parent
load_dotenv(ROOT_DIR / ".env")

# API Keys
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")  # legacy — no longer used by agents

# URLs
GEM_PORTAL_URL = os.getenv("GEM_PORTAL_URL", "https://bidplus.gem.gov.in/all-bids")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# CORS — configurable origins; comma-separated in env
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if o.strip()
] or [FRONTEND_URL, "http://localhost:5173", "http://localhost:3000"]

# Directories — resolve relative paths against project root
def _resolve_dir(env_key: str, default_name: str) -> Path:
    val = os.getenv(env_key, "")
    if val:
        p = Path(val)
        return p if p.is_absolute() else ROOT_DIR / p
    return ROOT_DIR / default_name

BIDS_BASE_DIR = _resolve_dir("BIDS_BASE_DIR", "bids")
BID_SUPPORTING_DOCS_DIR = _resolve_dir("BID_SUPPORTING_DOCS_DIR", "bidsupportingdocs")

# Download settings
MAX_DOWNLOAD_RETRIES = int(os.getenv("MAX_DOWNLOAD_RETRIES", "3"))
DOWNLOAD_TIMEOUT_SECONDS = int(os.getenv("DOWNLOAD_TIMEOUT_SECONDS", "60"))

# Logging
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")

# LLM Provider — DeepSeek (OpenAI-compatible API)
# Models: deepseek-chat (V3, default) or deepseek-reasoner (R1)
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")

# Legacy Anthropic config — kept for reference; agents now use DeepSeek
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-5")
