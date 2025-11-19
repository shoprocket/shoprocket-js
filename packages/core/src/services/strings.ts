import type { ApiClient } from '../api';

export interface StringsResponse {
  locale: string;
  fallback_locale: string;
  strings: Record<string, string>;
}

/**
 * Service for fetching and managing localized strings
 */
export class StringsService {
  private strings: Record<string, string> = {};
  private loading = false;
  private loaded = false;

  constructor(private api: ApiClient) {}

  /**
   * Load strings from API (non-blocking)
   * Call this in background after widget initialization
   */
  async load(): Promise<void> {
    if (this.loading || this.loaded) {
      return;
    }

    this.loading = true;

    try {
      const locale = this.api.getLocale() || 'en';
      const url = `${this.api.getApiUrl()}/public/${this.api.getPublishableKey()}/strings?locale=${locale}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load strings: ${response.statusText}`);
      }

      const data = await response.json();

      // API returns nested data.strings structure
      if (data.data && data.data.strings) {
        this.strings = data.data.strings;
        this.loaded = true;
      }
    } catch (error) {
      console.warn('Failed to load localized strings, using fallbacks:', error);
      // Don't throw - widget should work with fallbacks
    } finally {
      this.loading = false;
    }
  }

  /**
   * Get a localized string by key
   * @param key - String key (e.g., 'cart.add_to_cart')
   * @param fallback - English fallback if string not found
   * @returns Localized string or fallback
   */
  get(key: string, fallback: string): string {
    return this.strings[key] ?? fallback;
  }

  /**
   * Check if strings have been loaded
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Check if strings are currently loading
   */
  isLoading(): boolean {
    return this.loading;
  }
}
