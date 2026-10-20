"""Deterministic Office-format and central-readiness regression tests."""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.tender_documents import (  # noqa: E402
    DocumentManifest, ExtractionStatus, analysis_document_text, analysis_gate,
    load_manifest, save_manifest,
)
from agents.bid_proposer_agent import BidProposerAgent  # noqa: E402


def _pdf(path: Path, text: str) -> None:
    document = canvas.Canvas(str(path))
    document.drawString(72, 720, text)
    document.save()


def _extract(manifest: DocumentManifest, bid_dir: Path, path: str, role: str = "SUPPORTING"):
    file_path = bid_dir / path
    document = manifest.discover(path, file_path.name, None, role)
    manifest.record_download(document, bid_dir, True)
    manifest.extract(document, bid_dir)
    return document


def test_docx_paragraph_heading_table_and_provenance(tmp_path: Path):
    docx = pytest.importorskip("docx")
    source = docx.Document()
    source.add_heading("Tender requirements", level=1)
    source.add_paragraph("Provide safety study methodology.")
    table = source.add_table(rows=2, cols=2)
    table.cell(0, 0).text, table.cell(0, 1).text = "Item", "Quantity"
    table.cell(1, 0).text, table.cell(1, 1).text = "HAZOP", "1"
    source.save(tmp_path / "terms.docx")
    document = _extract(DocumentManifest("DOCX"), tmp_path, "terms.docx")
    assert document.extraction_status == ExtractionStatus.EXTRACTED.value
    assert any(element.is_heading and element.block_index == 1 for element in document.elements)
    assert any(element.table_number == 1 and "HAZOP" in element.text for element in document.elements)
    assert document.page_count is None


def test_empty_and_corrupt_docx_fail(tmp_path: Path):
    docx = pytest.importorskip("docx")
    docx.Document().save(tmp_path / "empty.docx")
    empty = _extract(DocumentManifest("EMPTY"), tmp_path, "empty.docx")
    assert empty.extraction_status == ExtractionStatus.FAILED.value
    (tmp_path / "broken.docx").write_bytes(b"not a docx")
    broken = _extract(DocumentManifest("BROKEN"), tmp_path, "broken.docx")
    assert broken.extraction_status == ExtractionStatus.FAILED.value


def test_xlsx_sheets_rows_boq_and_provenance(tmp_path: Path):
    openpyxl = pytest.importorskip("openpyxl")
    workbook = openpyxl.Workbook()
    boq = workbook.active
    boq.title = "BOQ"
    boq.append(["Item Number", "Description", "Quantity", "Unit", "Rate"])
    boq.append(["1", "HAZOP study", 1, "LS", "=10+2"])
    notes = workbook.create_sheet("Notes")
    notes.append(["Submission", "30 days"])
    workbook.save(tmp_path / "boq.xlsx")
    document = _extract(DocumentManifest("XLSX"), tmp_path, "boq.xlsx")
    assert document.extraction_status == ExtractionStatus.EXTRACTED.value
    assert document.sheet_count == 2 and document.row_count == 3
    assert any(e.sheet_name == "BOQ" and e.row_number == 2 and e.cell_range == "A2:E2" for e in document.elements)
    assert any(e.is_boq_like and "HAZOP study" in e.text for e in document.elements)
    assert any("=10+2" in e.text for e in document.elements)


def test_empty_corrupt_xlsx_and_xls_are_not_successful(tmp_path: Path):
    openpyxl = pytest.importorskip("openpyxl")
    openpyxl.Workbook().save(tmp_path / "empty.xlsx")
    empty = _extract(DocumentManifest("EMPTY"), tmp_path, "empty.xlsx")
    assert empty.extraction_status == ExtractionStatus.FAILED.value
    (tmp_path / "broken.xlsx").write_bytes(b"not an xlsx")
    broken = _extract(DocumentManifest("BROKEN"), tmp_path, "broken.xlsx")
    assert broken.extraction_status == ExtractionStatus.FAILED.value
    (tmp_path / "legacy.xls").write_bytes(b"xls")
    legacy = _extract(DocumentManifest("XLS"), tmp_path, "legacy.xls")
    assert legacy.extraction_status == ExtractionStatus.UNSUPPORTED.value


def test_mixed_manifest_round_trip_and_incomplete_gate(tmp_path: Path):
    docx = pytest.importorskip("docx")
    openpyxl = pytest.importorskip("openpyxl")
    _pdf(tmp_path / "bid_document.pdf", "Primary tender")
    docx.Document().save(tmp_path / "support.docx")
    workbook = openpyxl.Workbook()
    workbook.active.append(["Item", "Description"])
    workbook.save(tmp_path / "boq.xlsx")
    manifest = DocumentManifest("MIXED")
    _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")
    _extract(manifest, tmp_path, "support.docx")
    _extract(manifest, tmp_path, "boq.xlsx")
    save_manifest(manifest, tmp_path)
    restored = load_manifest(tmp_path)
    assert restored and restored.manifest_version == 2
    assert restored.counts()["extracted"] == 2 and restored.counts()["failed"] == 1
    assert analysis_gate("MIXED", tmp_path)["analysis_incomplete"] is True
    primary_text, texts = analysis_document_text(restored)
    assert "Primary tender" in primary_text and "boq.xlsx" in texts


@pytest.mark.asyncio
async def test_blocked_package_prevents_proposal_llm_invocation(tmp_path: Path, monkeypatch):
    """The agent guard protects coordinator-triggered work as well as API routes."""
    _pdf(tmp_path / "bid_document.pdf", "")
    manifest = DocumentManifest("BLOCKED")
    _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")
    save_manifest(manifest, tmp_path)
    monkeypatch.setattr("agents.bid_proposer_agent.get_bid_dir", lambda _: tmp_path)
    agent = BidProposerAgent()

    async def should_not_call(*args, **kwargs):
        raise AssertionError("LLM must not be invoked for BLOCKED tender content")

    monkeypatch.setattr(agent, "_call_claude", should_not_call)
    result = await agent.prepare_proposal("BLOCKED")
    assert result["blocked"] is True
    assert result["readiness"]["status"] == "BLOCKED"
    assert result["readiness"]["affected_documents"][0]["extraction_status"] == "FAILED"
