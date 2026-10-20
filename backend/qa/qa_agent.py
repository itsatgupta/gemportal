from __future__ import annotations
"""QA Agent — Application Quality Assurance & Testing."""
import argparse
import asyncio
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import httpx
from config import BACKEND_URL, BIDS_BASE_DIR


class QAAgent:
    def __init__(self, backend_url: str = BACKEND_URL):
        self.backend_url = backend_url
        self.results: list[dict] = []

    async def run_suite(self):
        print("=" * 60)
        print("ANAMAC QA Agent - Running Test Suite")
        print("=" * 60)

        tests = [
            self.test_backend_health,
            self.test_agent_status_endpoint,
            self.test_bid_search_endpoint,
            self.test_bid_list_endpoint,
            self.test_folder_structure,
            self.test_proposal_endpoint,
            self.test_assessment_endpoint,
            self.test_messages_endpoint,
        ]

        for test in tests:
            name = test.__name__
            try:
                passed, detail = await test()
                status = "PASS" if passed else "FAIL"
            except Exception as e:
                passed, detail, status = False, str(e), "ERROR"

            self.results.append({"test": name, "status": status, "detail": detail})
            icon = "+" if passed else "x"
            print("  [" + icon + "] " + name + ": " + status + " - " + detail)

        # Summary
        total = len(self.results)
        passed_count = sum(1 for r in self.results if r["status"] == "PASS")
        print("\nResults: " + str(passed_count) + "/" + str(total) + " passed")

        # Write report
        self._write_report()
        return self.results

    async def test_backend_health(self):
        async with httpx.AsyncClient() as c:
            resp = await c.get(self.backend_url + "/health", timeout=5)
            ok = resp.status_code == 200 and resp.json().get("status") == "ok"
            return ok, "HTTP " + str(resp.status_code)

    async def test_agent_status_endpoint(self):
        async with httpx.AsyncClient() as c:
            resp = await c.get(self.backend_url + "/api/agents/status", timeout=5)
            data = resp.json()
            agents = data.get("agents", {})
            return len(agents) >= 3, str(len(agents)) + " agents registered"

    async def test_bid_search_endpoint(self):
        async with httpx.AsyncClient() as c:
            resp = await c.post(
                self.backend_url + "/api/bids/search",
                json={"query": "test", "max_results": 1},
                timeout=30,
            )
            return resp.status_code == 200, "HTTP " + str(resp.status_code)

    async def test_bid_list_endpoint(self):
        async with httpx.AsyncClient() as c:
            resp = await c.get(self.backend_url + "/api/bids/list", timeout=5)
            data = resp.json()
            return resp.status_code == 200, str(len(data.get("bids", []))) + " bids found"

    async def test_folder_structure(self):
        exists = BIDS_BASE_DIR.exists()
        return exists, "bids dir " + ("exists" if exists else "missing")

    async def test_proposal_endpoint(self):
        async with httpx.AsyncClient() as c:
            resp = await c.get(self.backend_url + "/api/proposals/test-bid", timeout=5)
            return resp.status_code == 200, "HTTP " + str(resp.status_code)

    async def test_assessment_endpoint(self):
        async with httpx.AsyncClient() as c:
            resp = await c.get(self.backend_url + "/api/assessments/test-bid/summary", timeout=5)
            return resp.status_code == 200, "HTTP " + str(resp.status_code)

    async def test_messages_endpoint(self):
        async with httpx.AsyncClient() as c:
            resp = await c.get(self.backend_url + "/api/agents/messages", timeout=5)
            return resp.status_code == 200, "HTTP " + str(resp.status_code)

    def _write_report(self):
        report_dir = Path(__file__).resolve().parent.parent.parent / "qa_reports" / datetime.now().strftime("%Y%m%d_%H%M%S")
        report_dir.mkdir(parents=True, exist_ok=True)

        # JSON report
        (report_dir / "results.json").write_text(json.dumps(self.results, indent=2))

        # HTML report
        passed_count = sum(1 for r in self.results if r["status"] == "PASS")
        total = len(self.results)
        rows = ""
        for r in self.results:
            cls = r["status"].lower()
            rows += '<tr class="' + cls + '"><td>' + r["test"] + '</td><td>' + r["status"] + '</td><td>' + r["detail"] + '</td></tr>'

        html = (
            '<!DOCTYPE html>\n<html><head><title>ANAMAC QA Report</title>\n'
            '<style>\n'
            'body { font-family: sans-serif; padding: 2rem; background: #0a0e1a; color: #e5e7eb; }\n'
            'h1 { color: #c9a84c; }\n'
            'table { border-collapse: collapse; width: 100%; }\n'
            'th, td { border: 1px solid #333; padding: 8px; text-align: left; }\n'
            'th { background: #1a2235; color: #c9a84c; }\n'
            '.pass { background: #064e3b; } .fail { background: #7f1d1d; } .error { background: #78350f; }\n'
            '</style></head>\n'
            '<body><h1>ANAMAC QA Report</h1><p>' + str(passed_count) + '/' + str(total) + ' tests passed</p>\n'
            '<table><tr><th>Test</th><th>Status</th><th>Detail</th></tr>' + rows + '</table></body></html>'
        )
        (report_dir / "report.html").write_text(html)
        print("\nReport saved to: " + str(report_dir))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="ANAMAC QA Agent")
    parser.add_argument("--run-suite", action="store_true", help="Run the full QA test suite")
    args = parser.parse_args()

    if args.run_suite:
        asyncio.run(QAAgent().run_suite())
    else:
        parser.print_help()
