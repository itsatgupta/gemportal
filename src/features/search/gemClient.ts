import axios, { type AxiosInstance } from 'axios';
import { GemPortalError } from '../../shared/errors/index.js';
import { createChildLogger } from '../../shared/utils/logger.js';
import { withRetry, type RetryOptions } from '../../shared/utils/retry.js';

const logger = createChildLogger('gemClient');

export interface GemSession {
  csrfToken: string;
  cookies: string[];
}

export class GemClient {
  private session: GemSession | null = null;
  private http: AxiosInstance;
  private baseUrl: string;
  private retryOptions: RetryOptions;

  constructor(options: {
    baseUrl: string;
    retryOptions: RetryOptions;
    requestDelayMs?: number;
  }) {
    this.baseUrl = options.baseUrl;
    this.retryOptions = options.retryOptions;
    this.http = axios.create({
      baseURL: options.baseUrl,
      timeout: 30_000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  }

  async initSession(): Promise<void> {
    logger.info('Initializing GEM portal session');
    const response = await withRetry(
      () =>
        this.http.get('/all-bids', {
          headers: {
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
        }),
      this.retryOptions,
    );

    const html = response.data as string;
    const rawCookies = response.headers['set-cookie'] ?? [];
    const cookies = this.extractCookies(rawCookies);

    // Extract CSRF token using multiple strategies
    let csrfToken: string | null = null;

    // Strategy 1: From csrf_gem_cookie (most reliable - directly from set-cookie)
    for (const c of rawCookies) {
      const m = c.match(/csrf_gem_cookie=([a-f0-9]+)/);
      if (m) {
        csrfToken = m[1];
        break;
      }
    }

    // Strategy 2: Hardcoded in JS AJAX data object
    if (!csrfToken) {
      const patterns = [
        /'csrf_bd_gem_nk'\s*:\s*'([a-f0-9]+)'/,
        /"csrf_bd_gem_nk"\s*:\s*"([a-f0-9]+)"/,
        /csrf_bd_gem_nk['"]\s*[,:]\s*['"]([\w]+)['"]/,
      ];
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match) {
          csrfToken = match[1];
          break;
        }
      }
    }

    if (!csrfToken) {
      throw new GemPortalError(
        'Could not extract CSRF token from GEM portal',
      );
    }

    this.session = { csrfToken, cookies };
    logger.info(
      { csrfToken: csrfToken.slice(0, 8) + '...' },
      'GEM session initialized',
    );
  }

  private extractCookies(setCookieHeaders: string[]): string[] {
    return setCookieHeaders.map((c) => c.split(';')[0]);
  }

  private async ensureSession(): Promise<GemSession> {
    if (!this.session) {
      await this.initSession();
    }
    return this.session!;
  }

  async searchBids(payload: Record<string, unknown>): Promise<string> {
    const session = await this.ensureSession();

    const makeRequest = async () => {
      const formBody = new URLSearchParams();
      formBody.append('payload', JSON.stringify(payload));
      formBody.append('csrf_bd_gem_nk', session.csrfToken);

      return this.http.post('/all-bids-data', formBody.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-Requested-With': 'XMLHttpRequest',
          Cookie: session.cookies.join('; '),
          Referer: `${this.baseUrl}/all-bids`,
          Origin: this.baseUrl,
        },
      });
    };

    try {
      const response = await withRetry(() => makeRequest(), this.retryOptions);
      const data = response.data;
      return typeof data === 'string' ? data : JSON.stringify(data);
    } catch (err) {
      // If CSRF expired, refresh session and retry once
      if (
        axios.isAxiosError(err) &&
        (err.response?.status === 403 || err.response?.status === 419)
      ) {
        logger.warn('CSRF token expired, refreshing session');
        this.session = null;
        await this.ensureSession();
        const response = await makeRequest();
        const data = response.data;
        return typeof data === 'string' ? data : JSON.stringify(data);
      }
      throw new GemPortalError(`Search request failed: ${err}`);
    }
  }

  async getBidDetailPage(bidId: string): Promise<string> {
    const session = await this.ensureSession();

    const response = await withRetry(
      () =>
        this.http.get(`/showbidDocument/${bidId}`, {
          headers: {
            Cookie: session.cookies.join('; '),
          },
        }),
      this.retryOptions,
    );

    return response.data as string;
  }

  async downloadFile(url: string): Promise<Buffer> {
    const session = await this.ensureSession();

    const requestUrl = url.startsWith('http')
      ? url
      : `${this.baseUrl}${url}`;

    const response = await withRetry(
      () =>
        axios.get(requestUrl, {
          responseType: 'arraybuffer',
          headers: {
            Cookie: session.cookies.join('; '),
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          },
          maxRedirects: 5,
          timeout: 60_000,
        }),
      this.retryOptions,
    );

    return Buffer.from(response.data);
  }
}