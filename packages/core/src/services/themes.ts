import { ApiClient } from '../api';

export class ThemesService {
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
    const response = await fetch(this.getThemeCssUrl(themeName));
    if (!response.ok) {
      throw new Error(`Failed to fetch theme CSS: ${response.statusText}`);
    }
    return response.text();
  }
}
