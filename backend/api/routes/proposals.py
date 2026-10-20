import logging
import re
from typing import Dict, List
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("anamac.routes.proposals")
router = APIRouter(prefix="/api/proposals", tags=["proposals"])
limiter = Limiter(key_func=get_remote_address)

proposer_agent = None

BID_NUMBER_PATTERN = re.compile(r"^[A-Za-z0-9/_\- ]{1,100}$")


def _validate_bid_number(value: str) -> str:
    if not BID_NUMBER_PATTERN.match(value) or ".." in value:
        raise ValueError("Invalid bid number format")
    return value


class ProposalRequest(BaseModel):
    bid_number: str

    @field_validator("bid_number")
    @classmethod
    def validate_bid_number(cls, v: str) -> str:
        return _validate_bid_number(v)


class ReviseRequest(BaseModel):
    bid_number: str
    gaps: List[Dict]

    @field_validator("bid_number")
    @classmethod
    def validate_bid_number(cls, v: str) -> str:
        return _validate_bid_number(v)


@router.post("/prepare")
@limiter.limit("10/minute")
async def prepare_proposal(req: ProposalRequest, request: Request, bg: BackgroundTasks):
    if not proposer_agent:
        raise HTTPException(status_code=503, detail="Proposer agent not initialized")
    from tools.file_manager import get_bid_dir
    from tools.tender_documents import analysis_gate
    gate = analysis_gate(req.bid_number, get_bid_dir(req.bid_number))
    if gate["blocked"]:
        return {"status": "blocked", **gate}
    logger.info("Preparing proposal for bid %s", req.bid_number)
    bg.add_task(proposer_agent.prepare_proposal, req.bid_number)
    return {"status": "drafting", **gate}


@router.post("/revise")
@limiter.limit("10/minute")
async def revise_proposal(req: ReviseRequest, request: Request, bg: BackgroundTasks):
    if not proposer_agent:
        raise HTTPException(status_code=503, detail="Proposer agent not initialized")
    from tools.file_manager import get_bid_dir
    from tools.tender_documents import analysis_gate
    gate = analysis_gate(req.bid_number, get_bid_dir(req.bid_number))
    if gate["blocked"]:
        return {"status": "blocked", **gate}
    logger.info("Revising proposal for bid %s with %d gaps", req.bid_number, len(req.gaps))
    bg.add_task(proposer_agent.revise_proposal, req.bid_number, req.gaps)
    return {"status": "revising", **gate}


@router.get("/{bid_number}")
async def get_proposal(bid_number: str):
    _validate_bid_number(bid_number)
    from tools.file_manager import get_bid_dir
    bid_dir = get_bid_dir(bid_number)
    proposal_txt = bid_dir / "bid_proposal.txt"
    proposal_pdf = bid_dir / "bid_proposal.pdf"
    result = {"bid_number": bid_number, "proposal": None, "has_pdf": False}
    if proposal_txt.exists():
        result["proposal"] = proposal_txt.read_text(encoding="utf-8")
    if proposal_pdf.exists():
        result["has_pdf"] = True
    return result


@router.get("/{bid_number}/pdf")
async def download_proposal_pdf(bid_number: str):
    _validate_bid_number(bid_number)
    from tools.file_manager import get_bid_dir
    pdf_path = get_bid_dir(bid_number) / "bid_proposal.pdf"
    if not pdf_path.exists():
        raise HTTPException(status_code=404, detail="Proposal PDF not found")
    return FileResponse(
        str(pdf_path),
        media_type="application/pdf",
        filename=f"ANAMAC_Proposal_{bid_number}.pdf",
    )
