from __future__ import annotations
import json
import logging
from dataclasses import dataclass
from pathlib import Path

from openai import AsyncOpenAI

from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, ROOT_DIR

logger = logging.getLogger("anamac.agent.proposer")
from tools.document_parser import extract_text_from_directory, extract_bid_requirements
from tools.file_manager import get_bid_dir, get_company_docs_dir, list_company_docs
from tools.pdf_generator import generate_proposal_pdf
from tools.tender_documents import analysis_document_text, analysis_gate, analysis_readiness


# ── Document Reference Mapping ──────────────────────────────────────────────
# Maps bid requirement keywords to ANAMAC company supporting documents.
# When the bid asks for these, the proposal should reference the file and
# mention "PDF document attached".
DOCUMENT_MAP = {
    # Safety & QRA/HAZOP work
    "work experience": "QRA_hazop_ProjectCompleted.pdf",
    "past project": "QRA_hazop_ProjectCompleted.pdf",
    "project completed": "QRA_hazop_ProjectCompleted.pdf",
    "completed project": "QRA_hazop_ProjectCompleted.pdf",
    "previous work": "QRA_hazop_ProjectCompleted.pdf",
    "similar work": "QRA_hazop_ProjectCompleted.pdf",
    "work order": "workorder2025V1.pdf",
    "work done": "workorder2025V1.pdf",
    "methodology": "QRA_HAZOP_Methodology.pdf",
    "qra methodology": "QRA_HAZOP_Methodology.pdf",
    "hazop methodology": "QRA_HAZOP_Methodology.pdf",
    "approach": "QRA_HAZOP_Methodology.pdf",
    "technical approach": "QRA_HAZOP_Methodology.pdf",

    # Team & Personnel
    "team experience": "coreteamprofile_experience.pdf",
    "team portfolio": "coreteamprofile_experience.pdf",
    "team composition": "coreteamprofile_experience.pdf",
    "key personnel": "coreteamprofile_experience.pdf",
    "core team": "coreteamprofile_experience.pdf",
    "cv": "coreteamprofile_experience.pdf",
    "resume": "coreteamprofile_experience.pdf",

    # AI-specific capabilities
    "artificial intelligence": "AMD_AI_Profile.pdf",
    "ai/ml": "AMD_AI_Profile.pdf",
    "ai solution": "AMD_AI_Profile.pdf",
    "ai-based": "AMD_AI_Profile.pdf",
    "ai enabled": "AMD_AI_Profile.pdf",
    "machine learning": "AMD_AI_Profile.pdf",
    "ml": "AMD_AI_Profile.pdf",
    "deep learning": "AMD_AI_Profile.pdf",
    "ai team": "AMD_AI_Profile.pdf",
    "ai consultant": "AMD_AI_Profile.pdf",
    "ai project": "AMD_AI_Profile.pdf",
    "ai solution": "AMD_AI_Profile.pdf",
    "ai automation": "AMD_AI_Profile.pdf",
    "agentic ai": "AMD_AI_Profile.pdf",
    "llm": "AMD_AI_Profile.pdf",
    "large language model": "AMD_AI_Profile.pdf",
    "gpt": "AMD_AI_Profile.pdf",
    "nlp": "AMD_AI_Profile.pdf",
    "natural language processing": "AMD_AI_Profile.pdf",
    "chatbot": "AMD_AI_Profile.pdf",
    "ai chatbot": "AMD_AI_Profile.pdf",
    "voice agent": "AMD_AI_Profile.pdf",
    "ai voice": "AMD_AI_Profile.pdf",
    "recruitment automation": "AMD_AI_Profile.pdf",
    "hr automation": "AMD_AI_Profile.pdf",
    "smart hr": "AMD_AI_Profile.pdf",
    "ai recruitment": "AMD_AI_Profile.pdf",
    "resume parsing": "AMD_AI_Profile.pdf",
    "ai router": "AMD_AI_Profile.pdf",
    "neural network": "AMD_AI_Profile.pdf",
    "ai development": "AMD_AI_Profile.pdf",
    "ai implementation": "AMD_AI_Profile.pdf",
    "rag": "AMD_AI_Profile.pdf",
    "retrieval augmented": "AMD_AI_Profile.pdf",
    "langchain": "AMD_AI_Profile.pdf",
    "ai agent": "AMD_AI_Profile.pdf",
    "multi-agent": "AMD_AI_Profile.pdf",
    "ai workflow": "AMD_AI_Profile.pdf",

    # Financial
    "balance sheet": "balancesheetlast3years.pdf",
    "financial statement": "balancesheetlast3years.pdf",
    "financial capability": "balancesheetlast3years.pdf",
    "annual turnover": "CACertificate_RXILTurnover.pdf",
    "turnover": "CACertificate_RXILTurnover.pdf",
    "ca certificate": "CACertificate_RXILTurnover.pdf",

    # Certifications
    "gst": "certificates_24v1.pdf",
    "gstin": "certificates_24v1.pdf",
    "msme": "certificates_24v1.pdf",
    "startup": "certificates_24v1.pdf",
    "udyam": "certificates_24v1.pdf",
    "certificate": "certificates_24v1.pdf",
    "iso": "certificates_24v1.pdf",
    "lead auditor": "certificates_24v1.pdf",
    "accreditation": "certificates_24v1.pdf",
    "registration": "certificates_24v1.pdf",

    # Other documents
    "covering letter": "CoveringLetter_OIL.pdf",
    "cover letter": "CoveringLetter_OIL.pdf",
    "software license": "OpenPHA_userLicense.pdf",
    "openpha": "OpenPHA_userLicense.pdf",
    "pha software": "OpenPHA_userLicense.pdf",
    "tool license": "OpenPHA_userLicense.pdf",
    "letter of assurity": "letterOf Assurity.pdf",
    "undertaking": "letterOf Assurity.pdf",
}


def _is_ai_related_bid(bid_text: str) -> bool:
    """Detect if a bid is AI/ML related based on keywords in the bid text."""
    ai_keywords = [
        "artificial intelligence", "machine learning", "deep learning",
        "ai solution", "ai development", "ai implementation",
        "neural network", "nlp", "natural language processing",
        "large language model", "llm", "gpt", "chatbot",
        "ai automation", "ai agent", "multi-agent", "agentic",
        "computer vision", "speech recognition", "voice assistant",
        "predictive analytics", "recommendation system",
        "ai/ml", "ml/ai", "ai platform", "ai framework",
        "tensorflow", "pytorch", "keras", "langchain",
        "rag", "retrieval augmented", "vector database",
        "ai model", "model training", "model deployment"
    ]

    bid_lower = bid_text.lower()
    # Count how many AI keywords appear
    ai_count = sum(1 for keyword in ai_keywords if keyword in bid_lower)

    # If 2+ AI keywords found, it's likely an AI bid
    return ai_count >= 2


def _build_document_references(bid_text: str) -> str:
    """Scan bid text for keywords and build a document reference section."""
    bid_lower = bid_text.lower()
    matched = {}
    for keyword, filename in DOCUMENT_MAP.items():
        if keyword in bid_lower and filename not in matched.values():
            matched[keyword] = filename

    if not matched:
        return ""

    lines = ["ANAMAC SUPPORTING DOCUMENTS AVAILABLE (to be attached with proposal):"]
    seen_files = set()
    for keyword, filename in matched.items():
        if filename not in seen_files:
            lines.append(f"  - {filename} — (PDF document attached)")
            seen_files.add(filename)
    return "\n".join(lines)


def _build_financial_proposal(bid_metadata: dict, bid_text: str) -> str:
    """Financial pricing is submitted manually on GeM portal — do not include cost figures in the proposal."""
    return (
        "FINANCIAL PROPOSAL NOTE:\n"
        "- Price will be submitted directly on the GeM portal by ANAMAC.\n"
        "- Do NOT include any pricing, cost figures, rates, or financial amounts in this proposal.\n"
        "- In the Financial section of the proposal, write exactly: "
        "'Price submitted at GeM portal as per bid requirements.'"
    )


@dataclass
class BidProposerAgent:
    """Agent 2 — Bid Proposal Generation."""

    name: str = "bid_proposer_agent"
    status: str = "idle"
    coordinator: object = None

    async def prepare_proposal(self, bid_number: str) -> dict:
        """Read bid documents and company docs, then generate a proposal."""
        try:
            return await self._prepare_proposal_inner(bid_number)
        except Exception as e:
            self.status = "error"
            await self._emit_status("error", f"Proposal generation failed: {e}")
            return {"success": False, "error": str(e), "bid_number": bid_number}

    async def _prepare_proposal_inner(self, bid_number: str) -> dict:
        self.status = "reading_docs"
        await self._emit_status("reading_docs", f"Reading bid documents for {bid_number}")

        bid_dir = get_bid_dir(bid_number)
        gate = analysis_gate(bid_number, bid_dir)
        if gate["blocked"]:
            self.status = "readiness_blocked"
            await self._emit_status("readiness_blocked", "; ".join(gate["readiness"]["reasons"]))
            return {"success": False, **gate}
        manifest, _ = analysis_readiness(bid_number, bid_dir)
        bid_text, tender_texts = analysis_document_text(manifest)

        # Read bid metadata (value, quantity, etc.)
        bid_metadata = {}
        metadata_path = bid_dir / "bid_metadata.json"
        if metadata_path.exists():
            try:
                bid_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Read bid document
        # Tender text is read solely from the extraction manifest, including DOCX/XLSX provenance.
        primary_path = next(
            (document.stored_path for document in manifest.documents if document.document_role == "PRIMARY"),
            None,
        )
        supporting_texts = {path: text for path, text in tender_texts.items() if path != primary_path}

        # Read company documents
        company_docs_dir = get_company_docs_dir()
        company_texts = extract_text_from_directory(company_docs_dir)
        # Also read subdirectories
        for subdir in company_docs_dir.iterdir():
            if subdir.is_dir():
                company_texts.update(extract_text_from_directory(subdir))

        # Extract structured requirements
        requirements = extract_bid_requirements(bid_text)

        # Build financial proposal section
        financial_section = _build_financial_proposal(bid_metadata, bid_text)

        # Build document reference section
        doc_references = _build_document_references(bid_text)

        # Detect if this is an AI-related bid
        is_ai_bid = _is_ai_related_bid(bid_text)

        # Generate proposal via Claude
        self.status = "drafting"
        bid_type_msg = "AI-focused" if is_ai_bid else "standard"
        await self._emit_status("drafting", f"Generating {bid_type_msg} bid proposal with AI")

        proposal_text = await self._call_claude(
            bid_number, company_texts,
            requirements=requirements,
            supporting_texts=supporting_texts,
            financial_section=financial_section,
            doc_references=doc_references,
            is_ai_bid=is_ai_bid,
        )
        if gate["analysis_incomplete"]:
            proposal_text = (
                "ANALYSIS INCOMPLETE — This draft is based on an incomplete tender document set. "
                "It is not fully complete, submission-ready, or approved.\n\n" + proposal_text
            )

        # Save proposal as text
        proposal_txt_path = bid_dir / "bid_proposal.txt"
        proposal_txt_path.write_text(proposal_text, encoding="utf-8")

        # Generate PDF version
        proposal_pdf_path = bid_dir / "bid_proposal.pdf"
        logo = ROOT_DIR / "frontend" / "public" / "anamaclogo.png"
        try:
            generate_proposal_pdf(
                output_path=proposal_pdf_path,
                bid_number=bid_number,
                proposal_text=proposal_text,
                logo_path=logo if logo.exists() else None,
            )
        except Exception as e:
            logger.warning("PDF generation failed, text file still saved: %s", e)

        self.status = "proposal_ready"
        await self._emit_status("proposal_ready", f"Proposal ready for {bid_number}")

        # Notify Agent 3
        if self.coordinator:
            await self.coordinator.send_message(
                from_agent=self.name,
                to_agent="bid_assessor_agent",
                message_type="proposal_ready",
                bid_number=bid_number,
                payload={"proposal_path": str(proposal_txt_path)},
            )

        return {
            "success": True,
            "bid_number": bid_number,
            "proposal_path": str(proposal_txt_path),
            "pdf_path": str(proposal_pdf_path),
            "proposal_length": len(proposal_text),
            **gate,
        }

    async def revise_proposal(self, bid_number: str, gap_report: list[dict]) -> dict:
        """Revise proposal based on gap report from Agent 3."""
        try:
            return await self._revise_proposal_inner(bid_number, gap_report)
        except Exception as e:
            self.status = "error"
            await self._emit_status("error", f"Revision failed: {e}")
            return {"success": False, "error": str(e), "bid_number": bid_number}

    async def _revise_proposal_inner(self, bid_number: str, gap_report: list[dict]) -> dict:
        self.status = "receiving_gaps"
        await self._emit_status("receiving_gaps", f"Received {len(gap_report)} gaps for {bid_number}")

        bid_dir = get_bid_dir(bid_number)
        gate = analysis_gate(bid_number, bid_dir)
        if gate["blocked"]:
            self.status = "readiness_blocked"
            await self._emit_status("readiness_blocked", "; ".join(gate["readiness"]["reasons"]))
            return {"success": False, **gate}
        manifest, _ = analysis_readiness(bid_number, bid_dir)
        bid_text, _ = analysis_document_text(manifest)
        proposal_path = bid_dir / "bid_proposal.txt"

        current_proposal = ""
        if proposal_path.exists():
            current_proposal = proposal_path.read_text(encoding="utf-8")

        # Read company docs for gap resolution
        company_texts = extract_text_from_directory(get_company_docs_dir())
        for subdir in get_company_docs_dir().iterdir():
            if subdir.is_dir():
                company_texts.update(extract_text_from_directory(subdir))

        # Read bid metadata for financial context
        bid_metadata = {}
        metadata_path = bid_dir / "bid_metadata.json"
        if metadata_path.exists():
            try:
                bid_metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
            except Exception:
                pass

        # Re-read bid text for financial/doc reference context
        financial_section = _build_financial_proposal(bid_metadata, bid_text)
        doc_references = _build_document_references(bid_text)

        # Detect if AI bid
        is_ai_bid = _is_ai_related_bid(bid_text)

        self.status = "revising"
        await self._emit_status("revising", "Revising proposal to address gaps")

        revised = await self._call_claude(
            bid_number, company_texts,
            current_proposal=current_proposal,
            gaps=gap_report,
            financial_section=financial_section,
            doc_references=doc_references,
            is_ai_bid=is_ai_bid,
        )
        if gate["analysis_incomplete"]:
            revised = (
                "ANALYSIS INCOMPLETE — This draft is based on an incomplete tender document set. "
                "It is not fully complete, submission-ready, or approved.\n\n" + revised
            )

        proposal_path.write_text(revised, encoding="utf-8")

        # Regenerate PDF
        proposal_pdf_path = bid_dir / "bid_proposal.pdf"
        logo = ROOT_DIR / "frontend" / "public" / "anamaclogo.png"
        try:
            generate_proposal_pdf(
                output_path=proposal_pdf_path,
                bid_number=bid_number,
                proposal_text=revised,
                logo_path=logo if logo.exists() else None,
            )
        except Exception as e:
            logger.warning("PDF regeneration failed: %s", e)

        self.status = "revised_ready"
        await self._emit_status("revised_ready", f"Revised proposal ready for {bid_number}")

        if self.coordinator:
            await self.coordinator.send_message(
                from_agent=self.name,
                to_agent="bid_assessor_agent",
                message_type="proposal_revised",
                bid_number=bid_number,
                payload={"proposal_path": str(proposal_path)},
            )

        return {"success": True, "bid_number": bid_number, "revised": True, **gate}

    async def _call_claude(
        self,
        bid_number: str,
        company_texts: dict,
        requirements: dict = None,
        supporting_texts: dict = None,
        current_proposal: str = None,
        gaps: list[dict] = None,
        financial_section: str = "",
        doc_references: str = "",
        is_ai_bid: bool = False,
    ) -> str:
        """Single DeepSeek (OpenAI-compatible) API call for both initial generation and revision."""
        client = AsyncOpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)

        # Build company context
        company_context = ""
        for fname, text in company_texts.items():
            company_context += "\n--- " + fname + " ---\n" + text[:3000] + "\n"
            if len(company_context) > 15000:
                break

        if gaps and current_proposal:
            # Revision mode
            gap_lines = []
            for g in gaps:
                gap_lines.append(
                    "- [" + g.get("severity", "Unknown") + "] " + g.get("section", "") + ": "
                    + g.get("description", "") + " (Recommendation: " + g.get("recommendation", "") + ")"
                )

            financial_block = ""
            if financial_section:
                financial_block = "\n\n" + financial_section + "\n"

            doc_ref_block = ""
            if doc_references:
                doc_ref_block = "\n\n" + doc_references + "\n"

            # AI-specific instructions for revision
            ai_instructions = ""
            if is_ai_bid:
                ai_instructions = (
                    "\n\n🤖 AI BID DETECTED — ADDITIONAL REQUIREMENTS:\n"
                    "- For AI/ML capabilities and projects, reference 'AMD_AI_Profile.pdf (attached)'\n"
                    "- Highlight ANAMAC's Team Yoda: AI consultants with expertise in ML, DL, LLMs, RAG, and cloud AI\n"
                    "- Mention completed AI projects: Smart HR (AI recruitment automation with voice agents), "
                    "MuftAI (free AI router with multi-provider fallback), and this Bid Intelligence Platform\n"
                    "- Emphasize AI development capabilities: LangChain, GPT-4, vector databases, "
                    "agentic AI workflows, voice-enabled AI assistants\n"
                    "- For AI team composition, reference both 'AMD_AI_Profile.pdf (attached)' AND "
                    "'coreteamprofile_experience.pdf (attached)'\n"
                    "- Include AI technology stack: Python, OpenAI/DeepSeek APIs, LangChain, vector databases, "
                    "cloud platforms (AWS, Azure, GCP)\n"
                    "- Do NOT invent team member names, qualifications, or project details — "
                    "only reference the attached documents\n\n"
                )

            prompt = (
                "You are revising a bid proposal for ANAMAC to address quality gaps identified by the assessor.\n\n"
                "BID NUMBER: " + bid_number + "\n\n"
                "CURRENT PROPOSAL:\n" + current_proposal[:10000] + "\n\n"
                "GAPS TO ADDRESS:\n" + "\n".join(gap_lines) + "\n\n"
                "ANAMAC COMPANY DOCUMENTS (for reference):\n" + company_context[:5000] + "\n"
                + financial_block
                + doc_ref_block
                + ai_instructions + "\n"
                "IMPORTANT INSTRUCTIONS FOR REVISION:\n"
                "1. Address ALL identified gaps thoroughly.\n"
                "2. Do NOT include any pricing, cost figures, rates, or financial amounts. "
                "If any gap mentions a missing financial section, write: 'Price submitted at GeM portal as per bid requirements.'\n"
                "3. When referencing company documents (work experience, methodology, certificates etc.), "
                "mention the EXACT PDF filename and state 'PDF document attached'.\n"
                "   For work orders/work done — ONLY reference 'workorder2025V1.pdf (attached)'. "
                "Do NOT invent or assume any work order details, project names, clients, or values.\n"
                "4. For team/personnel — ONLY reference 'coreteamprofile_experience.pdf (attached)'. "
                "Do NOT invent or include any team member names, designations, qualifications, or experience details.\n"
                "5. For balance sheet — ONLY reference 'balancesheetlast3years.pdf (attached)'. Do NOT include any figures.\n"
                "   For turnover — ONLY reference 'CACertificate_RXILTurnover.pdf (attached)'. Do NOT include any turnover figures.\n"
                "6. For certifications — ONLY reference 'certificates_24v1.pdf (attached)'. "
                "Ensure the proposal includes a Certifications section listing ALL ANAMAC certificates by name: "
                "MSME, StartUp India, ISO, Lead Auditor, GSTIN, Udyam Registration. "
                "Do NOT invent certificate numbers, dates, or issuing authorities.\n"
                "7. Under the Software/Tools section, include: 'Appropriate licensed versions of all software and tools "
                "will be used for this engagement. Software license invoices will be shared at the time of bill raised to the client.'\n"
                "8. Maintain the same structure and professional tone.\n"
                "9. Return the COMPLETE revised proposal."
            )
        else:
            # Initial generation mode
            supporting_context = ""
            if supporting_texts:
                for fname, text in supporting_texts.items():
                    supporting_context += "\n--- " + fname + " ---\n" + text[:3000] + "\n"
                    if len(supporting_context) > 10000:
                        break

            reqs = requirements or {}

            financial_block = ""
            if financial_section:
                financial_block = "\n" + financial_section + "\n\n"

            doc_ref_block = ""
            if doc_references:
                doc_ref_block = "\n" + doc_references + "\n\n"

            # AI-specific context and requirements
            ai_context = ""
            if is_ai_bid:
                ai_context = (
                    "\n🤖 THIS IS AN AI-RELATED BID — USE ANAMAC'S AI CAPABILITIES:\n"
                    "The primary reference is 'AMD_AI_Profile.pdf (attached)', which documents ANAMAC's AI team "
                    "and completed projects.\n"
                    "Team Yoda includes AI consultants with expertise in artificial intelligence, machine learning, "
                    "deep learning, LLMs, RAG, cloud computing, and digital transformation.\n"
                    "Relevant completed AI projects to reference (only as documented in AMD_AI_Profile.pdf):\n"
                    "• Smart HR — AI recruitment automation: resume parsing, GPT-4 evaluation, voice-enabled interviews, "
                    "assessment scoring, scheduling, and automated communications.\n"
                    "• MuftAI — free AI router with unified chat/API, multiple provider integration, rate-limit detection, "
                    "automatic fallback, web search, and OpenAI-compatible endpoint.\n"
                    "• ANAMAC Bid Proposal Intelligence Platform — multi-agent AI workflow for GEM bid discovery, "
                    "document processing, proposal generation, and compliance assessment.\n"
                    "AI BID PROPOSAL REQUIREMENTS:\n"
                    "- Include an AI/ML solution architecture and data flow appropriate to the bid scope\n"
                    "- Describe model approach, training/fine-tuning (if applicable), RAG/vector database strategy, "
                    "and integration points\n"
                    "- Address responsible AI: data privacy, security, explainability, bias mitigation, human oversight, "
                    "and audit logging\n"
                    "- Include AI testing/evaluation metrics, deployment plan, monitoring, and support model\n"
                    "- Include a dedicated AI team and relevant experience section\n"
                    "- Reference 'AMD_AI_Profile.pdf (attached)' for all AI capabilities and project claims\n"
                    "- Do NOT invent team member details, client names, performance metrics, or project outcomes\n\n"
                )

            prompt = (
                "You are a professional bid proposal writer for ANAMAC, a company specializing in "
                "safety consulting services and AI/ML solutions.\n\n"
                "Generate a comprehensive bid proposal for the following government bid from the GEM Portal.\n\n"
                + ai_context
                + "BID NUMBER: " + bid_number + "\n\n"
                + "BID REQUIREMENTS:\n" + reqs.get("full_text", "")[:8000] + "\n\n"
                + "SCOPE OF WORK:\n" + reqs.get("scope_of_work", "Not explicitly stated") + "\n\n"
                + "ELIGIBILITY CRITERIA:\n" + reqs.get("eligibility", "Not explicitly stated") + "\n\n"
                + "TECHNICAL REQUIREMENTS:\n" + reqs.get("technical_requirements", "Not explicitly stated") + "\n\n"
                + "SUPPORTING BID DOCUMENTS:\n" + supporting_context[:5000] + "\n\n"
                + "ANAMAC COMPANY DOCUMENTS:\n" + company_context[:5000] + "\n\n"
                + financial_block
                + doc_ref_block
                + "Generate a professional bid proposal that:\n"
                "1. Addresses every requirement in the bid document\n"
                "2. Highlights ANAMAC's qualifications and past experience\n"
                "3. References relevant certifications and capabilities\n"
                "4. Follows GEM portal bid submission format\n"
                "5. Includes technical approach, methodology, team composition, timeline, and compliance matrix\n"
                "6. Includes a FINANCIAL PROPOSAL section that states: 'Price submitted at GeM portal as per bid requirements.' "
                "Do NOT include any pricing figures, rates, or cost amounts — these are submitted separately on GeM.\n"
                "7. When referencing company supporting documents (work experience, methodology, certificates, "
                "balance sheets, team CVs, GST, MSME, software licenses etc.), mention the EXACT PDF filename "
                "from the list above and state 'PDF document attached' for each\n"
                "8. For work experience/past projects, cite 'QRA_hazop_ProjectCompleted.pdf (attached)'\n"
                "   For work orders/work done references — ONLY cite 'workorder2025V1.pdf (attached)'. "
                "Do NOT invent or assume any work order details, project names, clients, or values.\n"
                "9. For methodology, cite 'QRA_HAZOP_Methodology.pdf (attached)'\n"
                "10. For team/personnel composition — ONLY reference 'coreteamprofile_experience.pdf (attached)'. "
                "Do NOT invent, assume, or include any team member names, designations, qualifications, or experience details. "
                "Simply state that team profiles are provided in the attached document.\n"
                "11. For balance sheet/financial statements — ONLY reference 'balancesheetlast3years.pdf (attached)'. "
                "Do NOT include any financial figures or balance sheet data.\n"
                "    For turnover/CA certificate — ONLY reference 'CACertificate_RXILTurnover.pdf (attached)'. "
                "Do NOT include any turnover figures.\n"
                "12. For certifications — ONLY reference 'certificates_24v1.pdf (attached)'. "
                "ALWAYS include a dedicated Certifications & Accreditations section that lists ALL certificates ANAMAC holds: "
                "MSME, StartUp India, ISO, Lead Auditor, GSTIN, Udyam Registration, and any other relevant certifications. "
                "State each certificate by name and note it is provided in 'certificates_24v1.pdf (attached)'. "
                "Do NOT invent certificate numbers, dates, or issuing authorities.\n"
                "13. Under the Software/Tools section, include the following statement exactly: "
                "'Appropriate licensed versions of all software and tools will be used for this engagement. "
                "Software license invoices will be shared at the time of bill raised to the client.'\n\n"
                "Format the proposal with clear sections and professional language."
            )

        response = await client.chat.completions.create(
            model=DEEPSEEK_MODEL,
            max_tokens=4096,
            messages=[{"role": "user", "content": prompt}],
        )

        return (response.choices[0].message.content or "").strip()

    async def _emit_status(self, status: str, detail: str = ""):
        if self.coordinator:
            await self.coordinator.broadcast_status(self.name, status, detail)
