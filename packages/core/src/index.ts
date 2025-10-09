/**
 * Shoprocket Core SDK
 * Lightweight API client for Shoprocket eCommerce platform
 */

import { ApiClient } from './api';
import { SessionService } from './services/session';
import { ProductsService } from './services/products';
import { CartService } from './services/cart';
import { StoreService } from './services/store';
import { AuthService } from './services/auth';
import { LocationService } from './services/location';
import { CategoriesService } from './services/categories';

export interface ShoprocketConfig {
  publicKey: string;
  apiUrl?: string;
  locale?: string;
  cartToken?: string;
}

export class ShoprocketCore {
  private config: ShoprocketConfig;
  private api: ApiClient;
  
  public session: SessionService;
  public products: ProductsService;
  public cart: CartService;
  public store: StoreService;
  public auth: AuthService;
  public location: LocationService;
  public categories: CategoriesService;

  constructor(config: ShoprocketConfig) {
    this.config = {
      apiUrl: 'https://api.shoprocket.io/v3',
      locale: 'en',
      ...config
    };

    // Initialize API client
    this.api = new ApiClient({
      apiUrl: this.config.apiUrl!,
      publishableKey: this.config.publicKey,
      locale: this.config.locale,
      cartToken: this.config.cartToken
    });

    // Initialize services
    this.session = new SessionService(this.api);
    this.products = new ProductsService(this.api);
    this.cart = new CartService(this.api);
    this.store = new StoreService(this.api);
    this.auth = new AuthService(this.api);
    this.location = new LocationService(this.api);
    this.categories = new CategoriesService(this.api);
  }

  /**
   * Set cart token
   */
  setCartToken(token: string): void {
    this.config.cartToken = token;
    this.api.setCartToken(token);
  }

  /**
   * Set locale
   */
  setLocale(locale: string): void {
    this.config.locale = locale;
    this.api.setLocale(locale);
  }

  /**
   * Get current configuration
   */
  getConfig(): ShoprocketConfig {
    return { ...this.config };
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.config.apiUrl!;
  }

  /**
   * Legacy method for backward compatibility
   */
  async getStore() {
    return this.store.get();
  }

  /**
   * Get the publishable key
   */
  getPublishableKey(): string {
    return this.api.getPublishableKey();
  }

  /**
   * Set auth token
   */
  setAuthToken(token: string): void {
    this.api.setAuthToken(token);
  }

  /**
   * Clear auth token
   */
  clearAuthToken(): void {
    this.api.clearAuthToken();
  }
}

// Export types
export * from './api';
export * from './services/session';
export * from './services/products';
export * from './services/cart';
export * from './services/store';
export * from './services/auth';
export * from './services/location';
export * from './services/categories';

// Default export for convenience
export default ShoprocketCore;