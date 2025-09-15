export interface ApiConfig {
  apiUrl: string;
  publishableKey: string;
  locale?: string;
  sessionToken?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
  meta?: {
    total?: number;
    page?: number;
    per_page?: number;
  };
}

export class ApiClient {
  private config: ApiConfig;

  constructor(config: ApiConfig) {
    this.config = {
      ...config,
      apiUrl: config.apiUrl.replace(/\/$/, '') // Remove trailing slash
    };
  }

  setSessionToken(token: string) {
    this.config.sessionToken = token;
  }

  setLocale(locale: string) {
    this.config.locale = locale;
  }

  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    };

    if (this.config.sessionToken) {
      headers['X-Session-Token'] = this.config.sessionToken;
    }

    if (this.config.locale) {
      headers['Accept-Language'] = this.config.locale;
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

  async get<T = any>(endpoint: string): Promise<T> {
    // For GET requests, use simple headers to avoid preflight
    const url = this.getUrl(endpoint);
    
    try {
      const headers: HeadersInit = {
        'Accept': 'application/json',
      };
      
      if (this.config.sessionToken) {
        headers['X-Session-Token'] = this.config.sessionToken;
      }
      
      if (this.config.locale) {
        headers['Accept-Language'] = this.config.locale;
      }
      
      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          message: data.error?.message || data.error || 'API request failed',
          code: data.error?.code,
          status: response.status
        };
      }

      return data;
    } catch (error: any) {
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
}