import { ApiClient } from '../api';

export class ThemesService {
  constructor(private api: ApiClient) {}

  /**
   * Get theme CSS URL for a given theme name
   * @param storeId - Store ID (e.g., 'str_123')
   * @param themeName - Theme name (e.g., 'default', 'bubblegum')
   * @returns Full URL to theme CSS endpoint
   */
  getThemeCssUrl(storeId: string, themeName: string): string {
    return `${this.api.getApiUrl()}/stores/${storeId}/themes/${themeName}/css`;
  }

  /**
   * Fetch theme CSS content
   * @param storeId - Store ID
   * @param themeName - Theme name
   * @returns Theme CSS as string
   */
  async getThemeCss(storeId: string, themeName: string): Promise<string> {
    const response = await fetch(this.getThemeCssUrl(storeId, themeName));
    if (!response.ok) {
      throw new Error(`Failed to fetch theme CSS: ${response.statusText}`);
    }
    return response.text();
  }
}
