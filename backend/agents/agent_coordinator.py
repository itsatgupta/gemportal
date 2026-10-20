from __future__ import annotations
import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Coroutine

from fastapi import WebSocket

logger = logging.getLogger("anamac.coordinator")


class AgentCoordinator:
    """Orchestrates communication between agents and broadcasts to frontend via WebSocket."""

    def __init__(self):
        self.agents: dict[str, Any] = {}
        self.message_log: list[dict] = []
        self.ws_clients: list[WebSocket] = []
        self._handlers: dict[str, list[Callable[..., Coroutine]]] = {}

    def register_agent(self, name: str, agent: Any):
        self.agents[name] = agent

    # --- WebSocket client management ---

    async def connect_ws(self, ws: WebSocket):
        await ws.accept()
        self.ws_clients.append(ws)
        logger.info("WebSocket client connected (total: %d)", len(self.ws_clients))

    def disconnect_ws(self, ws: WebSocket):
        if ws in self.ws_clients:
            self.ws_clients.remove(ws)
            logger.info("WebSocket client disconnected (total: %d)", len(self.ws_clients))

    # --- Message bus ---

    def subscribe(self, message_type: str, handler: Callable[..., Coroutine]):
        self._handlers.setdefault(message_type, []).append(handler)

    async def send_message(
        self,
        from_agent: str,
        to_agent: str,
        message_type: str,
        bid_number: str,
        payload: dict,
    ):
        message = {
            "from_agent": from_agent,
            "to_agent": to_agent,
            "message_type": message_type,
            "bid_number": bid_number,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        self.message_log.append(message)

        # Broadcast to all WebSocket clients
        await self._broadcast_ws(message)

        # Dispatch to registered handlers
        for handler in self._handlers.get(message_type, []):
            asyncio.create_task(handler(message))

    async def _broadcast_ws(self, message: dict):
        dead = []
        for ws in self.ws_clients:
            try:
                await ws.send_json(message)
            except Exception as e:
                logger.warning("Failed to send to WebSocket client: %s", e)
                dead.append(ws)
        for ws in dead:
            self.disconnect_ws(ws)

    async def broadcast_status(self, agent_name: str, status: str, detail: str = "", bid_number: str = ""):
        await self._broadcast_ws({
            "type": "agent_status",
            "agent": agent_name,
            "status": status,
            "detail": detail,
            "bid_number": bid_number,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })

    def get_messages(self, bid_number: str | None = None) -> list[dict]:
        if bid_number:
            return [m for m in self.message_log if m["bid_number"] == bid_number]
        return list(self.message_log)
