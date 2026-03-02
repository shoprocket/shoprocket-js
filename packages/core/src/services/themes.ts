import { ApiClient } from '../api';

export class ThemesService {
  private cache = new Map<string, Promise<string>>();

  constructor(private api: ApiClient) {}

  /**
   * Get theme CSS URL for a given theme name
   * @param themeName - Theme name (e.g., 'default', 'bubblegum')
   * @returns Full URL to theme CSS endpoint
   */
  getThemeCssUrl(themeName: string): string {
    return `${this.api.getApiUrl()}/public/${this.api.getPublishableKey()}/themes/${themeName}/css`;
  }

  /**
   * Fetch theme CSS content
   * @param themeName - Theme name
   * @returns Theme CSS as string
   */
  async getThemeCss(themeName: string): Promise<string> {
    const existing = this.cache.get(themeName);
    if (existing) return existing;

    const promise = fetch(this.getThemeCssUrl(themeName))
      .then(r => {
        if (!r.ok) throw new Error(`Failed to fetch theme CSS: ${r.statusText}`);
        return r.text();
      })
      .catch(e => { this.cache.delete(themeName); throw e; });

    this.cache.set(themeName, promise);
    return promise;
  }
}
