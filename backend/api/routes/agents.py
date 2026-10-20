import logging
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger("anamac.routes.agents")
router = APIRouter(prefix="/api/agents", tags=["agents"])

coordinator = None

BID_NUMBER_PATTERN = re.compile(r"^[A-Za-z0-9/_\- ]{1,100}$")


@router.get("/status")
async def get_agent_statuses():
    if not coordinator:
        raise HTTPException(status_code=503, detail="Coordinator not initialized")
    statuses = {}
    for name, agent in coordinator.agents.items():
        statuses[name] = {"name": name, "status": getattr(agent, "status", "unknown")}
    return {"agents": statuses}


@router.get("/messages")
async def get_messages(bid_number: Optional[str] = None):
    if not coordinator:
        raise HTTPException(status_code=503, detail="Coordinator not initialized")
    if bid_number and (not BID_NUMBER_PATTERN.match(bid_number) or ".." in bid_number):
        raise HTTPException(status_code=422, detail="Invalid bid number format")
    return {"messages": coordinator.get_messages(bid_number)}
