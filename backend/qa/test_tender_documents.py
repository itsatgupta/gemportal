"""Focused deterministic tests for tender document provenance."""
from __future__ import annotations

import sys
from pathlib import Path

from reportlab.pdfgen import canvas

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from tools.tender_documents import (  # noqa: E402
    DocumentManifest,
    ExtractionStatus,
    TenderReadiness,
    build_manifest_for_existing_bid,
    load_manifest,
    save_manifest,
)


def _pdf(path: Path, pages: list[str]) -> None:
    document = canvas.Canvas(str(path))
    for text in pages:
        if text:
            document.drawString(72, 720, text)
        document.showPage()
    document.save()


def _extract(manifest: DocumentManifest, bid_dir: Path, relative_path: str, role: str = "SUPPORTING"):
    file_path = bid_dir / relative_path
    document = manifest.discover(relative_path, file_path.name, "https://example.test/source", role)
    manifest.record_download(document, bid_dir, True)
    manifest.extract(document, bid_dir)
    return document


def test_successful_pdf_has_page_provenance_and_stable_hash(tmp_path: Path):
    pdf = tmp_path / "bid_document.pdf"
    _pdf(pdf, ["First requirement", "Second requirement"])
    manifest = DocumentManifest("GEM/TEST/1")

    document = _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")

    assert document.extraction_status == ExtractionStatus.EXTRACTED.value
    assert document.page_count == 2
    assert document.extracted_page_count == 2
    assert [(page.page_number, page.text) for page in document.pages] == [
        (1, "First requirement"),
        (2, "Second requirement"),
    ]
    first_hash = document.sha256
    manifest.record_download(document, tmp_path, True)
    assert document.sha256 == first_hash


def test_empty_pdf_is_failed_not_successful(tmp_path: Path):
    _pdf(tmp_path / "bid_document.pdf", [""])
    manifest = DocumentManifest("GEM/TEST/EMPTY")

    document = _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")

    assert document.extraction_status == ExtractionStatus.FAILED.value
    assert document.extracted_page_count == 0
    assert document.extraction_error == "PDF contains no extractable text"
    assert document.suitable_for_downstream_analysis is False


def test_unreadable_pdf_is_recorded_as_failed(tmp_path: Path):
    (tmp_path / "bid_document.pdf").write_bytes(b"not a PDF")
    manifest = DocumentManifest("GEM/TEST/BROKEN")

    document = _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")

    assert document.extraction_status == ExtractionStatus.FAILED.value
    assert document.extraction_error.startswith("PDF extraction failed:")


def test_corrupt_xlsx_is_explicitly_failed(tmp_path: Path):
    (tmp_path / "boq.xlsx").write_bytes(b"spreadsheet placeholder")
    manifest = DocumentManifest("GEM/TEST/UNSUPPORTED")

    document = _extract(manifest, tmp_path, "boq.xlsx")

    assert document.extraction_status == ExtractionStatus.FAILED.value
    assert document.parser_used == "openpyxl"
    assert document.suitable_for_downstream_analysis is False


def test_partially_extracted_pdf_preserves_successful_page(tmp_path: Path):
    _pdf(tmp_path / "bid_document.pdf", ["Readable page", ""])
    manifest = DocumentManifest("GEM/TEST/PARTIAL")

    document = _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")

    assert document.extraction_status == ExtractionStatus.PARTIALLY_EXTRACTED.value
    assert document.page_count == 2
    assert document.extracted_page_count == 1
    assert document.pages[0].page_number == 1
    assert "Page 2: no extractable text" in document.extraction_warnings


def test_manifest_counts_and_round_trip(tmp_path: Path):
    _pdf(tmp_path / "bid_document.pdf", ["Primary"])
    (tmp_path / "supporting_docs").mkdir()
    (tmp_path / "supporting_docs" / "boq.xlsx").write_bytes(b"xlsx")
    manifest = DocumentManifest("GEM/TEST/COUNTS")
    _extract(manifest, tmp_path, "bid_document.pdf", "PRIMARY")
    _extract(manifest, tmp_path, "supporting_docs/boq.xlsx")

    save_manifest(manifest, tmp_path)
    restored = load_manifest(tmp_path)

    assert restored is not None
    assert restored.counts() == {
        "discovered": 2,
        "downloaded": 2,
        "extracted": 1,
        "partially_extracted": 0,
        "unsupported": 0,
        "failed": 1,
        "expected_pages": 1,
        "extracted_pages": 1,
    }
    assert restored.documents[0].pages[0].page_number == 1


def test_readiness_ready_incomplete_and_blocked(tmp_path: Path):
    ready_dir = tmp_path / "ready"
    ready_dir.mkdir()
    _pdf(ready_dir / "bid_document.pdf", ["Primary"])
    ready = DocumentManifest("GEM/TEST/READY")
    _extract(ready, ready_dir, "bid_document.pdf", "PRIMARY")
    assert ready.readiness()["status"] == TenderReadiness.READY.value

    incomplete_dir = tmp_path / "incomplete"
    incomplete_dir.mkdir()
    _pdf(incomplete_dir / "bid_document.pdf", ["Primary"])
    (incomplete_dir / "terms.docx").write_bytes(b"not parsed yet")
    incomplete = DocumentManifest("GEM/TEST/INCOMPLETE")
    _extract(incomplete, incomplete_dir, "bid_document.pdf", "PRIMARY")
    _extract(incomplete, incomplete_dir, "terms.docx")
    assert incomplete.readiness()["status"] == TenderReadiness.INCOMPLETE.value

    blocked_dir = tmp_path / "blocked"
    blocked_dir.mkdir()
    _pdf(blocked_dir / "bid_document.pdf", [""])
    blocked = DocumentManifest("GEM/TEST/BLOCKED")
    _extract(blocked, blocked_dir, "bid_document.pdf", "PRIMARY")
    assert blocked.readiness()["status"] == TenderReadiness.BLOCKED.value


def test_legacy_bid_folder_can_gain_manifest_without_changing_existing_files(tmp_path: Path):
    _pdf(tmp_path / "bid_document.pdf", ["Legacy primary"])
    (tmp_path / "bid_metadata.json").write_text('{"detail_url": "https://example.test/bid"}', encoding="utf-8")

    manifest = build_manifest_for_existing_bid("GEM/TEST/LEGACY", tmp_path)

    assert (tmp_path / "bid_document.pdf").exists()
    assert (tmp_path / "document_manifest.json").exists()
    assert manifest.readiness()["status"] == TenderReadiness.READY.value
