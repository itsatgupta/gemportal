from __future__ import annotations
import asyncio
import logging
import re
from dataclasses import dataclass, field
from datetime import datetime

from playwright.async_api import async_playwright, Page

from config import GEM_PORTAL_URL

logger = logging.getLogger("anamac.tools.gem_scraper")


@dataclass
class BidResult:
    bid_number: str = ""
    title: str = ""
    department: str = ""
    start_date: str = ""
    deadline: str = ""
    value: str = ""
    detail_url: str = ""
    quantity: str = ""
    uom: str = ""
    items: str = ""
    bid_id: str = ""


async def search_bids(query: str, max_results: int = 20) -> list[BidResult]:
    """Search GEM portal for OPEN bids matching the query string.

    Only returns bids whose end date falls after the current date.
    Uses the 'ongoing_bids' filter on the GEM portal.
    """
    results: list[BidResult] = []

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        try:
            logger.info("Navigating to GEM portal: %s", GEM_PORTAL_URL)
            await page.goto(GEM_PORTAL_URL, wait_until="networkidle", timeout=60000)

            # Step 1: Ensure "Ongoing Bids" (open/active) filter is selected
            # The portal has a radio button #ongoing_bids for active bids
            ongoing_radio = page.locator("#ongoing_bids")
            if await ongoing_radio.count() > 0:
                await ongoing_radio.click()
                logger.info("Selected 'Ongoing Bids' filter")
                await page.wait_for_timeout(2000)

            # Step 2: Type search query into #searchBid input
            search_input = page.locator("#searchBid")
            if await search_input.count() == 0:
                # Fallback selectors
                search_input = page.locator("input[name='searchBid'], input[placeholder*='Search'], #search_input").first

            await search_input.fill(query)
            logger.info("Entered search query: %s", query)

            # Step 3: Click the search button #searchBidRA
            search_btn = page.locator("#searchBidRA")
            if await search_btn.count() > 0:
                await search_btn.click()
                logger.info("Clicked search button")
            else:
                await search_input.press("Enter")

            # Step 4: Wait for AJAX results to load (portal loads via /all-bids-data)
            # Wait for either bid cards to appear or a "no results" message
            try:
                await page.wait_for_selector("#bidCard .card, #bidCard .block, .no-result", timeout=15000)
            except Exception:
                # Fallback: just wait a fixed time
                await page.wait_for_timeout(5000)

            logger.info("Results loaded, parsing bid cards")

            # Step 5: Parse results - only open bids
            results = await _parse_bid_cards(page, max_results)

            # Step 6: If we need more results, paginate
            total_collected = len(results)
            if total_collected < max_results:
                # Check if there are more pages
                next_pages = page.locator("#light-pagination a, .pagination a")
                page_count = await next_pages.count()

                current_page = 1
                while total_collected < max_results and current_page < min(page_count, 5):
                    current_page += 1
                    try:
                        next_btn = page.locator(f"#light-pagination a:has-text('{current_page}')")
                        if await next_btn.count() > 0:
                            await next_btn.click()
                            await page.wait_for_timeout(3000)
                            page_results = await _parse_bid_cards(page, max_results - total_collected)
                            results.extend(page_results)
                            total_collected = len(results)
                    except Exception:
                        break

            logger.info("Found %d open bids for '%s'", len(results), query)

        except Exception as e:
            logger.error("Error searching bids: %s", e)
        finally:
            await browser.close()

    return results


async def _parse_bid_cards(page: Page, max_results: int) -> list[BidResult]:
    """Parse bid cards from the GEM portal results page.

    Only returns bids whose end date is in the future (open/active bids).
    """
    results: list[BidResult] = []
    now = datetime.now()

    # GEM portal bid cards are inside #bidCard container
    bid_cards = page.locator("#bidCard .card, #bidCard > div.border, #pagi_content .card")
    count = await bid_cards.count()

    if count == 0:
        # Try alternate selectors
        bid_cards = page.locator(".card, .bid-card, [data-bid]")
        count = await bid_cards.count()

    logger.debug("Found %d bid card elements on page", count)

    for i in range(min(count, max_results + 10)):  # Parse extra to account for filtering
        if len(results) >= max_results:
            break

        try:
            card = bid_cards.nth(i)
            bid = BidResult()

            # Extract bid number from .bid_no_hover link or .bid_no element
            bid_link = card.locator("a.bid_no_hover, a[href*='showbidDocument']").first
            if await bid_link.count() > 0:
                bid.bid_number = (await bid_link.inner_text()).strip()
                href = await bid_link.get_attribute("href")
                if href:
                    if href.startswith("http"):
                        bid.detail_url = href
                    elif href.startswith("/"):
                        bid.detail_url = "https://bidplus.gem.gov.in" + href
                    else:
                        bid.detail_url = "https://bidplus.gem.gov.in/" + href
            else:
                # Fallback: find bid number in full text
                text = await card.inner_text()
                bid_match = re.search(r"(GEM/\d{4}/B/\d+)", text)
                if bid_match:
                    bid.bid_number = bid_match.group(1).strip()

            if not bid.bid_number:
                continue

            # Extract data attributes if present
            bid_id = await card.get_attribute("data-bid")
            if bid_id:
                bid.bid_id = bid_id

            # Extract end date from .end_date element
            end_date_el = card.locator(".end_date, .end-date").first
            if await end_date_el.count() > 0:
                bid.deadline = (await end_date_el.inner_text()).strip()

            # Extract start date
            start_date_el = card.locator(".start_date, .start-date").first
            if await start_date_el.count() > 0:
                bid.start_date = (await start_date_el.inner_text()).strip()

            # --- OPEN BID CHECK: only include if end date is in the future ---
            if bid.deadline:
                if not _is_bid_open(bid.deadline, now):
                    continue

            # Extract department info from the middle column
            dept_el = card.locator(".col-md-5, .department").first
            if await dept_el.count() > 0:
                dept_text = (await dept_el.inner_text()).strip()
                bid.department = dept_text[:200]

            # Extract items/quantity from first column
            items_el = card.locator(".col-md-4").first
            if await items_el.count() > 0:
                items_text = (await items_el.inner_text()).strip()
                bid.items = items_text[:200]
                # Try to extract quantity
                qty_match = re.search(r"Quantity:\s*([\d,]+)", items_text, re.IGNORECASE)
                if qty_match:
                    bid.quantity = qty_match.group(1).strip()

            # Extract estimated bid value from the right column or card text
            value_el = card.locator(".col-md-3, .col-sm-3, .est_value, .bid-value").first
            if await value_el.count() > 0:
                value_text = (await value_el.inner_text()).strip()
                val_match = re.search(
                    r"(?:estimated\s+bid\s+value|estimated\s+value|bid\s+value|value)[^\d₹Rs.]*([\d,]+(?:\.\d+)?)",
                    value_text, re.IGNORECASE,
                )
                if val_match:
                    bid.value = "₹ " + val_match.group(1)

            # Fallback: scan full card text for a value pattern
            if not bid.value:
                full_text = await card.inner_text()
                val_match = re.search(
                    r"(?:estimated\s+bid\s+value|estimated\s+value|bid\s+value)[^\d₹Rs.]*([\d,]+(?:\.\d+)?)",
                    full_text, re.IGNORECASE,
                )
                if val_match:
                    bid.value = "₹ " + val_match.group(1)
                else:
                    # Last resort: find a standalone ₹ amount in the card
                    rupee_match = re.search(r"₹\s*([\d,]+(?:\.\d+)?)", full_text)
                    if rupee_match:
                        bid.value = "₹ " + rupee_match.group(1)

            # Use items description as the title (most descriptive field)
            if bid.items:
                # Clean up items text: extract just the item name
                items_clean = bid.items
                items_match = re.search(r"Items:\s*(.+?)(?:\nQuantity|\n|$)", items_clean, re.DOTALL)
                if items_match:
                    bid.title = items_match.group(1).strip()[:200]
                else:
                    bid.title = items_clean[:200]
            else:
                # Fallback: find a descriptive line from card text
                full_text = await card.inner_text()
                lines = [ln.strip() for ln in full_text.split("\n") if ln.strip()]
                skip_words = ("view", "date", "gem/", "department", "quantity", "corrigendum")
                for line in lines:
                    if len(line) > 15 and not any(w in line.lower() for w in skip_words):
                        bid.title = line[:200]
                        break

            results.append(bid)

        except Exception as e:
            logger.warning("Error parsing card %d: %s", i, e)
            continue

    return results


def _is_bid_open(deadline_str: str, now: datetime) -> bool:
    """Check if a bid's end date is in the future (bid is still open).

    GEM portal date formats:
      - "DD-MM-YYYY HH:MM AM/PM"
      - "DD-MM-YYYY"
      - Sometimes with timezone info like "(UTC)"
    """
    # Clean up the string
    clean = deadline_str.strip()
    # Remove parenthetical timezone like "(UTC)"
    clean = re.sub(r"\s*\(.*?\)\s*", " ", clean).strip()
    # Remove "End Date:" prefix if present
    clean = re.sub(r"(?i)^end\s*date\s*:?\s*", "", clean).strip()

    date_formats = [
        "%d-%m-%Y %I:%M %p",
        "%d-%m-%Y %H:%M",
        "%d-%m-%Y",
        "%d/%m/%Y %I:%M %p",
        "%d/%m/%Y %H:%M",
        "%d/%m/%Y",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d",
    ]

    for fmt in date_formats:
        try:
            end_dt = datetime.strptime(clean, fmt)
            return end_dt > now
        except ValueError:
            continue

    # If we can't parse the date, include the bid (benefit of the doubt)
    logger.debug("Could not parse date: '%s', including bid anyway", deadline_str)
    return True


async def check_bid_status_on_portal(bid_number: str) -> dict:
    """Search the GEM portal for a specific bid number and extract its live status and award info.

    Searches both ongoing and all bids (without filter) to detect closed/awarded bids.

    Returns a dict with keys:
      gem_status      — e.g. "Open", "Closed", "Under Evaluation", "Awarded", "Cancelled"
      awarded_to      — vendor/seller name if awarded, else None
      awarded_value   — awarded amount if shown, else None
      checked_at      — ISO timestamp of this check
    """
    from datetime import timezone

    result = {
        "gem_status": None,
        "awarded_to": None,
        "awarded_value": None,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }

    if not bid_number:
        return result

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            )
        )
        page = await context.new_page()

        try:
            logger.info("Checking GEM status for bid: %s", bid_number)
            await page.goto(GEM_PORTAL_URL, wait_until="networkidle", timeout=60000)
            await page.wait_for_timeout(1500)

            # ── Search for this specific bid number (no ongoing filter) ──────
            search_input = page.locator("#searchBid")
            if await search_input.count() == 0:
                search_input = page.locator("input[name='searchBid'], input[placeholder*='Search']").first

            await search_input.fill(bid_number)

            search_btn = page.locator("#searchBidRA")
            if await search_btn.count() > 0:
                await search_btn.click()
            else:
                await search_input.press("Enter")

            try:
                await page.wait_for_selector("#bidCard .card, #bidCard > div, .no-result", timeout=15000)
            except Exception:
                await page.wait_for_timeout(5000)

            # ── Check for "no result" message ────────────────────────────────
            page_text = await page.inner_text("body")
            page_text_lower = page_text.lower()

            no_result_el = page.locator(".no-result, .no-data, [class*='no-result']")
            has_no_result = await no_result_el.count() > 0

            # ── Count bid cards returned ─────────────────────────────────────
            bid_cards = page.locator("#bidCard .card, #bidCard > div.border, #pagi_content .card")
            card_count = await bid_cards.count()

            if has_no_result or card_count == 0:
                # Bid not found in ongoing — try without filter to see if it's closed/awarded
                # Click "All Bids" tab if available
                all_bids_tab = page.locator("#all_bids, label[for='all_bids'], input[value='all']")
                if await all_bids_tab.count() > 0:
                    await all_bids_tab.click()
                    await page.wait_for_timeout(2000)
                    card_count = await bid_cards.count()

            if card_count == 0:
                # Try to infer from page text keywords
                if any(k in page_text_lower for k in ("awarded", "contract awarded", "work awarded")):
                    result["gem_status"] = "Awarded"
                elif "under evaluation" in page_text_lower:
                    result["gem_status"] = "Under Evaluation"
                elif any(k in page_text_lower for k in ("cancelled", "withdrawn")):
                    result["gem_status"] = "Cancelled"
                else:
                    result["gem_status"] = "Closed"

                logger.info("No cards found for %s, inferred status: %s", bid_number, result["gem_status"])
                return result

            # ── Parse the first matching card ────────────────────────────────
            card = bid_cards.first
            card_text = await card.inner_text()
            card_text_lower = card_text.lower()

            # Check for status badge inside the card
            status_el = card.locator(".badge, [class*='status'], .bid-status, .label").first
            if await status_el.count() > 0:
                badge_txt = (await status_el.inner_text()).strip()
                if badge_txt and len(badge_txt) < 60:
                    result["gem_status"] = badge_txt

            # Infer status from card text if no badge found
            if not result["gem_status"]:
                if any(k in card_text_lower for k in ("awarded", "contract awarded")):
                    result["gem_status"] = "Awarded"
                elif "under evaluation" in card_text_lower:
                    result["gem_status"] = "Under Evaluation"
                elif any(k in card_text_lower for k in ("cancelled", "withdrawn")):
                    result["gem_status"] = "Cancelled"
                else:
                    # Check deadline to determine open vs closed
                    end_date_el = card.locator(".end_date, .end-date").first
                    if await end_date_el.count() > 0:
                        deadline_str = (await end_date_el.inner_text()).strip()
                        result["gem_status"] = "Open" if _is_bid_open(deadline_str, datetime.now()) else "Closed"
                    else:
                        result["gem_status"] = "Open"

            # ── Try to extract award details from card ───────────────────────
            award_patterns = [
                r"awarded\s+to[:\s]+([A-Za-z0-9 &.,\-()]{5,120})",
                r"seller[:\s]+([A-Za-z0-9 &.,\-()]{5,120})",
                r"vendor[:\s]+([A-Za-z0-9 &.,\-()]{5,120})",
                r"winner[:\s]+([A-Za-z0-9 &.,\-()]{5,120})",
            ]
            for pat in award_patterns:
                m = re.search(pat, card_text_lower)
                if m:
                    start = m.start(1)
                    result["awarded_to"] = card_text[start: start + len(m.group(1))].strip()
                    break

            val_m = re.search(
                r"awarded\s+(?:value|amount|price)[:\s₹INR]*([\d,. ]+(?:lakh|crore|cr)?)",
                card_text_lower,
            )
            if val_m:
                result["awarded_value"] = val_m.group(1).strip()

            logger.info("GEM status for %s: %s (awarded_to=%s)", bid_number, result["gem_status"], result["awarded_to"])

        except Exception as e:
            logger.error("Error checking bid status for %s: %s", bid_number, e)
            result["gem_status"] = "Check Failed"
        finally:
            await browser.close()

    return result


async def get_bid_document_url(detail_url: str) -> str | None:
    """Navigate to a bid detail page and find the primary bid document PDF link."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(detail_url, wait_until="networkidle", timeout=30000)

            # Look for PDF download links on the bid detail page
            pdf_links = page.locator(
                "a[href$='.pdf'], "
                "a[href*='download'], "
                "a[href*='document'], "
                "a[href*='bidDocument'], "
                "a.bid_doc_link"
            )
            count = await pdf_links.count()

            for i in range(count):
                href = await pdf_links.nth(i).get_attribute("href")
                if href and (".pdf" in href.lower() or "download" in href.lower()):
                    return href if href.startswith("http") else "https://bidplus.gem.gov.in" + href

        except Exception as e:
            logger.error("Error getting document URL: %s", e)
        finally:
            await browser.close()

    return None
