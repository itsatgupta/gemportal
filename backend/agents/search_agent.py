from __future__ import annotations
import asyncio
import json
import logging
from dataclasses import dataclass, field

from tools.gem_scraper import BidResult, search_bids
from tools.pdf_downloader import download_pdf, extract_hyperlinks, download_supporting_docs
from tools.file_manager import get_bid_dir, get_supporting_docs_dir
from tools.tender_documents import DocumentManifest, save_manifest

logger = logging.getLogger("anamac.agents.search_agent")


@dataclass
class SearchAgent:
    """Agent 1 — Bid Discovery & Document Acquisition."""

    name: str = "search_agent"
    status: str = "idle"
    coordinator: object = None  # AgentCoordinator, set after init

    async def search(self, query: str) -> list[dict]:
        """Search GEM portal for OPEN bids matching the query."""
        self.status = "searching"
        await self._emit_status("searching", f"Searching GEM portal for open bids: {query}")

        results = await search_bids(query)

        self.status = "complete" if results else "idle"
        detail = f"Found {len(results)} open bids" if results else "No open bids found"
        await self._emit_status(self.status, detail)

        return [
            {
                "bid_number": r.bid_number,
                "title": r.title,
                "department": r.department,
                "start_date": r.start_date,
                "deadline": r.deadline,
                "value": r.value,
                "detail_url": r.detail_url,
                "items": r.items,
                "quantity": r.quantity,
            }
            for r in results
        ]

    async def download_bid(self, bid_number: str, detail_url: str) -> dict:
        """Download primary bid PDF and all linked supporting documents."""
        self.status = "downloading"
        await self._emit_status("downloading", f"Downloading bid document for {bid_number}")
        await self._emit_download_progress(bid_number, "primary", "downloading", 0, 1)

        bid_dir = get_bid_dir(bid_number)
        primary_pdf = bid_dir / "bid_document.pdf"
        manifest = DocumentManifest(bid_number=bid_number)
        primary_document = manifest.discover(
            stored_path="bid_document.pdf",
            original_filename="bid_document.pdf",
            source_url=detail_url or None,
            document_role="PRIMARY",
        )
        save_manifest(manifest, bid_dir)

        # Save bid metadata for proposal agent to read later
        # (value, quantity, items are needed for financial proposal)
        metadata_path = bid_dir / "bid_metadata.json"
        if not metadata_path.exists():
            metadata_path.write_text(json.dumps({
                "bid_number": bid_number,
                "detail_url": detail_url,
            }, indent=2), encoding="utf-8")

        # Step 1 — Download primary bid document
        # On GEM portal, the detail_url (e.g. /showbidDocument/XXXX) serves the PDF directly
        primary_ok = False
        if detail_url:
            primary_ok = await download_pdf(detail_url, primary_pdf)

        if not primary_ok:
            manifest.record_download(primary_document, bid_dir, False, "Primary PDF download failed")
            save_manifest(manifest, bid_dir)
            self.status = "error"
            await self._emit_status("error", "Failed to download primary bid document")
            await self._emit_download_progress(bid_number, "primary", "error", 0, 1)
            return {"success": False, "error": "Primary PDF download failed"}

        await self._emit_download_progress(bid_number, "primary", "complete", 1, 1)

        # Step 2 — Extract hyperlinks from PDF
        self.status = "extracting_links"
        await self._emit_status("extracting_links", "Extracting hyperlinks from bid document")

        links = extract_hyperlinks(primary_pdf)
        # Filter to likely document links
        doc_links = [l for l in links if any(ext in l.lower() for ext in [".pdf", ".doc", ".xls", ".zip", "download"])]

        # Step 3 — Download supporting documents one-by-one with progress
        supporting_results = []
        if doc_links:
            total = len(doc_links)
            await self._emit_status("downloading", f"Downloading {total} supporting documents")
            docs_dir = get_supporting_docs_dir(bid_number)

            for i, url in enumerate(doc_links):
                filename = url.split("/")[-1].split("?")[0]
                if not filename or len(filename) > 200:
                    filename = f"doc_{i}.pdf"
                if not filename.lower().endswith((".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".zip")):
                    filename += ".pdf"

                await self._emit_download_progress(bid_number, "supporting", "downloading", i, total, filename)

                dest_path = docs_dir / filename
                document = manifest.discover(
                    stored_path=str(dest_path.relative_to(bid_dir)),
                    original_filename=filename,
                    source_url=url,
                    document_role="SUPPORTING",
                )
                save_manifest(manifest, bid_dir)
                success = await download_pdf(url, dest_path)
                manifest.record_download(document, bid_dir, success, None if success else "Supporting document download failed")
                if success:
                    manifest.extract(document, bid_dir)
                save_manifest(manifest, bid_dir)
                supporting_results.append({"url": url, "filename": filename, "success": success})

                status = "complete" if success else "error"
                await self._emit_download_progress(bid_number, "supporting", status, i + 1, total, filename)

        # Primary extraction is recorded before downstream agents can read it.
        manifest.record_download(primary_document, bid_dir, True)
        manifest.extract(primary_document, bid_dir)
        save_manifest(manifest, bid_dir)

        # Step 4 — Complete, notify Agent 2
        self.status = "complete"
        await self._emit_status("complete", f"Bid {bid_number} downloaded with {len(supporting_results)} supporting docs")
        await self._emit_download_progress(bid_number, "all", "complete", 1, 1)

        if self.coordinator:
            await self.coordinator.send_message(
                from_agent=self.name,
                to_agent="bid_proposer_agent",
                message_type="bid_downloaded",
                bid_number=bid_number,
                payload={
                    "bid_dir": str(bid_dir),
                    "primary_pdf": str(primary_pdf),
                    "supporting_docs_count": len(supporting_results),
                },
            )

        # Step 5 — Scope analysis (runs in background, non-blocking for proposal flow)
        asyncio.create_task(self._analyze_scope(bid_number, bid_dir))

        return {
            "success": True,
            "bid_number": bid_number,
            "primary_pdf": str(primary_pdf),
            "supporting_docs": supporting_results,
            "links_found": len(links),
        }

    async def _analyze_scope(self, bid_number: str, bid_dir) -> None:
        """Analyze bid scope using Claude and generate Scope Intelligence Brief PDF."""
        from pathlib import Path
        bid_dir = Path(bid_dir)
        scope_pdf_path = bid_dir / "scope_summary.pdf"
        scope_json_path = bid_dir / "scope_summary.json"

        from tools.tender_documents import analysis_gate
        gate = analysis_gate(bid_number, bid_dir)
        if gate["blocked"]:
            await self._emit_scope_status(
                bid_number, "blocked", "; ".join(gate["readiness"]["reasons"])
            )
            return

        await self._emit_scope_status(bid_number, "analyzing", "Analyzing bid scope with AI...")

        try:
            from tools.scope_analyzer import analyze_bid_scope
            scope_data = analyze_bid_scope(bid_number, bid_dir)

            # Save raw JSON
            scope_json_path.write_text(
                json.dumps(scope_data, indent=2, ensure_ascii=False), encoding="utf-8"
            )

            # Generate PDF
            from tools.pdf_generator import generate_scope_summary_pdf
            from config import ROOT_DIR
            logo_path = ROOT_DIR / "frontend" / "public" / "anamaclogo.png"
            generate_scope_summary_pdf(
                output_path=scope_pdf_path,
                bid_number=bid_number,
                scope_data=scope_data,
                logo_path=logo_path if logo_path.exists() else None,
            )

            logger.info("Scope summary generated for %s: %s", bid_number, scope_pdf_path)
            await self._emit_scope_status(bid_number, "complete", "Scope Intelligence Brief ready")

            if self.coordinator:
                await self.coordinator._broadcast_ws({
                    "type": "scope_analysis",
                    "bid_number": bid_number,
                    "status": "complete",
                    "study_type": scope_data.get("study_type", ""),
                    "complexity": scope_data.get("complexity_rating", ""),
                    "has_price_estimate": bool(
                        scope_data.get("buyer_price_estimate", {}).get("amount_text")
                    ),
                    "pid_count": scope_data.get("hazop_details", {}).get("pid_count"),
                    "site_area_ha": scope_data.get("qra_details", {}).get("total_area_hectares"),
                    "pipeline_km": scope_data.get("qra_details", {}).get("pipeline_length_km"),
                })

        except Exception as exc:
            logger.error("Scope analysis failed for %s: %s", bid_number, exc)
            await self._emit_scope_status(bid_number, "error", f"Scope analysis failed: {exc}")
            if self.coordinator:
                await self.coordinator._broadcast_ws({
                    "type": "scope_analysis",
                    "bid_number": bid_number,
                    "status": "error",
                    "error": str(exc),
                })

    async def _emit_scope_status(self, bid_number: str, status: str, detail: str = ""):
        if self.coordinator:
            await self.coordinator._broadcast_ws({
                "type": "scope_analysis",
                "bid_number": bid_number,
                "status": status,
                "detail": detail,
            })

    async def _emit_status(self, status: str, detail: str = ""):
        if self.coordinator:
            await self.coordinator.broadcast_status(self.name, status, detail)

    async def _emit_download_progress(
        self, bid_number: str, phase: str, status: str,
        completed: int, total: int, current_file: str = "",
    ):
        if self.coordinator:
            await self.coordinator._broadcast_ws({
                "type": "download_progress",
                "bid_number": bid_number,
                "phase": phase,
                "status": status,
                "completed": completed,
                "total": total,
                "current_file": current_file,
            })
