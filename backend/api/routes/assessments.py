import logging
import re
from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel, field_validator
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger("anamac.routes.assessments")
router = APIRouter(prefix="/api/assessments", tags=["assessments"])
limiter = Limiter(key_func=get_remote_address)

assessor_agent = None

BID_NUMBER_PATTERN = re.compile(r"^[A-Za-z0-9/_\- ]{1,100}$")


def _validate_bid_number(value: str) -> str:
    if not BID_NUMBER_PATTERN.match(value) or ".." in value:
        raise ValueError("Invalid bid number format")
    return value


class ReviewRequest(BaseModel):
    bid_number: str

    @field_validator("bid_number")
    @classmethod
    def validate_bid_number(cls, v: str) -> str:
        return _validate_bid_number(v)


@router.post("/review")
@limiter.limit("10/minute")
async def review_proposal(req: ReviewRequest, request: Request, bg: BackgroundTasks):
    if not assessor_agent:
        raise HTTPException(status_code=503, detail="Assessor agent not initialized")
    from tools.file_manager import get_bid_dir
    from tools.tender_documents import analysis_gate
    gate = analysis_gate(req.bid_number, get_bid_dir(req.bid_number))
    if gate["blocked"]:
        return {"status": "blocked", **gate}
    logger.info("Starting review for bid %s", req.bid_number)
    bg.add_task(assessor_agent.review_proposal, req.bid_number)
    return {"status": "reviewing", **gate}


@router.post("/re-review")
@limiter.limit("10/minute")
async def re_review_proposal(req: ReviewRequest, request: Request, bg: BackgroundTasks):
    if not assessor_agent:
        raise HTTPException(status_code=503, detail="Assessor agent not initialized")
    from tools.file_manager import get_bid_dir
    from tools.tender_documents import analysis_gate
    gate = analysis_gate(req.bid_number, get_bid_dir(req.bid_number))
    if gate["blocked"]:
        return {"status": "blocked", **gate}
    logger.info("Starting re-review for bid %s", req.bid_number)
    bg.add_task(assessor_agent.re_review_proposal, req.bid_number)
    return {"status": "re_reviewing", **gate}


@router.get("/{bid_number}/summary")
async def get_summary(bid_number: str):
    _validate_bid_number(bid_number)
    from config import BIDS_BASE_DIR
    safe_name = bid_number.replace("/", "_").replace(" ", "_")
    summary_path = BIDS_BASE_DIR / safe_name / "assessor_summary.txt"
    if summary_path.exists():
        return {"bid_number": bid_number, "summary": summary_path.read_text(encoding="utf-8")}
    return {"bid_number": bid_number, "summary": None}


@router.get("/{bid_number}/gaps")
async def get_gaps(bid_number: str):
    _validate_bid_number(bid_number)
    if not assessor_agent:
        raise HTTPException(status_code=503, detail="Assessor agent not initialized")
    gaps = assessor_agent._gap_reports.get(bid_number, [])
    return {"bid_number": bid_number, "gaps": gaps}
