# ANAMAC Bid Proposal Intelligence Platform

Multi-agent AI system that automates the government bid lifecycle on India's [GEM Portal](https://bidplus.gem.gov.in/all-bids) — from discovery to proposal generation, assessment, and approval.

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  React + Vite Frontend (port 5173)                            │
│  Tabs: Search → Propose → Assess → Summary                   │
│  WebSocket for real-time agent status updates                 │
└───────────────────────┬───────────────────────────────────────┘
                        │ HTTP + WebSocket
┌───────────────────────▼───────────────────────────────────────┐
│  FastAPI Backend (port 8000)                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ Agent 1      │  │ Agent 2      │  │ Agent 3      │        │
│  │ Search &     │→ │ Proposal     │→ │ Assessment   │        │
│  │ Download     │  │ Generation   │  │ & Gap Review │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
│        ↓ Playwright       ↓ Claude API      ↓ Claude API     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ GEM Portal   │  │ Company Docs │  │ Gap Reports  │        │
│  │ Scraping     │  │ + PDF Gen    │  │ + Summaries  │        │
│  └──────────────┘  └──────────────┘  └──────────────┘        │
└───────────────────────────────────────────────────────────────┘
```

## Agent Workflow

1. **Agent 1 (Search)** — Scrapes GEM portal for open bids, downloads bid PDFs and all linked documents
2. **Agent 2 (Proposer)** — Reads bid requirements + company docs, generates proposal via Claude AI
3. **Agent 3 (Assessor)** — Reviews proposal against bid requirements, identifies gaps, sends back for revision
4. Agents 2 & 3 loop automatically (max 2 rounds) until proposal is approved

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Zustand, Framer Motion |
| Backend | FastAPI, Python 3.9+ |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Scraping | Playwright (headless Chromium) |
| PDF | pdfplumber, PyPDF2, reportlab |
| Rate Limiting | slowapi |

## Quick Start

### Prerequisites

- Node.js >= 18
- Python >= 3.9
- An [Anthropic API key](https://console.anthropic.com/)

### Setup

```bash
# Clone and configure
cp .env.example .env
# Edit .env — add your ANTHROPIC_API_KEY

# Backend
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
playwright install chromium

# Frontend
cd ../frontend
npm install

# Create required directories
mkdir -p bids bidsupportingdocs
# Add your company documents (PDFs) to bidsupportingdocs/
```

### Run

```bash
# Terminal 1 — Backend
cd backend && source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Or use the convenience script:

```bash
./start.sh
```

Open http://localhost:5173

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ANTHROPIC_API_KEY` | Claude API key (required) | — |
| `GEM_PORTAL_URL` | GEM portal bid listing URL | `https://bidplus.gem.gov.in/all-bids` |
| `BIDS_BASE_DIR` | Downloaded bids directory | `./bids` |
| `BID_SUPPORTING_DOCS_DIR` | Company documents directory | `./bidsupportingdocs` |
| `FRONTEND_URL` | Frontend dev server URL | `http://localhost:5173` |
| `BACKEND_URL` | Backend API URL | `http://localhost:8000` |
| `ALLOWED_ORIGINS` | CORS origins (comma-separated) | Frontend URL + localhost |
| `LOG_LEVEL` | Logging level (DEBUG/INFO/WARNING/ERROR) | `INFO` |
| `LOG_FORMAT` | `console` or `json` | `console` |
| `MAX_DOWNLOAD_RETRIES` | PDF download retry attempts | `3` |
| `DOWNLOAD_TIMEOUT_SECONDS` | Download timeout per file | `60` |

## Testing

```bash
cd backend
source venv/bin/activate

# Run the full test suite (22 tests)
python -m pytest qa/test_suite.py -v

# Run the QA agent integration tests
python qa/qa_agent.py --run-suite
```

## Project Structure

```
├── backend/
│   ├── main.py                  # FastAPI app, middleware, lifespan
│   ├── config.py                # Environment config
│   ├── logging_config.py        # Structured logging setup
│   ├── agents/                  # AI agents
│   │   ├── search_agent.py      # Agent 1 — bid discovery
│   │   ├── bid_proposer_agent.py # Agent 2 — proposal generation
│   │   ├── bid_assessor_agent.py # Agent 3 — gap analysis
│   │   └── agent_coordinator.py # Message bus + WebSocket broadcast
│   ├── tools/                   # Shared utilities
│   │   ├── gem_scraper.py       # Playwright GEM portal scraper
│   │   ├── pdf_downloader.py    # HTTP download + link extraction
│   │   ├── document_parser.py   # PDF text extraction
│   │   ├── file_manager.py      # Bid directory management
│   │   └── pdf_generator.py     # reportlab proposal PDF
│   ├── api/routes/              # REST endpoints
│   └── qa/                      # Test suites
├── frontend/
│   └── src/
│       ├── components/tabs/     # Search, Proposal, Assessment, Summary
│       ├── components/agents/   # AgentCard, ChatThread, Timeline
│       ├── components/shared/   # ApprovalSeal, FolderTree, Toast, etc.
│       ├── store/bidStore.js    # Zustand state management
│       └── hooks/               # WebSocket + store hooks
├── bids/                        # Downloaded bid documents (auto-created)
└── bidsupportingdocs/           # Company supporting documents
```
