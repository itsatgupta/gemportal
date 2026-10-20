"""Pytest-based test suite for the ANAMAC Bid Intelligence Platform."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Ensure backend is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from main import app  # noqa: E402
from tools.file_manager import get_bid_dir, list_all_bids, list_bid_files, list_company_docs  # noqa: E402
from agents.bid_proposer_agent import _is_ai_related_bid, _build_document_references  # noqa: E402


client = TestClient(app)

# ---------------------------------------------------------------------------
# Health & connectivity
# ---------------------------------------------------------------------------


class TestHealth:
    def test_root(self):
        r = client.get("/")
        assert r.status_code == 200
        body = r.json()
        assert body["name"] == "ANAMAC Bid Intelligence Platform"
        assert "agents" in body

    def test_health(self):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


# ---------------------------------------------------------------------------
# Agent status
# ---------------------------------------------------------------------------


class TestAgents:
    def test_agent_status(self):
        r = client.get("/api/agents/status")
        assert r.status_code == 200
        data = r.json()
        agents = data["agents"]
        assert "search_agent" in agents
        assert "bid_proposer_agent" in agents
        assert "bid_assessor_agent" in agents

    def test_agent_messages(self):
        r = client.get("/api/agents/messages")
        assert r.status_code == 200
        assert isinstance(r.json()["messages"], list)


# ---------------------------------------------------------------------------
# Bid routes
# ---------------------------------------------------------------------------


class TestBids:
    def test_search_missing_query(self):
        r = client.post("/api/bids/search", json={})
        # FastAPI returns 422 for validation errors
        assert r.status_code == 422

    def test_list_bids(self):
        r = client.get("/api/bids/list")
        assert r.status_code == 200
        assert "bids" in r.json()

    def test_bid_document_not_found(self):
        r = client.get("/api/bids/NONEXISTENT_BID_999/document")
        assert r.status_code == 404
        assert r.json().get("detail")

    def test_package_not_found(self):
        r = client.get("/api/bids/NONEXISTENT_BID_999/package")
        assert r.status_code == 404
        assert r.json().get("detail")


# ---------------------------------------------------------------------------
# Proposal routes
# ---------------------------------------------------------------------------


class TestProposals:
    def test_prepare_requires_bid_number(self):
        r = client.post("/api/proposals/prepare", json={})
        assert r.status_code == 422

    def test_revise_requires_bid_number(self):
        r = client.post("/api/proposals/revise", json={})
        assert r.status_code == 422


# ---------------------------------------------------------------------------
# Assessment routes
# ---------------------------------------------------------------------------


class TestAssessments:
    def test_gaps_no_bid(self):
        r = client.get("/api/assessments/NONEXISTENT_BID_999/gaps")
        assert r.status_code == 200
        # Should return empty gaps
        assert isinstance(r.json().get("gaps", []), list)

    def test_summary_no_bid(self):
        r = client.get("/api/assessments/NONEXISTENT_BID_999/summary")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# File management tools
# ---------------------------------------------------------------------------


class TestFileManager:
    def test_list_all_bids(self):
        bids = list_all_bids()
        assert isinstance(bids, list)

    def test_list_company_docs(self):
        docs = list_company_docs()
        assert isinstance(docs, list)

    def test_get_bid_dir_creates_directory(self, tmp_path, monkeypatch):
        import config
        monkeypatch.setattr(config, "BIDS_BASE_DIR", tmp_path)
        import tools.file_manager as fm
        monkeypatch.setattr(fm, "BIDS_BASE_DIR", tmp_path)

        bid_dir = fm.get_bid_dir("TEST_BID_001")
        assert bid_dir.exists()
        assert bid_dir.name == "TEST_BID_001"

    def test_list_bid_files_structure(self, tmp_path, monkeypatch):
        import config
        import tools.file_manager as fm
        monkeypatch.setattr(config, "BIDS_BASE_DIR", tmp_path)
        monkeypatch.setattr(fm, "BIDS_BASE_DIR", tmp_path)

        files = fm.list_bid_files("TEST_BID_FILES")
        assert "bid_document" in files
        assert "supporting_docs" in files
        assert "bid_proposal" in files
        assert "assessor_summary" in files


# ---------------------------------------------------------------------------
# Gap report schema validation
# ---------------------------------------------------------------------------


class TestGapSchema:
    VALID_GAP = {
        "gap_id": "GAP-001",
        "severity": "Critical",
        "section": "Technical Approach",
        "description": "Missing methodology",
        "recommendation": "Add detailed methodology",
        "status": "open",
    }
    REQUIRED_FIELDS = {"gap_id", "severity", "section", "description", "recommendation", "status"}
    VALID_SEVERITIES = {"Critical", "Major", "Minor"}

    def test_valid_gap_has_all_fields(self):
        for field in self.REQUIRED_FIELDS:
            assert field in self.VALID_GAP

    def test_severity_values(self):
        assert self.VALID_GAP["severity"] in self.VALID_SEVERITIES

    def test_gap_json_roundtrip(self):
        serialized = json.dumps([self.VALID_GAP])
        parsed = json.loads(serialized)
        assert len(parsed) == 1
        assert parsed[0]["gap_id"] == "GAP-001"


# ---------------------------------------------------------------------------
# AI bid support
# ---------------------------------------------------------------------------


class TestAIBidSupport:
    def test_ai_bid_classifier(self):
        ai_text = "The solution shall use artificial intelligence, machine learning, and a vector database."
        assert _is_ai_related_bid(ai_text) is True

    def test_non_ai_bid_classifier(self):
        non_ai_text = "Provide facility housekeeping and security guard services."
        assert _is_ai_related_bid(non_ai_text) is False

    def test_ai_profile_document_reference(self):
        references = _build_document_references("The bidder must demonstrate AI and machine learning experience.")
        assert "AMD_AI_Profile.pdf" in references


# ---------------------------------------------------------------------------
# Existing bid data validation (if bids exist)
# ---------------------------------------------------------------------------


class TestExistingBids:
    """Tests that validate data integrity for any bids already downloaded."""

    def test_existing_bid_pdfs_are_valid(self):
        bids = list_all_bids()
        for bid_name in bids:
            bid_dir = get_bid_dir(bid_name)
            pdf = bid_dir / "bid_document.pdf"
            if pdf.exists():
                content = pdf.read_bytes()
                assert len(content) > 100, f"PDF too small: {pdf}"
                assert content[:5] == b"%PDF-", f"Invalid PDF header: {pdf}"

    def test_existing_bid_folder_structure(self):
        bids = list_all_bids()
        for bid_name in bids:
            files = list_bid_files(bid_name)
            # If bid_document exists, supporting_docs should be a list
            assert isinstance(files["supporting_docs"], list)


# ---------------------------------------------------------------------------
# Full package ZIP (integration)
# ---------------------------------------------------------------------------


class TestFullPackage:
    def test_zip_for_existing_bid(self):
        bids = list_all_bids()
        if not bids:
            pytest.skip("No bids downloaded yet")

        bid = bids[0]
        r = client.get(f"/api/bids/{bid}/package")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/zip"
        assert len(r.content) > 0
