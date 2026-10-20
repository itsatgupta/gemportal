from __future__ import annotations
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path

# Ensure backend directory is on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import ALLOWED_ORIGINS, DEEPSEEK_API_KEY, BIDS_BASE_DIR, BID_SUPPORTING_DOCS_DIR, LOG_LEVEL
from logging_config import setup_logging

# --- Logging ---
setup_logging(LOG_LEVEL)
logger = logging.getLogger("anamac.main")

# --- Rate limiter ---
limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])

# --- Agent setup (module-level so routes can reference them) ---
from agents.agent_coordinator import AgentCoordinator
from agents.search_agent import SearchAgent
from agents.bid_proposer_agent import BidProposerAgent
from agents.bid_assessor_agent import BidAssessorAgent

coordinator = AgentCoordinator()
search = SearchAgent()
proposer = BidProposerAgent()
assessor = BidAssessorAgent()

search.coordinator = coordinator
proposer.coordinator = coordinator
assessor.coordinator = coordinator

coordinator.register_agent("search_agent", search)
coordinator.register_agent("bid_proposer_agent", proposer)
coordinator.register_agent("bid_assessor_agent", assessor)


# --- Lifespan: startup / shutdown ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting ANAMAC Bid Intelligence Platform v1.1.0")

    if not DEEPSEEK_API_KEY:
        logger.warning("DEEPSEEK_API_KEY is not set — Agent 2 and Agent 3 will not work")

    BIDS_BASE_DIR.mkdir(parents=True, exist_ok=True)
    BID_SUPPORTING_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    logger.info("Bids directory: %s", BIDS_BASE_DIR)
    logger.info("Supporting docs directory: %s", BID_SUPPORTING_DOCS_DIR)
    logger.info("CORS allowed origins: %s", ALLOWED_ORIGINS)
    logger.info("Agents registered: %s", list(coordinator.agents.keys()))

    yield

    # Shutdown
    logger.info("Shutting down — closing WebSocket connections")
    for ws in list(coordinator.ws_clients):
        try:
            await ws.close(code=1001, reason="Server shutting down")
        except Exception:
            pass
    coordinator.ws_clients.clear()
    logger.info("Shutdown complete")


# --- App ---
app = FastAPI(
    title="ANAMAC Bid Intelligence Platform",
    version="1.1.0",
    lifespan=lifespan,
)

app.state.limiter = limiter


# --- Exception handlers ---
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": "Rate limit exceeded. Please slow down.", "detail": str(exc.detail)},
    )


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "Validation error", "detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s %s: %s", request.method, request.url.path, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},
    )


# --- Middleware ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/ws"):
        return await call_next(request)

    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    logger.info(
        "%s %s %d %.1fms",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# --- Wire up event handlers for agent-to-agent communication ---
async def on_proposal_ready(msg):
    """When Agent 2 finishes proposal, auto-trigger Agent 3 review."""
    bid_number = msg["bid_number"]
    logger.info("Event: proposal_ready for %s — triggering assessment", bid_number)
    await assessor.review_proposal(bid_number)


async def on_gap_report(msg):
    """When Agent 3 sends gaps, auto-trigger Agent 2 revision."""
    bid_number = msg["bid_number"]
    gaps = msg["payload"].get("gaps", [])
    logger.info("Event: gap_report for %s — %d gaps, triggering revision", bid_number, len(gaps))
    await proposer.revise_proposal(bid_number, gaps)


async def on_proposal_revised(msg):
    """When Agent 2 revises, auto-trigger Agent 3 re-review."""
    bid_number = msg["bid_number"]
    logger.info("Event: proposal_revised for %s — triggering re-review", bid_number)
    await assessor.re_review_proposal(bid_number)


coordinator.subscribe("proposal_ready", on_proposal_ready)
coordinator.subscribe("gap_report", on_gap_report)
coordinator.subscribe("proposal_revised", on_proposal_revised)

# --- Inject agents into route modules ---
from api.routes import bids, proposals, assessments, agents
from api import websocket

bids.search_agent = search
proposals.proposer_agent = proposer
assessments.assessor_agent = assessor
agents.coordinator = coordinator
websocket.coordinator = coordinator

# --- Register routers ---
app.include_router(bids.router)
app.include_router(proposals.router)
app.include_router(assessments.router)
app.include_router(agents.router)
app.include_router(websocket.router)


@app.get("/")
async def root():
    return {
        "name": "ANAMAC Bid Intelligence Platform",
        "version": "1.1.0",
        "agents": list(coordinator.agents.keys()),
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "agents": {name: getattr(agent, "status", "unknown") for name, agent in coordinator.agents.items()},
        "ws_clients": len(coordinator.ws_clients),
    }
