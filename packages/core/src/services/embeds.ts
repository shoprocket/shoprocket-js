import { ApiClient } from '../api';

export interface EmbedConfig {
  widgetType: string;
  themeCssUrl?: string;
  configuration: Record<string, any>;
  store?: {
    publishableKey: string;
    [key: string]: any;
  };
}

export class EmbedsService {
  constructor(private api: ApiClient) {}

  /**
   * Get embed configuration by ID
   * @param embedId - The embed ID (e.g., "embed_catalog_abc123")
   * @returns Embed configuration including widget type, theme, and settings
   */
  async getConfig(embedId: string): Promise<EmbedConfig> {
    const response = await this.api.get<any>(`/embeds/${embedId}/config`);
    return response.data || response;
  }
}
