from __future__ import annotations
from pathlib import Path

from config import BIDS_BASE_DIR, BID_SUPPORTING_DOCS_DIR


def get_bid_dir(bid_number: str) -> Path:
    """Get or create the directory for a specific bid."""
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    bid_dir.mkdir(parents=True, exist_ok=True)
    return bid_dir


def get_supporting_docs_dir(bid_number: str) -> Path:
    """Get or create the supporting docs subdirectory for a bid."""
    bid_dir = get_bid_dir(bid_number)
    docs_dir = bid_dir / "supporting_docs"
    docs_dir.mkdir(parents=True, exist_ok=True)
    return docs_dir


def get_company_docs_dir() -> Path:
    """Return the company's pre-existing documents directory."""
    BID_SUPPORTING_DOCS_DIR.mkdir(parents=True, exist_ok=True)
    return BID_SUPPORTING_DOCS_DIR


def list_bid_files(bid_number: str) -> dict:
    """List all files for a given bid."""
    bid_dir = get_bid_dir(bid_number)
    files = {
        "bid_document": None,
        "supporting_docs": [],
        "bid_proposal": None,
        "assessor_summary": None,
    }

    bid_doc = bid_dir / "bid_document.pdf"
    if bid_doc.exists():
        files["bid_document"] = str(bid_doc)

    proposal = bid_dir / "bid_proposal.pdf"
    if proposal.exists():
        files["bid_proposal"] = str(proposal)

    summary = bid_dir / "assessor_summary.txt"
    if summary.exists():
        files["assessor_summary"] = str(summary)

    docs_dir = bid_dir / "supporting_docs"
    if docs_dir.exists():
        files["supporting_docs"] = [str(f) for f in sorted(docs_dir.iterdir()) if f.is_file()]

    return files


def list_all_bids() -> list[str]:
    """List all bid directories."""
    if not BIDS_BASE_DIR.exists():
        return []
    return [d.name for d in sorted(BIDS_BASE_DIR.iterdir()) if d.is_dir()]


def list_company_docs() -> list[str]:
    """List all company supporting documents recursively."""
    docs_dir = get_company_docs_dir()
    return [str(f.relative_to(docs_dir)) for f in sorted(docs_dir.rglob("*")) if f.is_file()]
