from __future__ import annotations
import asyncio
import logging
import re
from pathlib import Path
from urllib.parse import urljoin

import httpx
from PyPDF2 import PdfReader

from config import MAX_DOWNLOAD_RETRIES, DOWNLOAD_TIMEOUT_SECONDS

logger = logging.getLogger("anamac.tools.pdf_downloader")


async def download_pdf(url: str, dest: Path) -> bool:
    """Download a PDF from a URL to the destination path. Returns True on success."""
    dest.parent.mkdir(parents=True, exist_ok=True)

    for attempt in range(MAX_DOWNLOAD_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=DOWNLOAD_TIMEOUT_SECONDS, follow_redirects=True) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                dest.write_bytes(resp.content)
                return True
        except Exception as e:
            logger.warning("Attempt %d failed for %s: %s", attempt + 1, url, e)
            if attempt < MAX_DOWNLOAD_RETRIES - 1:
                await asyncio.sleep(2)

    return False


def extract_hyperlinks(pdf_path: Path) -> list[str]:
    """Extract all hyperlinks from a PDF file."""
    links: list[str] = []

    try:
        reader = PdfReader(str(pdf_path))
        for page in reader.pages:
            if "/Annots" in page:
                annotations = page["/Annots"]
                for annot in annotations:
                    obj = annot.get_object()
                    if obj.get("/Subtype") == "/Link":
                        action = obj.get("/A")
                        if action and "/URI" in action:
                            uri = action["/URI"]
                            if uri and isinstance(uri, str):
                                links.append(uri)
    except Exception as e:
        logger.warning("Error extracting links from %s: %s", pdf_path, e)

    # Also try regex on raw text for URLs that aren't annotated
    try:
        reader = PdfReader(str(pdf_path))
        for page in reader.pages:
            text = page.extract_text() or ""
            url_pattern = r"https?://[^\s<>\"')\]]+"
            found = re.findall(url_pattern, text)
            links.extend(found)
    except Exception:
        pass

    # Deduplicate while preserving order
    seen = set()
    unique = []
    for link in links:
        if link not in seen:
            seen.add(link)
            unique.append(link)

    return unique


async def download_supporting_docs(links: list[str], dest_dir: Path) -> list[dict]:
    """Download all documents from a list of URLs. Returns list of {url, filename, success}."""
    dest_dir.mkdir(parents=True, exist_ok=True)
    results = []

    for i, url in enumerate(links):
        # Derive filename from URL
        filename = url.split("/")[-1].split("?")[0]
        if not filename or len(filename) > 200:
            filename = f"doc_{i}.pdf"
        if not filename.lower().endswith((".pdf", ".doc", ".docx", ".xls", ".xlsx", ".txt", ".csv", ".zip")):
            filename += ".pdf"

        dest_path = dest_dir / filename
        success = await download_pdf(url, dest_path)
        results.append({"url": url, "filename": filename, "success": success})

    return results
