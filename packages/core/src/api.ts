import type { ApiResponse } from './types';

export type { ApiResponse } from './types';

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  referrer?: string;
  affiliate_ref?: string;
}

export interface ApiConfig {
  apiUrl: string;
  publishableKey: string;
  locale?: string;
  cartToken?: string;
  visitorId?: string;
}

export class ApiClient {
  private config: ApiConfig;
  private authToken?: string;
  private attribution?: Attribution;

  constructor(config: ApiConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/$/, '') // Remove trailing slash
    };
  }

  setCartToken(token: string) {
    this.config.cartToken = token;
  }

  setVisitorId(id: string) {
    this.config.visitorId = id;
  }

  getVisitorId(): string | undefined {
    return this.config.visitorId;
  }

  setLocale(locale: string) {
    this.config.locale = locale;
  }

  getLocale(): string {
    return this.config.locale || 'en';
  }

  setAttribution(attribution: Attribution) {
    this.attribution = attribution;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    if (this.config.cartToken) {
      headers['X-Cart-Token'] = this.config.cartToken;
    }

    if (this.config.visitorId) {
      headers['X-Visitor-Id'] = this.config.visitorId;
    }

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (this.config.locale) {
      headers['Accept-Language'] = this.config.locale;
    }

    // Attribution headers (read by Laravel on first cart interaction)
    if (this.attribution) {
      if (this.attribution.utm_source) headers['X-UTM-Source'] = this.attribution.utm_source;
      if (this.attribution.utm_medium) headers['X-UTM-Medium'] = this.attribution.utm_medium;
      if (this.attribution.utm_campaign) headers['X-UTM-Campaign'] = this.attribution.utm_campaign;
      if (this.attribution.referrer) headers['X-Referrer'] = this.attribution.referrer;
      if (this.attribution.affiliate_ref) headers['X-Affiliate-Ref'] = this.attribution.affiliate_ref;
    }

    return headers;
  }

  private getUrl(endpoint: string): string {
    // Build the full URL
    const baseUrl = `${this.config.apiUrl}/public/${this.config.publishableKey}`;
    // Remove leading slash from endpoint
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
    return `${baseUrl}/${cleanEndpoint}`;
  }

  /** Retry on 5xx / network errors. Returns true if the error is retryable. */
  private static isRetryable(error: any): boolean {
    if (error.name === 'AbortError') return false;
    if (error.code === 'NETWORK_ERROR') return true;
    return typeof error.status === 'number' && error.status >= 500;
  }

  private static delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  private static readonly MAX_RETRIES = 2;
  private static readonly RETRY_DELAYS = [500, 1000];

  async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getUrl(endpoint);
    let lastError: any;

    for (let attempt = 0; attempt <= ApiClient.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers: {
            ...this.getHeaders(),
            ...options.headers,
          },
        });

        const data = await response.json();

        if (!response.ok) {
          const err = {
            message: data.error?.message || data.error || 'API request failed',
            code: data.error?.code,
            details: data.error?.details,
            status: response.status
          };
          if (response.status >= 500 && attempt < ApiClient.MAX_RETRIES) {
            lastError = err;
            await ApiClient.delay(ApiClient.RETRY_DELAYS[attempt]);
            continue;
          }
          throw err;
        }

        return data;
      } catch (error: any) {
        lastError = error;
        if (!ApiClient.isRetryable(error) || attempt >= ApiClient.MAX_RETRIES) {
          if (error.message) throw error;
          throw { message: 'Network error', code: 'NETWORK_ERROR' };
        }
        await ApiClient.delay(ApiClient.RETRY_DELAYS[attempt]);
      }
    }

    throw lastError;
  }

  private needsCartHeaders(endpoint: string): boolean {
    const e = endpoint.replace(/^\//, '');
    return e.startsWith('cart') || e.startsWith('account') || e.startsWith('orders') || e.startsWith('conversations');
  }

  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = this.getUrl(endpoint);

    // Only use CORS-safe headers for public read-only endpoints (no preflight).
    // Cart/account/order endpoints need X-Cart-Token and Authorization.
    const headers: HeadersInit = {
      'Accept': 'application/json'
    };

    if (this.config.locale) {
      headers['Accept-Language'] = this.config.locale;
    }

    if (this.needsCartHeaders(endpoint)) {
      if (this.config.cartToken) headers['X-Cart-Token'] = this.config.cartToken;
      if (this.config.visitorId) headers['X-Visitor-Id'] = this.config.visitorId;
      if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    let lastError: any;

    for (let attempt = 0; attempt <= ApiClient.MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(url, {
          ...options,
          method: 'GET',
          headers: {
            ...headers,
            ...(options?.headers || {})
          }
        });

        const data = await response.json();

        if (!response.ok) {
          const err = {
            message: data.error?.message || data.error || 'API request failed',
            code: data.error?.code,
            details: data.error?.details,
            status: response.status
          };
          if (response.status >= 500 && attempt < ApiClient.MAX_RETRIES) {
            lastError = err;
            await ApiClient.delay(ApiClient.RETRY_DELAYS[attempt]);
            continue;
          }
          throw err;
        }

        return data;
      } catch (error: any) {
        lastError = error;
        if (error.name === 'AbortError') throw error;
        if (!ApiClient.isRetryable(error) || attempt >= ApiClient.MAX_RETRIES) {
          if (error.message) throw error;
          throw { message: 'Network error', code: 'NETWORK_ERROR' };
        }
        await ApiClient.delay(ApiClient.RETRY_DELAYS[attempt]);
      }
    }

    throw lastError;
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }

  getStoreId(): string {
    return this.config.publishableKey;
  }

  getPublishableKey(): string {
    return this.config.publishableKey;
  }

  getApiUrl(): string {
    return this.config.apiUrl;
  }

  setAuthToken(token: string): void {
    this.authToken = token;
  }

  clearAuthToken(): void {
    this.authToken = undefined;
  }
}