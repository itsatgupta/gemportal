from __future__ import annotations
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    Image,
    NextPageTemplate,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

# ── Brand colours ──────────────────────────────────────────────
NAVY = colors.HexColor("#0f1729")
DARK_SLATE = colors.HexColor("#1a2332")
TEAL = colors.HexColor("#14b8a6")
CYAN = colors.HexColor("#22d3ee")
GOLD = colors.HexColor("#e0b84a")
LIGHT_GREY = colors.HexColor("#e5e7eb")
MID_GREY = colors.HexColor("#94a3b8")
WHITE = colors.white

PAGE_W, PAGE_H = A4
MARGIN = 2.2 * cm


# ── Page backgrounds ──────────────────────────────────────────
def _cover_bg(canvas, doc):
    """Dark gradient cover page."""
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Accent bar at top
    canvas.setFillColor(TEAL)
    canvas.rect(0, PAGE_H - 6 * mm, PAGE_W, 6 * mm, fill=1, stroke=0)
    # Thin gold line
    canvas.setStrokeColor(GOLD)
    canvas.setLineWidth(0.8)
    canvas.line(MARGIN, PAGE_H - 12 * mm, PAGE_W - MARGIN, PAGE_H - 12 * mm)
    canvas.restoreState()


def _body_bg(canvas, doc):
    """White body pages with subtle header and footer."""
    canvas.saveState()
    # Header bar
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 14 * mm, PAGE_W, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(TEAL)
    canvas.rect(0, PAGE_H - 14.8 * mm, PAGE_W, 0.8 * mm, fill=1, stroke=0)
    # Header text
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(LIGHT_GREY)
    canvas.drawString(MARGIN, PAGE_H - 10 * mm, "ANAMAC  |  Bid Proposal Intelligence Platform")
    # Page number
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MID_GREY)
    canvas.drawRightString(PAGE_W - MARGIN, 12 * mm, f"Page {doc.page}")
    # Footer line
    canvas.setStrokeColor(colors.HexColor("#334155"))
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 18 * mm, PAGE_W - MARGIN, 18 * mm)
    canvas.restoreState()


# ── Styles ──────────────────────────────────────────────────
def _build_styles():
    ss = getSampleStyleSheet()

    cover_title = ParagraphStyle(
        "CoverTitle",
        parent=ss["Title"],
        fontName="Helvetica-Bold",
        fontSize=28,
        leading=34,
        textColor=WHITE,
        alignment=TA_LEFT,
        spaceAfter=10,
    )
    cover_sub = ParagraphStyle(
        "CoverSub",
        parent=ss["Normal"],
        fontName="Helvetica",
        fontSize=13,
        leading=18,
        textColor=LIGHT_GREY,
        alignment=TA_LEFT,
    )
    heading1 = ParagraphStyle(
        "H1",
        parent=ss["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        leading=22,
        textColor=NAVY,
        spaceBefore=18,
        spaceAfter=8,
        borderPadding=(0, 0, 4, 0),
    )
    heading2 = ParagraphStyle(
        "H2",
        parent=ss["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=12,
        leading=16,
        textColor=colors.HexColor("#1e3a5f"),
        spaceBefore=12,
        spaceAfter=6,
    )
    body = ParagraphStyle(
        "Body",
        parent=ss["Normal"],
        fontName="Helvetica",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        alignment=TA_JUSTIFY,
        spaceAfter=6,
    )
    bullet = ParagraphStyle(
        "Bullet",
        parent=body,
        bulletIndent=12,
        leftIndent=24,
        spaceAfter=4,
    )
    meta_label = ParagraphStyle(
        "MetaLabel",
        parent=ss["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        textColor=MID_GREY,
    )
    meta_val = ParagraphStyle(
        "MetaVal",
        parent=ss["Normal"],
        fontName="Helvetica",
        fontSize=10,
        textColor=colors.HexColor("#1e293b"),
    )

    return {
        "cover_title": cover_title,
        "cover_sub": cover_sub,
        "h1": heading1,
        "h2": heading2,
        "body": body,
        "bullet": bullet,
        "meta_label": meta_label,
        "meta_val": meta_val,
    }


# ── Markdown-like text → flowables ─────────────────────────
def _text_to_flowables(text: str, styles: dict) -> list:
    """Convert proposal text (with markdown-ish headers and bullets) to reportlab flowables."""
    flowables = []
    lines = text.split("\n")
    para_buf: list[str] = []

    def flush_para():
        if para_buf:
            joined = " ".join(para_buf).strip()
            if joined:
                flowables.append(Paragraph(joined, styles["body"]))
            para_buf.clear()

    for raw in lines:
        line = raw.strip()

        if not line:
            flush_para()
            flowables.append(Spacer(1, 4))
            continue

        # Markdown headers
        if line.startswith("### "):
            flush_para()
            flowables.append(Paragraph(line[4:], styles["h2"]))
            continue
        if line.startswith("## "):
            flush_para()
            flowables.append(Paragraph(line[3:], styles["h1"]))
            continue
        if line.startswith("# "):
            flush_para()
            flowables.append(Paragraph(line[2:], styles["h1"]))
            continue

        # Numbered headings like "1. SECTION NAME" (all caps)
        m = re.match(r"^(\d+)\.\s+([A-Z][A-Z\s&/]+)$", line)
        if m:
            flush_para()
            flowables.append(Paragraph(f"{m.group(1)}. {m.group(2)}", styles["h1"]))
            continue

        # Bullet points
        if line.startswith(("- ", "* ", "\u2022 ")):
            flush_para()
            bullet_text = line.lstrip("-*\u2022 ").strip()
            flowables.append(Paragraph(f"\u2022  {bullet_text}", styles["bullet"]))
            continue

        # Bold lines (entire line wrapped in ** or __)
        if (line.startswith("**") and line.endswith("**")) or (line.startswith("__") and line.endswith("__")):
            flush_para()
            clean = line.strip("*_ ")
            flowables.append(Paragraph(f"<b>{clean}</b>", styles["h2"]))
            continue

        # Regular text — accumulate into paragraph
        # Convert inline bold/italic
        processed = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", line)
        processed = re.sub(r"\*(.+?)\*", r"<i>\1</i>", processed)
        para_buf.append(processed)

    flush_para()
    return flowables


# ── Public API ─────────────────────────────────────────────
def generate_proposal_pdf(
    output_path: Path,
    bid_number: str,
    proposal_text: str,
    company_name: str = "ANAMAC",
    logo_path: Path | None = None,
) -> Path:
    """Generate a professionally formatted PDF proposal and return its path."""
    styles = _build_styles()

    # Page templates
    cover_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN, id="cover")
    body_frame = Frame(MARGIN, 22 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 40 * mm, id="body")

    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )

    doc.addPageTemplates(
        [
            PageTemplate(id="cover", frames=[cover_frame], onPage=_cover_bg),
            PageTemplate(id="body", frames=[body_frame], onPage=_body_bg),
        ]
    )

    story: list = []
    now = datetime.now(timezone.utc).strftime("%d %B %Y")

    # ── Cover page ──
    story.append(Spacer(1, 6 * cm))

    # Logo (if available)
    if logo_path and logo_path.exists():
        try:
            story.append(Image(str(logo_path), width=5 * cm, height=5 * cm))
            story.append(Spacer(1, 1 * cm))
        except Exception:
            pass

    story.append(Paragraph("BID PROPOSAL", styles["cover_title"]))
    story.append(Spacer(1, 6))
    story.append(Paragraph(f"Bid Reference: <b>{bid_number}</b>", styles["cover_sub"]))
    story.append(Spacer(1, 4))
    story.append(Paragraph(f"Prepared by: {company_name}", styles["cover_sub"]))
    story.append(Paragraph(f"Date: {now}", styles["cover_sub"]))
    story.append(Spacer(1, 2 * cm))

    # Gold divider on cover
    divider_data = [["" * 60]]
    divider = Table(divider_data, colWidths=[PAGE_W - 4 * MARGIN])
    divider.setStyle(
        TableStyle(
            [
                ("LINEABOVE", (0, 0), (-1, 0), 1.5, GOLD),
            ]
        )
    )
    story.append(divider)
    story.append(Spacer(1, 8))
    story.append(
        Paragraph(
            f"Submitted in response to Government e-Marketplace (GeM) Bid {bid_number}",
            ParagraphStyle("CoverNote", fontName="Helvetica-Oblique", fontSize=10, textColor=MID_GREY),
        )
    )

    # Switch to body pages
    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    # ── Metadata table ──
    meta_rows = [
        ["BID NUMBER", bid_number],
        ["PREPARED BY", company_name],
        ["DATE", now],
        ["PLATFORM", "Government e-Marketplace (GeM)"],
    ]
    meta_table = Table(meta_rows, colWidths=[4.5 * cm, PAGE_W - 2 * MARGIN - 4.5 * cm])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (0, -1), MID_GREY),
                ("TEXTCOLOR", (1, 0), (1, -1), NAVY),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("LINEBELOW", (0, -1), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
            ]
        )
    )
    story.append(meta_table)
    story.append(Spacer(1, 12))

    # ── Proposal body ──
    body_flowables = _text_to_flowables(proposal_text, styles)
    story.extend(body_flowables)

    # ── Build PDF ──
    doc.build(story)
    return output_path


# ── Scope Intelligence Brief PDF ──────────────────────────────
AMBER = colors.HexColor("#f59e0b")
AMBER_LIGHT = colors.HexColor("#fef3c7")
AMBER_DIM = colors.HexColor("#92400e")
EMERALD = colors.HexColor("#10b981")
RED_WARN = colors.HexColor("#ef4444")
SLATE_700 = colors.HexColor("#334155")
SLATE_100 = colors.HexColor("#f1f5f9")


def _scope_cover_bg(canvas, doc):
    """Dark cover with amber accent for Scope Intelligence Brief."""
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    canvas.setFillColor(AMBER)
    canvas.rect(0, PAGE_H - 6 * mm, PAGE_W, 6 * mm, fill=1, stroke=0)
    canvas.setStrokeColor(AMBER)
    canvas.setLineWidth(0.8)
    canvas.line(MARGIN, PAGE_H - 12 * mm, PAGE_W - MARGIN, PAGE_H - 12 * mm)
    canvas.restoreState()


def _scope_body_bg(canvas, doc):
    """Body pages with amber header accent."""
    canvas.saveState()
    canvas.setFillColor(NAVY)
    canvas.rect(0, PAGE_H - 14 * mm, PAGE_W, 14 * mm, fill=1, stroke=0)
    canvas.setFillColor(AMBER)
    canvas.rect(0, PAGE_H - 14.8 * mm, PAGE_W, 0.8 * mm, fill=1, stroke=0)
    canvas.setFont("Helvetica-Bold", 7)
    canvas.setFillColor(LIGHT_GREY)
    canvas.drawString(MARGIN, PAGE_H - 10 * mm, "ANAMAC  |  Scope Intelligence Brief  |  CONFIDENTIAL")
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(MID_GREY)
    canvas.drawRightString(PAGE_W - MARGIN, 12 * mm, f"Page {doc.page}")
    canvas.setStrokeColor(SLATE_700)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN, 18 * mm, PAGE_W - MARGIN, 18 * mm)
    canvas.restoreState()


def _metric_card(label: str, value: str, note: str = "", color=AMBER) -> Table:
    """A highlighted metric card (label + big value + optional note)."""
    content = [
        [Paragraph(f"<b>{label}</b>",
                   ParagraphStyle("ML", fontName="Helvetica-Bold", fontSize=8, textColor=MID_GREY))],
        [Paragraph(value,
                   ParagraphStyle("MV", fontName="Helvetica-Bold", fontSize=20, textColor=color, leading=24))],
    ]
    if note:
        content.append([Paragraph(note,
                                  ParagraphStyle("MN", fontName="Helvetica-Oblique", fontSize=8,
                                                 textColor=colors.HexColor("#64748b"), leading=11))])
    t = Table(content, colWidths=[PAGE_W / 2 - 2 * MARGIN - 5])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0d1525")),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LEFTPADDING", (0, 0), (-1, -1), 12),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEABOVE", (0, 0), (-1, 0), 3, color),
        ("ROUNDEDCORNERS", [4, 4, 4, 4]),
    ]))
    return t


def _bullet_list(items: list, styles: dict) -> list:
    """Convert list of strings to bullet flowables."""
    flowables = []
    for item in items:
        if item and item.strip():
            flowables.append(Paragraph(f"\u2022  {item.strip()}", styles["bullet"]))
    return flowables


def _section_header(title: str, styles: dict) -> list:
    """Section header with amber underline."""
    return [
        Paragraph(title.upper(), styles["h1"]),
        HRFlowable(width="100%", thickness=1.5, color=AMBER, spaceAfter=6),
    ]


def generate_scope_summary_pdf(
    output_path: Path,
    bid_number: str,
    scope_data: dict,
    logo_path: Optional[Path] = None,
) -> Path:
    """
    Generate a Scope Intelligence Brief PDF from Claude's scope analysis.

    scope_data is the dict returned by scope_analyzer.analyze_bid_scope().
    """
    styles = _build_styles()

    # Override h1 color to amber for this doc
    styles["h1"] = ParagraphStyle(
        "H1Scope",
        parent=styles["h1"],
        textColor=AMBER,
    )
    styles["h2"] = ParagraphStyle(
        "H2Scope",
        parent=styles["h2"],
        textColor=colors.HexColor("#d97706"),
    )

    cover_frame = Frame(MARGIN, MARGIN, PAGE_W - 2 * MARGIN, PAGE_H - 2 * MARGIN, id="cover")
    body_frame = Frame(MARGIN, 22 * mm, PAGE_W - 2 * MARGIN, PAGE_H - 40 * mm, id="body")

    doc = BaseDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=MARGIN,
        bottomMargin=MARGIN,
    )
    doc.addPageTemplates([
        PageTemplate(id="cover", frames=[cover_frame], onPage=_scope_cover_bg),
        PageTemplate(id="body", frames=[body_frame], onPage=_scope_body_bg),
    ])

    story: list = []
    now = datetime.now(timezone.utc).strftime("%d %B %Y")

    # ── Cover page ──
    story.append(Spacer(1, 5 * cm))
    if logo_path and logo_path.exists():
        try:
            story.append(Image(str(logo_path), width=5 * cm, height=5 * cm))
            story.append(Spacer(1, 1 * cm))
        except Exception:
            pass

    # Complexity badge colours
    complexity = scope_data.get("complexity_rating", "Medium")
    complexity_color = {
        "Low": EMERALD, "Medium": AMBER, "High": colors.HexColor("#f97316"), "Very High": RED_WARN
    }.get(complexity, AMBER)

    story.append(Paragraph(
        "SCOPE INTELLIGENCE BRIEF",
        ParagraphStyle("CoverTag", fontName="Helvetica-Bold", fontSize=11, textColor=AMBER, letterSpacing=2),
    ))
    story.append(Spacer(1, 8))
    story.append(Paragraph(
        scope_data.get("study_type_detail", scope_data.get("study_type", "Process Safety Study")),
        ParagraphStyle("CoverTitle", fontName="Helvetica-Bold", fontSize=26, leading=32, textColor=WHITE),
    ))
    story.append(Spacer(1, 16))

    # Bid ref + complexity row
    cover_meta = Table([
        [
            Paragraph(f"Bid Ref: <b>{bid_number}</b>",
                      ParagraphStyle("CM", fontName="Helvetica", fontSize=11, textColor=LIGHT_GREY)),
            Paragraph(
                f"<b>Complexity: {complexity}</b>",
                ParagraphStyle("CC", fontName="Helvetica-Bold", fontSize=11,
                               textColor=complexity_color, alignment=TA_RIGHT),
            ),
        ]
    ], colWidths=[(PAGE_W - 4 * MARGIN) / 2] * 2)
    cover_meta.setStyle(TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0), ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]))
    story.append(cover_meta)
    story.append(Spacer(1, 2 * cm))

    divider_data = [[""]]
    divider = Table(divider_data, colWidths=[PAGE_W - 4 * MARGIN])
    divider.setStyle(TableStyle([("LINEABOVE", (0, 0), (-1, 0), 1.5, AMBER)]))
    story.append(divider)
    story.append(Spacer(1, 10))
    story.append(Paragraph(
        f"Prepared by ANAMAC  ·  {now}  ·  Confidential",
        ParagraphStyle("CoverNote", fontName="Helvetica-Oblique", fontSize=9, textColor=MID_GREY),
    ))

    story.append(NextPageTemplate("body"))
    story.append(PageBreak())

    # ── Page 1: Overview ──
    story.extend(_section_header("Bid Overview", styles))

    # Metadata table
    study_type = scope_data.get("study_type", "—")
    study_detail = scope_data.get("study_type_detail", "—")
    deadline = scope_data.get("submission_deadline") or scope_data.get("study_completion_deadline") or "See bid document"
    meta_rows = [
        ["BID NUMBER", bid_number],
        ["STUDY TYPE", study_detail if study_detail != "—" else study_type],
        ["SUBMISSION DEADLINE", deadline],
        ["COMPLEXITY", complexity],
    ]
    meta_t = Table(meta_rows, colWidths=[4.5 * cm, PAGE_W - 2 * MARGIN - 4.5 * cm])
    meta_t.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MID_GREY),
        ("TEXTCOLOR", (1, 0), (1, -1), NAVY),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("LINEBELOW", (0, -1), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
    ]))
    story.append(meta_t)
    story.append(Spacer(1, 14))

    # Executive summary
    story.extend(_section_header("Executive Summary", styles))
    exec_summary = scope_data.get("executive_summary", "")
    if exec_summary:
        story.append(Paragraph(exec_summary, styles["body"]))
    story.append(Spacer(1, 10))

    # Scope description
    scope_desc = scope_data.get("scope_description", "")
    if scope_desc:
        story.extend(_section_header("Scope of Work", styles))
        story.append(Paragraph(scope_desc, styles["body"]))
        story.append(Spacer(1, 10))

    # Facilities
    facilities = scope_data.get("facilities_covered", [])
    if facilities:
        story.append(Paragraph("Facilities / Areas Covered", styles["h2"]))
        story.extend(_bullet_list(facilities, styles))
        story.append(Spacer(1, 10))

    # ── Page 2: Key Metrics ──
    story.append(PageBreak())
    story.extend(_section_header("Key Scope Metrics", styles))

    study_upper = study_type.upper()
    metric_cards_left = []
    metric_cards_right = []

    if "HAZOP" in study_upper:
        hazop = scope_data.get("hazop_details", {})
        pid_count = hazop.get("pid_count")
        node_count = hazop.get("node_count")
        pid_note = (hazop.get("pid_count_note") or "")[:80]
        node_note = ""

        metric_cards_left.append(_metric_card(
            "NUMBER OF P&ID DRAWINGS",
            str(pid_count) if pid_count is not None else "See Document",
            pid_note,
            AMBER,
        ))
        metric_cards_right.append(_metric_card(
            "STUDY NODES",
            str(node_count) if node_count is not None else "TBD",
            node_note,
            TEAL,
        ))

        # Process units
        units = hazop.get("process_units", [])
        if units:
            story.append(Table(
                [[metric_cards_left[-1], metric_cards_right[-1]]],
                colWidths=[(PAGE_W - 2 * MARGIN) / 2] * 2,
                style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                   ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 0)]),
            ))
            story.append(Spacer(1, 14))
            metric_cards_left.clear()
            metric_cards_right.clear()

            story.append(Paragraph("Process Units / Systems to Study", styles["h2"]))
            story.extend(_bullet_list(units, styles))
            story.append(Spacer(1, 10))

        plant_areas = hazop.get("plant_areas", [])
        if plant_areas:
            story.append(Paragraph("Plant Areas / Sections", styles["h2"]))
            story.extend(_bullet_list(plant_areas, styles))
            story.append(Spacer(1, 10))

        methodology = hazop.get("methodology")
        if methodology:
            story.append(Paragraph(f"<b>Study Methodology:</b> {methodology}", styles["body"]))
            story.append(Spacer(1, 10))

    if "QRA" in study_upper or "QUANTITATIVE RISK" in study_upper:
        qra = scope_data.get("qra_details", {})
        area = qra.get("total_area_hectares")
        pipeline = qra.get("pipeline_length_km")
        sites = qra.get("site_count")

        area_note = (qra.get("total_area_note") or "")[:80]
        pipeline_note = (qra.get("pipeline_length_note") or "")[:80]

        if area is not None:
            metric_cards_left.append(_metric_card("TOTAL SITE AREA", f"{area} ha", area_note, AMBER))
        if pipeline is not None:
            metric_cards_right.append(_metric_card("PIPELINE LENGTH", f"{pipeline} km", pipeline_note, TEAL))
        if sites is not None:
            metric_cards_left.append(_metric_card("NUMBER OF SITES", str(sites), "", CYAN))

        for i in range(max(len(metric_cards_left), len(metric_cards_right))):
            left = metric_cards_left[i] if i < len(metric_cards_left) else Spacer(1, 1)
            right = metric_cards_right[i] if i < len(metric_cards_right) else Spacer(1, 1)
            story.append(Table(
                [[left, right]],
                colWidths=[(PAGE_W - 2 * MARGIN) / 2] * 2,
                style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                   ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]),
            ))
        metric_cards_left.clear()
        metric_cards_right.clear()

        hazard_scenarios = qra.get("hazard_scenarios", [])
        if hazard_scenarios:
            story.append(Spacer(1, 10))
            story.append(Paragraph("Hazard Scenarios to Model", styles["h2"]))
            story.extend(_bullet_list(hazard_scenarios, styles))
            story.append(Spacer(1, 6))

        consequence = qra.get("consequence_modeling", [])
        if consequence:
            story.append(Paragraph("Consequence Modeling Required", styles["h2"]))
            story.extend(_bullet_list(consequence, styles))
            story.append(Spacer(1, 6))

        risk_criteria = qra.get("risk_criteria")
        if risk_criteria:
            story.append(Paragraph(f"<b>Risk Criteria:</b> {risk_criteria}", styles["body"]))

    # Render any leftover metric cards (for other study types)
    if metric_cards_left or metric_cards_right:
        for i in range(max(len(metric_cards_left), len(metric_cards_right))):
            left = metric_cards_left[i] if i < len(metric_cards_left) else Spacer(1, 1)
            right = metric_cards_right[i] if i < len(metric_cards_right) else Spacer(1, 1)
            story.append(Table(
                [[left, right]],
                colWidths=[(PAGE_W - 2 * MARGIN) / 2] * 2,
                style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0),
                                   ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                   ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                                   ("BOTTOMPADDING", (0, 0), (-1, -1), 8)]),
            ))

    # ── Page 3: Deliverables & Timeline ──
    story.append(PageBreak())
    story.extend(_section_header("Deliverables Required", styles))
    deliverables = scope_data.get("deliverables", [])
    if deliverables:
        for i, item in enumerate(deliverables, 1):
            if item and item.strip():
                story.append(Paragraph(f"<b>{i}.</b>  {item.strip()}", styles["bullet"]))
    else:
        story.append(Paragraph("Refer to bid document for deliverables.", styles["body"]))
    story.append(Spacer(1, 14))

    # Timeline
    story.extend(_section_header("Timeline & Schedule", styles))
    timeline_weeks = scope_data.get("timeline_weeks")
    timeline_note = scope_data.get("timeline_note", "")
    submit_deadline = scope_data.get("submission_deadline", "")
    study_deadline = scope_data.get("study_completion_deadline", "")

    if timeline_weeks:
        story.append(Table(
            [[_metric_card("STUDY DURATION", f"{timeline_weeks} Weeks", (timeline_note or "")[:80], AMBER)]],
            colWidths=[PAGE_W / 2 - MARGIN],
            style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0), ("LEFTPADDING", (0, 0), (-1, -1), 0)]),
        ))
        story.append(Spacer(1, 10))
    elif timeline_note:
        story.append(Paragraph(f"<b>Duration:</b> {timeline_note}", styles["body"]))

    sched_rows = []
    if submit_deadline:
        sched_rows.append(["Bid Submission Deadline", submit_deadline])
    if study_deadline:
        sched_rows.append(["Study Completion Deadline", study_deadline])
    if sched_rows:
        sched_t = Table(sched_rows, colWidths=[6 * cm, PAGE_W - 2 * MARGIN - 6 * cm])
        sched_t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 10),
            ("TEXTCOLOR", (0, 0), (0, -1), MID_GREY),
            ("TEXTCOLOR", (1, 0), (1, -1), NAVY),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, -1), (-1, -1), 0.6, colors.HexColor("#cbd5e1")),
        ]))
        story.append(sched_t)
    story.append(Spacer(1, 14))

    # Manpower requirements
    manpower = scope_data.get("manpower_requirements", [])
    if manpower:
        story.append(Paragraph("Manpower / Team Requirements", styles["h2"]))
        story.extend(_bullet_list(manpower, styles))
        story.append(Spacer(1, 10))

    # ── Page 4: Financial Intelligence ──
    story.append(PageBreak())
    story.extend(_section_header("Financial Intelligence", styles))

    price_data = scope_data.get("buyer_price_estimate", {})
    has_estimate = price_data.get("has_estimate", False)

    if has_estimate and price_data.get("amount_text"):
        story.append(Paragraph(
            "Buyer's Estimated Value",
            ParagraphStyle("FinLabel", fontName="Helvetica-Bold", fontSize=10, textColor=MID_GREY, spaceAfter=6),
        ))
        # Big price card
        amount_text = price_data.get("amount_text", "Not Specified")
        estimate_type = price_data.get("estimate_type", "").replace("_", " ").title()
        story.append(Table(
            [[_metric_card(
                f"BUYER ESTIMATE ({estimate_type})" if estimate_type else "BUYER ESTIMATE",
                amount_text,
                (price_data.get("context") or "")[:100],
                EMERALD,
            )]],
            colWidths=[PAGE_W - 2 * MARGIN],
            style=TableStyle([("TOPPADDING", (0, 0), (-1, -1), 0), ("LEFTPADDING", (0, 0), (-1, -1), 0)]),
        ))
        story.append(Spacer(1, 14))

        # EMD separately if present
        emd = price_data.get("emd_amount_text")
        if emd:
            story.append(Paragraph(f"<b>Earnest Money Deposit (EMD):</b> {emd}", styles["body"]))
            story.append(Spacer(1, 8))

        context = price_data.get("context")
        if context:
            story.append(Paragraph("<b>Context from document:</b>", styles["h2"]))
            story.append(Paragraph(context, styles["body"]))
    else:
        story.append(Paragraph(
            "No explicit buyer price estimate found in the bid documents. "
            "Pricing will need to be determined based on scope complexity and market rates.",
            styles["body"],
        ))
        story.append(Spacer(1, 10))
        story.append(Paragraph(
            "<b>Note:</b> Always check the official GEM portal for any financial schedule or EMD requirements "
            "not captured in the downloadable documents.",
            ParagraphStyle("Note", fontName="Helvetica-Oblique", fontSize=9,
                           textColor=colors.HexColor("#64748b"), leading=14),
        ))
    story.append(Spacer(1, 14))

    # Standards & codes referenced
    standards = scope_data.get("standards_referenced", [])
    if standards:
        story.extend(_section_header("Standards & Codes Referenced", styles))
        story.extend(_bullet_list(standards, styles))
        story.append(Spacer(1, 14))

    # ── Page 5: Qualification & Risks ──
    story.append(PageBreak())
    story.extend(_section_header("Qualification Requirements", styles))
    qualifications = scope_data.get("qualification_requirements", [])
    if qualifications:
        story.extend(_bullet_list(qualifications, styles))
    else:
        story.append(Paragraph("Refer to bid document for eligibility criteria.", styles["body"]))
    story.append(Spacer(1, 14))

    # Special requirements
    special = scope_data.get("special_requirements", [])
    if special:
        story.extend(_section_header("Special Requirements & Conditions", styles))
        story.extend(_bullet_list(special, styles))
        story.append(Spacer(1, 14))

    # Complexity and key risks
    story.extend(_section_header("Complexity Assessment", styles))
    complexity_color_map = {
        "Low": "#10b981", "Medium": "#f59e0b",
        "High": "#f97316", "Very High": "#ef4444"
    }
    color_hex = complexity_color_map.get(complexity, "#f59e0b")
    story.append(Paragraph(
        f'Complexity Rating: <font color="{color_hex}"><b>{complexity}</b></font>',
        ParagraphStyle("CompRating", fontName="Helvetica-Bold", fontSize=13, spaceAfter=6),
    ))
    complexity_reason = scope_data.get("complexity_reasoning", "")
    if complexity_reason:
        story.append(Paragraph(complexity_reason, styles["body"]))
    story.append(Spacer(1, 10))

    key_risks = scope_data.get("key_risks_for_bidder", [])
    if key_risks:
        story.append(Paragraph("Key Risks for Bidder", styles["h2"]))
        story.extend(_bullet_list(key_risks, styles))
        story.append(Spacer(1, 10))

    estimated_effort = scope_data.get("estimated_effort_weeks")
    if estimated_effort:
        story.append(Paragraph(f"<b>Estimated Study Effort:</b> {estimated_effort} weeks", styles["body"]))

    doc.build(story)
    return output_path
