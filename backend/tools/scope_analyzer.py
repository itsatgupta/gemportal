from __future__ import annotations
import json
import logging
from pathlib import Path

from openai import OpenAI

from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL
from tools.tender_documents import analysis_document_text, analysis_gate, analysis_readiness

logger = logging.getLogger("anamac.tools.scope_analyzer")

# Max chars per document to avoid token overload
_MAX_PRIMARY_CHARS = 40_000
_MAX_SUPPORTING_CHARS = 8_000
_MAX_TOTAL_CHARS = 80_000

_SYSTEM_PROMPT = """You are a senior Process Safety and Risk Management consultant with 25+ years of experience conducting and reviewing:
- Quantitative Risk Assessment (QRA) studies
- Hazard and Operability (HAZOP) studies
- Fire and Explosion Risk Assessment (FERA)
- Safety Integrity Level (SIL) determination studies
- Environmental Impact Assessments (EIA)
- HAZID, What-If, and Bow-Tie analyses

You specialize in analyzing government procurement documents (bids/tenders) for process and safety management consultancy work, particularly on Indian government infrastructure projects (refineries, pipelines, petrochemical plants, city gas distribution, etc.).

Your task is to extract precise scope intelligence from bid documents to help the bidding firm accurately estimate effort and price."""

_ANALYSIS_PROMPT = """Analyze the following bid documents from the Government e-Marketplace (GeM) portal and extract detailed scope intelligence as a senior Process Safety consultant.

CRITICAL EXTRACTION TARGETS:
1. For HAZOP studies: The NUMBER OF P&ID DRAWINGS is the single most important metric — it directly determines study duration and cost. Search every page for mentions of "P&IDs", "P&ID drawings", "piping and instrumentation diagrams", "number of drawings", "drawing list".
2. For QRA studies: Total SITE AREA (hectares/km²) and PIPELINE LENGTHS (km) are key metrics.
3. BUYER'S ESTIMATED PRICE: Search thoroughly for any budget estimate — look for "estimated value", "EMD", "earnest money deposit", "financial bid", "approximate cost", "budget", "cost estimate", "estimated cost", numbers followed by "lakh" or "crore".
4. Study SCOPE clearly — what exactly needs to be studied, which units/areas/facilities.

BID DOCUMENTS:
{documents_text}

Return ONLY a valid JSON object (no markdown, no explanation) with this exact structure:
{{
  "study_type": "HAZOP | QRA | FERA | SIL | EIA | HAZID | Multiple | Other",
  "study_type_detail": "More specific description, e.g. 'HAZOP + SIL Assessment' or 'QRA for CGD network'",
  "executive_summary": "2-3 sentence overview of what this study requires, key scope, and complexity",
  "scope_description": "Detailed scope of work as described in the bid document",
  "facilities_covered": ["List of specific facilities, plants, units, or sites mentioned"],
  "hazop_details": {{
    "pid_count": null,
    "pid_count_note": "Exact text from document referencing P&IDs, or null if not a HAZOP",
    "node_count": null,
    "process_units": ["List of process units/systems to be studied"],
    "plant_areas": ["List of plant areas or sections covered"],
    "methodology": "Continuous HAZOP / Batch HAZOP / Combined, or null"
  }},
  "qra_details": {{
    "site_count": null,
    "total_area_hectares": null,
    "total_area_note": "Exact text mentioning area, or null",
    "pipeline_length_km": null,
    "pipeline_length_note": "Exact text mentioning pipeline length, or null",
    "hazard_scenarios": ["List of hazard scenarios to be modeled"],
    "consequence_modeling": ["Types of consequence modeling required"],
    "risk_criteria": "Individual risk / Societal risk / Both, or null"
  }},
  "deliverables": ["Complete list of deliverables required"],
  "timeline_weeks": null,
  "timeline_note": "Exact text mentioning duration/timeline",
  "submission_deadline": "Deadline for bid submission",
  "study_completion_deadline": "Deadline for completing the study work",
  "buyer_price_estimate": {{
    "has_estimate": true,
    "amount_text": "Exact text from document, e.g. 'Rs. 45 Lakhs' or null if not found",
    "amount_inr": null,
    "estimate_type": "estimated_value | emd | budget | approximate_cost | null",
    "emd_amount_text": "EMD/Earnest Money Deposit amount if mentioned",
    "context": "2-3 sentences of surrounding context where this figure appears"
  }},
  "qualification_requirements": ["List of specific qualification/eligibility requirements for bidder"],
  "manpower_requirements": ["Any specified manpower, team, or expert requirements"],
  "standards_referenced": ["Relevant Indian and international standards mentioned: IS, OISD, PESO, API, IEC, BS etc."],
  "special_requirements": ["Any special requirements, constraints, certifications, or conditions"],
  "complexity_rating": "Low | Medium | High | Very High",
  "complexity_reasoning": "Brief explanation of why this complexity rating was assigned",
  "estimated_effort_weeks": null,
  "key_risks_for_bidder": ["Key risks or challenges for the firm preparing this bid"]
}}"""


def analyze_bid_scope(bid_number: str, bid_dir: Path) -> dict:
    """
    Read all documents in the bid directory and extract scope intelligence
    using DeepSeek as a Process Safety Management expert.

    Returns a structured dict with scope details, key quantities, and buyer estimate.
    Raises on API error.
    """
    gate = analysis_gate(bid_number, bid_dir)
    if gate["blocked"]:
        return {"status": "blocked", **gate}
    if not DEEPSEEK_API_KEY:
        raise RuntimeError("DEEPSEEK_API_KEY not set — scope analysis unavailable")
    manifest, _ = analysis_readiness(bid_number, bid_dir)
    primary_text, tender_texts = analysis_document_text(manifest)

    # --- Collect document text ---
    docs_text_parts: list[str] = []
    total_chars = 0

    # Primary bid document (highest priority)
    if primary_text:
        truncated = primary_text[:_MAX_PRIMARY_CHARS]
        docs_text_parts.append(f"=== PRIMARY BID DOCUMENT ===\n{truncated}")
        total_chars += len(truncated)
        logger.info("Loaded primary tender content: %d chars", len(truncated))

    # bid_metadata.json (has title, department, value, items)
    metadata_path = bid_dir / "bid_metadata.json"
    if metadata_path.exists():
        try:
            meta_text = metadata_path.read_text(encoding="utf-8")
            docs_text_parts.insert(0, f"=== BID METADATA ===\n{meta_text}")
            total_chars += len(meta_text)
        except Exception:
            pass

    # Supporting documents
    for filename, text in tender_texts.items():
        if text == primary_text or total_chars >= _MAX_TOTAL_CHARS:
            continue
        truncated = text[:_MAX_SUPPORTING_CHARS]
        docs_text_parts.append(f"=== SUPPORTING DOCUMENT: {filename} ===\n{truncated}")
        total_chars += len(truncated)

    if not docs_text_parts:
        raise ValueError(f"No readable documents found in {bid_dir}")

    combined_text = "\n\n".join(docs_text_parts)
    logger.info(
        "Analyzing scope for %s: %d chars from %d document sections",
        bid_number, len(combined_text), len(docs_text_parts)
    )

    # --- Call DeepSeek (OpenAI-compatible) API ---
    client = OpenAI(api_key=DEEPSEEK_API_KEY, base_url=DEEPSEEK_BASE_URL)
    prompt = _ANALYSIS_PROMPT.format(documents_text=combined_text)

    message = client.chat.completions.create(
        model=DEEPSEEK_MODEL,
        max_tokens=4096,
        messages=[
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )

    response_text = (message.choices[0].message.content or "").strip()

    # Strip markdown code fences if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    result = json.loads(response_text)
    result.update({
        "readiness": gate["readiness"],
        "analysis_incomplete": gate["analysis_incomplete"],
    })
    logger.info(
        "Scope analysis complete for %s: type=%s, complexity=%s",
        bid_number,
        result.get("study_type"),
        result.get("complexity_rating"),
    )
    return result
