from __future__ import annotations
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone

from openai import AsyncOpenAI

from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from tools.file_manager import get_bid_dir
from tools.tender_documents import analysis_document_text, analysis_gate, analysis_readiness


def _is_ai_related_bid(bid_text: str) -> bool:
    """Detect AI/ML bids so the assessor can apply AI-specific checks."""
    keywords = (
        "artificial intelligence", "machine learning", "deep learning", "ai/ml",
        "large language model", "llm", "natural language processing", "nlp",
        "computer vision", "chatbot", "voice agent", "ai platform", "ai model",
        "ai solution", "agentic ai", "retrieval augmented", "vector database",
        "predictive analytics", "model deployment", "model training",
    )
    text = bid_text.lower()
    return sum(keyword in text for keyword in keywords) >= 2


@dataclass
class BidAssessorAgent:
    """Agent 3 — Proposal Quality Assessment & Gap Analysis."""

    name: str = "bid_assessor_agent"
    status: str = "idle"
    coordinator: object = None
    _gap_reports: dict = field(default_factory=dict)  # bid_number -> list of gaps
    _revision_counts: dict = field(default_factory=dict)  # bid_number -> int
    MAX_REVISIONS: int = 1  # Max revision rounds before forcing approval

    async def review_proposal(self, bid_number: str) -> dict:
        """Review proposal against bid requirements and generate gap report."""
        try:
            return await self._review_proposal_inner(bid_number)
        except Exception as e:
            self.status = "error"
            await self._emit_status("error", f"Review failed: {e}")
            return {"success": False, "error": str(e), "bid_number": bid_number}

    async def _review_proposal_inner(self, bid_number: str) -> dict:
        self.status = "reviewing"
        await self._emit_status("reviewing", "Reviewing proposal for " + bid_number)

        bid_dir = get_bid_dir(bid_number)
        gate = analysis_gate(bid_number, bid_dir)
        if gate["blocked"]:
            self.status = "readiness_blocked"
            await self._emit_status("readiness_blocked", "; ".join(gate["readiness"]["reasons"]))
            return {"success": False, **gate}
        manifest, _ = analysis_readiness(bid_number, bid_dir)

        # Read bid document
        bid_text, _ = analysis_document_text(manifest)

        # Read proposal
        proposal_text = ""
        proposal_path = bid_dir / "bid_proposal.txt"
        if proposal_path.exists():
            proposal_text = proposal_path.read_text(encoding="utf-8")

        if not proposal_text:
            self.status = "error"
            return {"success": False, "error": "No proposal found to review"}

        # Generate gap analysis via Claude
        gaps = await self._analyze_gaps(bid_number, bid_text, proposal_text)
        self._gap_reports[bid_number] = gaps

        if any(g["severity"] in ("Critical", "Major") for g in gaps):
            self.status = "gaps_found"
            await self._emit_status("gaps_found", "Found " + str(len(gaps)) + " gaps in proposal")

            # Send gap report to Agent 2
            if self.coordinator:
                self.status = "sent_to_agent2"
                await self.coordinator.send_message(
                    from_agent=self.name,
                    to_agent="bid_proposer_agent",
                    message_type="gap_report",
                    bid_number=bid_number,
                    payload={"gaps": gaps},
                )
        else:
            # No critical/major gaps — approve directly
            summary_verdict = await self._write_summary(bid_number, gaps, gaps, is_re_review=False)
            self.status = "approved" if summary_verdict == "APPROVED" else "analysis_incomplete"
            await self._emit_status(self.status, "Proposal for " + bid_number + " " + summary_verdict.lower())

        return {"success": True, "bid_number": bid_number, "gaps": gaps, "status": self.status, **gate}

    async def re_review_proposal(self, bid_number: str) -> dict:
        """Re-review revised proposal after Agent 2 addresses gaps."""
        try:
            return await self._re_review_proposal_inner(bid_number)
        except Exception as e:
            self.status = "error"
            await self._emit_status("error", f"Re-review failed: {e}")
            return {"success": False, "error": str(e), "bid_number": bid_number}

    async def _re_review_proposal_inner(self, bid_number: str) -> dict:
        self.status = "re_reviewing"
        revision_num = self._revision_counts.get(bid_number, 0) + 1
        self._revision_counts[bid_number] = revision_num
        await self._emit_status("re_reviewing", "Re-reviewing revised proposal for " + bid_number + " (round " + str(revision_num) + ")")

        bid_dir = get_bid_dir(bid_number)
        gate = analysis_gate(bid_number, bid_dir)
        if gate["blocked"]:
            self.status = "readiness_blocked"
            await self._emit_status("readiness_blocked", "; ".join(gate["readiness"]["reasons"]))
            return {"success": False, **gate}
        manifest, _ = analysis_readiness(bid_number, bid_dir)

        bid_text, _ = analysis_document_text(manifest)

        proposal_text = ""
        proposal_path = bid_dir / "bid_proposal.txt"
        if proposal_path.exists():
            proposal_text = proposal_path.read_text(encoding="utf-8")

        # Re-analyze
        new_gaps = await self._analyze_gaps(bid_number, bid_text, proposal_text)
        initial_gaps = self._gap_reports.get(bid_number, [])

        has_critical = any(g["severity"] in ("Critical", "Major") for g in new_gaps)
        max_reached = revision_num >= self.MAX_REVISIONS

        if has_critical and not max_reached:
            self.status = "sent_to_agent2"
            await self._emit_status("gaps_found", "Still " + str(len(new_gaps)) + " gaps remaining (round " + str(revision_num) + "/" + str(self.MAX_REVISIONS) + ")")

            if self.coordinator:
                await self.coordinator.send_message(
                    from_agent=self.name,
                    to_agent="bid_proposer_agent",
                    message_type="gap_report",
                    bid_number=bid_number,
                    payload={"gaps": new_gaps},
                )

            return {"success": True, "bid_number": bid_number, "gaps": new_gaps, "status": "gaps_remaining"}
        else:
            summary_verdict = await self._write_summary(bid_number, initial_gaps, new_gaps, is_re_review=True)

            if not has_critical and len(new_gaps) == 0:
                verdict = "APPROVED"
            else:
                verdict = "CONDITIONALLY APPROVED"
            if summary_verdict == "INCOMPLETE ANALYSIS":
                verdict = summary_verdict

            self.status = "approved" if verdict == "APPROVED" else "conditionally_approved"
            reason = "Proposal " + verdict
            if max_reached and has_critical:
                reason += " (max " + str(self.MAX_REVISIONS) + " revision rounds reached)"
            await self._emit_status(self.status, reason)

            if self.coordinator:
                await self.coordinator.send_message(
                    from_agent=self.name,
                    to_agent="all",
                    message_type="approval",
                    bid_number=bid_number,
                    payload={"verdict": verdict},
                )

            return {"success": True, "bid_number": bid_number, "verdict": verdict, "gaps": new_gaps}

    async def _analyze_gaps(self, bid_number: str, bid_text: str, proposal_text: str) -> list[dict]:
        client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

        ai_checks = ""
        if _is_ai_related_bid(bid_text):
            ai_checks = (
                "\n\nTHIS IS AN AI-RELATED BID. In addition to general bid compliance, explicitly verify:\n"
                "- AMD_AI_Profile.pdf is referenced for ANAMAC AI capabilities and relevant projects\n"
                "- Proposal includes qualified AI/ML team capabilities and relevant experience\n"
                "- Technical approach covers solution architecture, data flow, models, APIs, and integrations\n"
                "- Data privacy, security, responsible AI, explainability, bias mitigation, and human oversight\n"
                "- AI evaluation metrics, testing/validation, deployment, monitoring, and support\n"
                "- RAG/vector database/LLM approach where relevant to the bid scope\n"
                "- No unsupported team names, client claims, performance numbers, or project details are invented\n"
                "If any item is missing, create a specific gap with a severity appropriate to the bid requirement.\n"
            )

        prompt = (
            "You are a senior bid assessor reviewing a proposal against the original bid requirements.\n\n"
            "BID REQUIREMENTS:\n" + bid_text[:8000] + "\n\n"
            "PROPOSAL:\n" + proposal_text[:8000] + "\n\n"
            + ai_checks
            + "Analyze the proposal and identify ALL gaps, shortcomings, and compliance issues.\n"
            "For each gap, provide:\n"
            "- gap_id: sequential ID like GAP-001\n"
            '- severity: "Critical", "Major", or "Minor"\n'
            "- section: which section of the proposal has the issue\n"
            "- description: clear description of the gap\n"
            "- recommendation: how to fix it\n"
            '- status: "open"\n\n'
            "Return ONLY a JSON array of gap objects. If no gaps found, return an empty array [].\n"
            'Example: [{"gap_id": "GAP-001", "severity": "Major", "section": "Technical Approach", '
            '"description": "Missing methodology details", "recommendation": "Add detailed step-by-step '
            'methodology", "status": "open"}]'
        )

        response = await client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )

        text = (response.choices[0].message.content or "").strip()

        # Parse JSON from response
        try:
            start = text.index("[")
            end = text.rindex("]") + 1
            gaps = json.loads(text[start:end])
            return gaps
        except (ValueError, json.JSONDecodeError):
            return []

    async def _write_summary(
        self, bid_number: str, initial_gaps: list[dict], final_gaps: list[dict], is_re_review: bool
    ):
        bid_dir = get_bid_dir(bid_number)
        now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

        initial_lines = []
        for g in initial_gaps:
            initial_lines.append("- [" + g.get("severity", "") + "] " + g.get("section", "") + ": " + g.get("description", ""))
        initial_obs = "\n".join(initial_lines) if initial_lines else "- No significant gaps identified"

        resolution = ""
        if is_re_review:
            for g in initial_gaps:
                gid = g.get("gap_id", "")
                still_open = any(
                    fg.get("gap_id") == gid and fg.get("severity") in ("Critical", "Major")
                    for fg in final_gaps
                )
                status_text = "Open" if still_open else "Resolved"
                mark = "x" if still_open else "v"
                resolution += "- " + gid + ": " + status_text + " " + mark + "\n"
        else:
            resolution = "- Initial review - no re-review required\n"

        has_critical = any(g.get("severity") in ("Critical", "Major") for g in final_gaps)
        gate = analysis_gate(bid_number, bid_dir)
        verdict = "INCOMPLETE ANALYSIS" if gate["analysis_incomplete"] else ("CONDITIONALLY APPROVED" if has_critical else "APPROVED")

        if verdict == "INCOMPLETE ANALYSIS":
            comments = "Tender extraction is incomplete. This analysis is not fully complete, submission-ready, or approved."
        else:
            comments = "All critical and major gaps have been resolved." if verdict == "APPROVED" else "Some minor issues remain but do not block submission."

        summary = (
            "ANAMAC BID ASSESSMENT SUMMARY\n"
            "Bid Number: " + bid_number + "\n"
            "Assessment Date: " + now + "\n"
            "Assessor Agent: bid_assessor_agent v1.0\n\n"
            "INITIAL REVIEW OBSERVATIONS:\n"
            + initial_obs + "\n\n"
            "RESOLUTION REVIEW:\n"
            + resolution + "\n"
            "FINAL VERDICT: " + verdict + "\n"
            "SUMMARY COMMENTS: The proposal has been reviewed against the original bid requirements. "
            + comments + "\n"
        )

        summary_path = bid_dir / "assessor_summary.txt"
        summary_path.write_text(summary, encoding="utf-8")
        return verdict

    async def _emit_status(self, status: str, detail: str = ""):
        if self.coordinator:
            await self.coordinator.broadcast_status(self.name, status, detail)
