# Tender document provenance foundation

Each bid folder can contain `document_manifest.json`. It is the durable inventory
of tender-package documents and is intentionally stored beside the existing bid
files rather than in a new database.

`TenderDocument` records a stable document ID, tender ID, original and stored
names, source URL when known, role, MIME type, file size, SHA-256 hash,
discovery/download/extraction timestamps, parser, expected and extracted page
counts, element/sheet/row counts, warnings, errors, suitability, and extracted
content. Every PDF page text entry is associated with its document and its
1-indexed PDF page.

Extraction state is explicit: `DISCOVERED`, `DOWNLOADED`, `EXTRACTED`,
`PARTIALLY_EXTRACTED`, `UNSUPPORTED`, and `FAILED`. A blank or unreadable PDF
is `FAILED`; it is never represented as a successful document with no content.

The manifest also exposes document/page counts and a deterministic readiness
decision:

- `READY`: every discovered document is fully extracted.
- `INCOMPLETE`: the usable primary document was extracted, but another document
  is partial, unsupported, or failed and needs manual handling.
- `BLOCKED`: the primary tender document is absent, not yet extracted,
  unsupported, failed, or empty.

DOCX extraction records ordered paragraphs/headings and tables by block and
table number without fabricated page numbers. XLSX extraction records workbook
rows by sheet, row, and cell range; formulas remain literal cell content and
are never evaluated. Deterministic BOQ detection marks sheets whose first
non-empty row contains at least two common BOQ headers. Archive member,
uncompressed-size, and file-size limits are applied before Office parsing.
Legacy `.xls` and `.doc` remain explicitly `UNSUPPORTED` because no safe parser
is included.

Tender-backed proposal, assessment, and scope analysis use the same readiness
gate. `BLOCKED` prevents the AI call and returns affected-document diagnostics.
`INCOMPLETE` can proceed for compatibility, but outputs are marked incomplete
and not submission-ready or approved.

**Absence of extracted text is not proof that a tender contains no requirement.**
