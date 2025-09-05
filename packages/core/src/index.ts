/**
 * Shoprocket Core SDK
 * Lightweight API client for Shoprocket eCommerce platform
 */

export interface ShoprocketConfig {
  publicKey: string;
  apiUrl?: string;
  locale?: string;
  sessionToken?: string;
}

export interface ApiRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: Record<string, string>;
}

export class ShoprocketCore {
  private config: Required<ShoprocketConfig>;

  constructor(config: ShoprocketConfig) {
    this.config = {
      apiUrl: 'https://api.shoprocket.io/v3',
      locale: 'en',
      sessionToken: '',
      ...config
    };
  }

  /**
   * Make an API request
   */
  private async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const url = new URL(`${this.config.apiUrl}/public/${this.config.publicKey}${endpoint}`);
    
    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'Accept-Language': this.config.locale,
      ...options.headers
    };

    if (this.config.sessionToken) {
      headers['X-Session-Token'] = this.config.sessionToken;
    }

    const response = await fetch(url.toString(), {
      method: options.method || 'GET',
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  /**
   * Set session token
   */
  setSessionToken(token: string): void {
    this.config.sessionToken = token;
  }

  /**
   * Set locale
   */
  setLocale(locale: string): void {
    this.config.locale = locale;
  }

  /**
   * Get store information
   */
  async getStore() {
    return this.request<any>('/');
  }

  /**
   * Products API
   */
  products = {
    list: (params?: Record<string, any>) => 
      this.request<any>('/products', { query: params }),
    
    get: (id: string) => 
      this.request<any>(`/products/${id}`),
  };

  /**
   * Cart API
   */
  cart = {
    get: () => 
      this.request<any>('/cart'),
    
    addItem: (productId: string, quantity: number = 1, variantId?: string) =>
      this.request<any>('/cart/items', {
        method: 'POST',
        body: { product_id: productId, quantity, variant_id: variantId }
      }),
    
    updateItem: (itemId: string, quantity: number) =>
      this.request<any>(`/cart/items/${itemId}`, {
        method: 'PUT',
        body: { quantity }
      }),
    
    removeItem: (itemId: string) =>
      this.request<any>(`/cart/items/${itemId}`, {
        method: 'DELETE'
      }),
  };

  /**
   * Session API
   */
  session = {
    create: (data?: any) =>
      this.request<any>('/session', {
        method: 'POST',
        body: data || {
          user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
          entry_page: typeof window !== 'undefined' ? window.location.pathname : '',
          referrer: typeof document !== 'undefined' ? document.referrer : ''
        }
      }),
  };

  /**
   * SDK Strings API
   */
  strings = {
    get: (locale?: string) =>
      this.request<any>('/strings', {
        query: locale ? { locale } : undefined
      }),
  };
}

// Default export for convenience
export default ShoprocketCore;