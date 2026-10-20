from __future__ import annotations
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("anamac.websocket")
router = APIRouter()

coordinator = None


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    if not coordinator:
        await ws.close(code=1011, reason="Coordinator not initialized")
        return

    await coordinator.connect_ws(ws)
    client = ws.client
    logger.info("WebSocket connected: %s", client)
    try:
        while True:
            data = await ws.receive_text()
            await ws.send_json({"type": "ack", "data": data})
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", client)
        coordinator.disconnect_ws(ws)
    except Exception as e:
        logger.warning("WebSocket error for %s: %s", client, e)
        coordinator.disconnect_ws(ws)
