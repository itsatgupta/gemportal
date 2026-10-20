import type { Agent, AgentContext, AgentResult } from '../../shared/types/agent.js';
import type { BidSearchFilters, BidSearchResult } from '../../shared/types/bid.js';
import { GemClient } from './gemClient.js';
import { parseBidSearchResults, parseTotalResults } from './parser.js';
import { eventBus } from '../../orchestrator/eventBus.js';

export interface SearchInput {
  filters: BidSearchFilters;
}

export interface SearchOutput {
  results: BidSearchResult[];
  total: number;
  page: number;
}

export class SearchAgent implements Agent<SearchInput, SearchOutput> {
  name = 'search';
  private client: GemClient;

  constructor(client: GemClient) {
    this.client = client;
  }

  async execute(
    input: SearchInput,
    ctx: AgentContext,
  ): Promise<AgentResult<SearchOutput>> {
    const start = Date.now();
    const { filters } = input;

    try {
      eventBus.emitProgress(this.name, ctx.bidId, 'Searching GEM portal...', 10);

      // Build the search payload matching GEM portal's EXACT expected format
      const payload = this.buildPayload(filters);

      eventBus.emitProgress(this.name, ctx.bidId, 'Fetching results...', 40);
      const responseData = await this.client.searchBids(payload);

      eventBus.emitProgress(this.name, ctx.bidId, 'Parsing results...', 70);
      const results = parseBidSearchResults(responseData);
      const total = parseTotalResults(responseData);

      eventBus.emitProgress(
        this.name,
        ctx.bidId,
        `Found ${results.length} bids`,
        100,
      );

      return {
        success: true,
        data: {
          results,
          total: total || results.length,
          page: filters.page ?? 1,
        },
        errors: [],
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        errors: [
          {
            code: 'SEARCH_FAILED',
            message: err instanceof Error ? err.message : String(err),
          },
        ],
        durationMs: Date.now() - start,
      };
    }
  }

  /**
   * Build payload matching GEM portal's exact structure:
   * { page, param: { searchBid, searchType }, filter: { bidStatusType, byType, ... } }
   */
  private buildPayload(filters: BidSearchFilters): Record<string, unknown> {
    // Default to ongoing_bids (open bids not yet closed)
    const payload: Record<string, unknown> = {
      page: filters.page ?? 1,
      param: {
        searchBid: filters.searchText,
        searchType: filters.searchType === 'exact' ? 'exact' : 'fullText',
      },
      filter: {
        bidStatusType: 'ongoing_bids',
        byType: this.mapBidType(filters.bidTypes),
        highBidValue: filters.highValueOnly ? 'yes' : '',
        byEndDate: {
          from: filters.fromEndDate ?? '',
          to: filters.toEndDate ?? '',
        },
        byStatus: '',
        sort: 'Bid-End-Date-Latest',
      },
    };

    return payload;
  }

  private mapBidType(bidTypes?: string[]): string {
    if (!bidTypes || bidTypes.length === 0) return 'all';
    // GEM expects a single type string, use the first selected
    return bidTypes[0];
  }
}
