import { ApiClient } from '../api';
import type { EmbedConfig } from '../types';

// Re-export types for backward compatibility
export type { EmbedConfig } from '../types';

export class EmbedsService {
  private inflight = new Map<string, Promise<EmbedConfig>>();

  constructor(private api: ApiClient) {}

  /**
   * Get embed configuration by ID
   * @param embedId - The embed ID (e.g., "embed_catalog_abc123")
   * @returns Embed configuration including widget type, theme, and settings
   */
  async getConfig(embedId: string): Promise<EmbedConfig> {
    const existing = this.inflight.get(embedId);
    if (existing) return existing;

    const promise = this.api.get<any>(`/embeds/${embedId}/config`)
      .then(r => { this.inflight.delete(embedId); return r.data || r; })
      .catch(e => { this.inflight.delete(embedId); throw e; });

    this.inflight.set(embedId, promise);
    return promise;
  }
}
