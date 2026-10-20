import io
import logging
import re
import zipfile
from typing import List
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("anamac.routes.bids")
router = APIRouter(prefix="/api/bids", tags=["bids"])
limiter = Limiter(key_func=get_remote_address)

# These will be set by main.py after agent initialization
search_agent = None

# --- Validation ---
BID_NUMBER_PATTERN = re.compile(r"^[A-Za-z0-9/_\- ]{1,100}$")


def _validate_bid_number(value: str) -> str:
    if not BID_NUMBER_PATTERN.match(value):
        raise ValueError("Invalid bid number format")
    if ".." in value:
        raise ValueError("Invalid bid number")
    return value


class SearchRequest(BaseModel):
    query: str
    max_results: int = 20

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v: str) -> str:
        v = v.strip()
        if not v or len(v) > 500:
            raise ValueError("Query must be 1-500 characters")
        return v

    @field_validator("max_results")
    @classmethod
    def max_results_range(cls, v: int) -> int:
        if v < 1 or v > 100:
            raise ValueError("max_results must be 1-100")
        return v


class DownloadRequest(BaseModel):
    bid_number: str
    detail_url: str
    value: str = ""
    quantity: str = ""
    items: str = ""
    title: str = ""
    department: str = ""
    deadline: str = ""

    @field_validator("bid_number")
    @classmethod
    def validate_bid_number(cls, v: str) -> str:
        return _validate_bid_number(v)


@router.post("/search")
@limiter.limit("30/minute")
async def search_bids(req: SearchRequest, request: Request):
    if not search_agent:
        raise HTTPException(status_code=503, detail="Search agent not initialized")
    logger.info("Searching bids: query=%s", req.query)
    results = await search_agent.search(req.query)
    return {"bids": results, "count": len(results)}


@router.post("/download")
@limiter.limit("10/minute")
async def download_bid(req: DownloadRequest, request: Request, bg: BackgroundTasks):
    if not search_agent:
        raise HTTPException(status_code=503, detail="Search agent not initialized")

    # Save bid metadata so proposer agent can use it for financial proposal
    import json
    from config import BIDS_BASE_DIR
    safe_name = req.bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    bid_dir.mkdir(parents=True, exist_ok=True)
    metadata = {
        "bid_number": req.bid_number,
        "detail_url": req.detail_url,
        "value": req.value,
        "quantity": req.quantity,
        "items": req.items,
        "title": req.title,
        "department": req.department,
        "deadline": req.deadline,
    }
    (bid_dir / "bid_metadata.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    logger.info("Starting download for bid %s", req.bid_number)
    bg.add_task(search_agent.download_bid, req.bid_number, req.detail_url)
    return {"status": "downloading", "bid_number": req.bid_number}


@router.get("/list")
async def list_bids():
    from tools.file_manager import list_all_bids, list_bid_files
    bids = list_all_bids()
    return {"bids": [{"bid_number": b, "files": list_bid_files(b)} for b in bids]}


@router.get("/history")
async def get_bid_history():
    """Return enriched bid history — metadata, status, verdict, file availability, timestamps."""
    import json
    import os
    from config import BIDS_BASE_DIR
    from tools.file_manager import list_all_bids

    history = []
    for bid_dir_name in list_all_bids():
        safe_name = bid_dir_name.replace("/", "_").replace(" ", "_")
        bid_dir = BIDS_BASE_DIR / safe_name

        # Read metadata
        metadata = {}
        metadata_path = bid_dir / "bid_metadata.json"
        if metadata_path.exists():
            try:
                metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Check file presence
        has_document = (bid_dir / "bid_document.pdf").exists()
        has_proposal = (bid_dir / "bid_proposal.pdf").exists() or (bid_dir / "bid_proposal.txt").exists()
        has_summary = (bid_dir / "assessor_summary.txt").exists()

        # Parse verdict from assessor_summary.txt
        verdict = None
        if has_summary:
            try:
                summary_text = (bid_dir / "assessor_summary.txt").read_text(encoding="utf-8")
                for line in summary_text.splitlines():
                    if "FINAL VERDICT" in line.upper():
                        if "CONDITIONALLY APPROVED" in line.upper():
                            verdict = "CONDITIONALLY APPROVED"
                        elif "APPROVED" in line.upper():
                            verdict = "APPROVED"
                        break
            except Exception:
                pass

        # Count supporting docs
        supporting_dir = bid_dir / "supporting_docs"
        supporting_count = len(list(supporting_dir.glob("*"))) if supporting_dir.exists() else 0

        # Determine overall status
        if has_summary and verdict:
            status = "completed"
        elif has_proposal:
            status = "assessment_pending"
        elif has_document:
            status = "downloaded"
        else:
            status = "partial"

        # Get folder modified time as processed_at
        try:
            mtime = bid_dir.stat().st_mtime
            processed_at = mtime
        except Exception:
            processed_at = None

        history.append({
            "bid_number": metadata.get("bid_number", bid_dir_name),
            "title": metadata.get("title") or metadata.get("items", ""),
            "department": metadata.get("department", ""),
            "deadline": metadata.get("deadline", ""),
            "value": metadata.get("value", ""),
            "status": status,
            "verdict": verdict,
            "has_document": has_document,
            "has_proposal": has_proposal,
            "has_summary": has_summary,
            "supporting_docs_count": supporting_count,
            "processed_at": processed_at,
            # GEM portal live status (cached from last check)
            "gem_status": metadata.get("gem_status"),
            "awarded_to": metadata.get("awarded_to"),
            "awarded_value": metadata.get("awarded_value"),
            "gem_status_checked_at": metadata.get("gem_status_checked_at"),
        })

    # Sort newest first
    history.sort(key=lambda x: x["processed_at"] or 0, reverse=True)
    return {"bids": history, "count": len(history)}


@router.get("/{bid_number}/files")
async def get_bid_files(bid_number: str):
    _validate_bid_number(bid_number)
    from tools.file_manager import list_bid_files
    return list_bid_files(bid_number)


@router.get("/{bid_number}/document-manifest")
async def get_document_manifest(bid_number: str):
    """Return persisted document inventory and page-level extraction provenance."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    from tools.tender_documents import load_or_build_manifest

    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    if not bid_dir.exists():
        raise HTTPException(status_code=404, detail="Bid not found")
    return load_or_build_manifest(bid_number, bid_dir).to_dict()


@router.get("/{bid_number}/readiness")
async def get_tender_readiness(bid_number: str):
    """Return deterministic processing readiness without changing proposal workflow."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    from tools.tender_documents import load_or_build_manifest

    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    if not bid_dir.exists():
        raise HTTPException(status_code=404, detail="Bid not found")
    manifest = load_or_build_manifest(bid_number, bid_dir)
    return {"bid_number": bid_number, "readiness": manifest.readiness(), "counts": manifest.counts()}


@router.get("/{bid_number}/tree")
async def get_bid_tree(bid_number: str):
    """Return folder tree with file names and sizes (read-only, no dir creation)."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    if not bid_dir.exists():
        return {"tree": [], "total_size": 0}

    def _format_size(size_bytes: int) -> str:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        else:
            return f"{size_bytes / (1024 * 1024):.1f} MB"

    tree = []
    total_size = 0
    for fpath in sorted(bid_dir.rglob("*")):
        if fpath.is_file():
            size = fpath.stat().st_size
            total_size += size
            tree.append({
                "name": fpath.name,
                "path": str(fpath.relative_to(bid_dir)),
                "size": size,
                "size_display": _format_size(size),
                "type": fpath.suffix.lstrip(".").upper() or "FILE",
            })
    return {"tree": tree, "total_size": total_size, "total_display": _format_size(total_size)}


@router.post("/{bid_number}/check-gem-status")
@limiter.limit("10/minute")
async def check_gem_status(bid_number: str, request: Request):
    """Scrape the GEM portal for live bid status and award info, then cache in metadata."""
    _validate_bid_number(bid_number)
    import json
    from config import BIDS_BASE_DIR
    from tools.gem_scraper import check_bid_status_on_portal

    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    if not bid_dir.exists():
        raise HTTPException(status_code=404, detail="Bid not found")

    metadata_path = bid_dir / "bid_metadata.json"
    metadata = {}
    if metadata_path.exists():
        try:
            metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    actual_bid_number = metadata.get("bid_number", bid_number.replace("_", "/"))
    gem_info = await check_bid_status_on_portal(actual_bid_number)

    # Cache result in metadata
    metadata["gem_status"] = gem_info.get("gem_status")
    metadata["awarded_to"] = gem_info.get("awarded_to")
    metadata["awarded_value"] = gem_info.get("awarded_value")
    metadata["gem_status_checked_at"] = gem_info.get("checked_at")
    metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    logger.info("GEM status checked for %s: %s", bid_number, gem_info.get("gem_status"))
    return gem_info


@router.get("/{bid_number}/scope-summary")
async def get_scope_summary(bid_number: str):
    """Serve the Scope Intelligence Brief PDF."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    pdf_path = BIDS_BASE_DIR / safe_name / "scope_summary.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Scope summary not yet generated")
    return FileResponse(str(pdf_path), media_type="application/pdf",
                        headers={"Content-Disposition": f'inline; filename="scope_summary_{safe_name}.pdf"'})


@router.get("/{bid_number}/scope-data")
async def get_scope_data(bid_number: str):
    """Return raw scope analysis JSON."""
    _validate_bid_number(bid_number)
    import json
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    json_path = BIDS_BASE_DIR / safe_name / "scope_summary.json"
    if not json_path.exists():
        raise HTTPException(status_code=404, detail="Scope analysis not yet available")
    try:
        data = json.loads(json_path.read_text(encoding="utf-8"))
        return {"bid_number": bid_number, "scope": data}
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to read scope data")


@router.get("/{bid_number}/proposal")
async def get_bid_proposal(bid_number: str):
    """Serve the generated proposal PDF for in-browser viewing."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    pdf_path = BIDS_BASE_DIR / safe_name / "bid_proposal.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Proposal not found")
    return FileResponse(str(pdf_path), media_type="application/pdf")


@router.get("/{bid_number}/document")
async def get_bid_document(bid_number: str):
    """Serve the primary bid PDF for in-browser viewing."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    pdf_path = BIDS_BASE_DIR / safe_name / "bid_document.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Bid document not found")
    return FileResponse(str(pdf_path), media_type="application/pdf")


@router.get("/{bid_number}/package")
async def download_full_package(bid_number: str):
    """Create a ZIP containing all bid files."""
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    bid_dir = BIDS_BASE_DIR / safe_name
    if not bid_dir.exists():
        raise HTTPException(status_code=404, detail="Bid directory not found")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for fpath in sorted(bid_dir.rglob("*")):
            if fpath.is_file():
                arcname = str(fpath.relative_to(bid_dir))
                zf.write(fpath, arcname)

    buf.seek(0)
    filename = f"{bid_number}_full_package.zip"
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
