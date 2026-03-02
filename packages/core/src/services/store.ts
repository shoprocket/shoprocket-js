import { ApiClient } from '../api';
import type { Store } from '../types';

// Re-export types for backward compatibility
export type { Store } from '../types';

export class StoreService {
  private cached?: Promise<Store>;

  constructor(private api: ApiClient) {}

  async get(): Promise<Store> {
    if (!this.cached) {
      this.cached = this.api.get<any>('/')
        .then(r => r.data || (r as any).store || r)
        .catch(e => { this.cached = undefined; throw e; });
    }
    return this.cached;
  }
}