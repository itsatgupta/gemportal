from __future__ import annotations
import logging
from pathlib import Path

import pdfplumber

logger = logging.getLogger("anamac.tools.document_parser")


def extract_text_from_pdf(pdf_path: Path) -> str:
    """Extract full text from a PDF file."""
    text_parts: list[str] = []

    try:
        with pdfplumber.open(str(pdf_path)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
    except Exception as e:
        logger.warning("Error reading %s: %s", pdf_path, e)

    return "\n\n".join(text_parts)


def extract_text_from_directory(dir_path: Path) -> dict[str, str]:
    """Extract text from all PDFs in a directory. Returns {filename: text}."""
    results = {}
    if not dir_path.exists():
        return results

    for file in sorted(dir_path.iterdir()):
        if file.suffix.lower() == ".pdf":
            results[file.name] = extract_text_from_pdf(file)
        elif file.suffix.lower() in (".txt", ".csv"):
            try:
                results[file.name] = file.read_text(encoding="utf-8", errors="ignore")
            except Exception:
                pass

    return results


def extract_bid_requirements(bid_text: str) -> dict:
    """Parse bid text into structured requirements sections."""
    sections = {
        "full_text": bid_text,
        "scope_of_work": "",
        "eligibility": "",
        "technical_requirements": "",
        "financial_requirements": "",
        "deadlines": "",
        "documents_required": "",
    }

    lower = bid_text.lower()

    # Simple section extraction based on common bid document headings
    section_markers = {
        "scope_of_work": ["scope of work", "scope of supply", "description of work", "work description"],
        "eligibility": ["eligibility", "qualification criteria", "pre-qualification", "bidder qualification"],
        "technical_requirements": ["technical specification", "technical requirement", "technical criteria"],
        "financial_requirements": ["financial", "price bid", "commercial", "cost"],
        "deadlines": ["deadline", "schedule", "time frame", "delivery period", "completion period"],
        "documents_required": ["documents required", "document submission", "annexure", "enclosure"],
    }

    for section_key, markers in section_markers.items():
        for marker in markers:
            idx = lower.find(marker)
            if idx != -1:
                # Extract roughly 2000 chars after the marker
                sections[section_key] = bid_text[idx : idx + 2000].strip()
                break

    return sections
