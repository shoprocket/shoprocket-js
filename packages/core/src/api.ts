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

  async request<T = any>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = this.getUrl(endpoint);
    
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
        throw {
          message: data.error?.message || data.error || 'API request failed',
          code: data.error?.code,
          details: data.error?.details,
          status: response.status
        };
      }

      return data;
    } catch (error: any) {
      // Re-throw structured errors
      if (error.message) {
        throw error;
      }
      
      // Handle network errors
      throw {
        message: 'Network error',
        code: 'NETWORK_ERROR'
      };
    }
  }

  async get<T = any>(endpoint: string, options?: RequestInit): Promise<T> {
    // For GET requests, use simple headers to avoid preflight
    const url = this.getUrl(endpoint);

    try {
      const headers: HeadersInit = {
        'Accept': 'application/json'
      };

      if (this.config.cartToken) {
        headers['X-Cart-Token'] = this.config.cartToken;
      }

      if (this.authToken) {
        headers['Authorization'] = `Bearer ${this.authToken}`;
      }

      if (this.config.locale) {
        headers['Accept-Language'] = this.config.locale;
      }

      if (this.attribution) {
        if (this.attribution.utm_source) headers['X-UTM-Source'] = this.attribution.utm_source;
        if (this.attribution.utm_medium) headers['X-UTM-Medium'] = this.attribution.utm_medium;
        if (this.attribution.utm_campaign) headers['X-UTM-Campaign'] = this.attribution.utm_campaign;
        if (this.attribution.referrer) headers['X-Referrer'] = this.attribution.referrer;
        if (this.attribution.affiliate_ref) headers['X-Affiliate-Ref'] = this.attribution.affiliate_ref;
      }
      
      const response = await fetch(url, {
        ...options, // Allow passing signal and other options
        method: 'GET',
        headers: {
          ...headers,
          ...(options?.headers || {})
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.error?.message || data.error || 'API request failed',
          code: data.error?.code,
          details: data.error?.details,
          status: response.status
        };
      }

      return data;
    } catch (error: any) {
      // Check if it's an abort error
      if (error.name === 'AbortError') {
        throw error; // Re-throw abort errors as-is
      }
      
      if (error.message) {
        throw error;
      }
      throw {
        message: 'Network error',
        code: 'NETWORK_ERROR'
      };
    }
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