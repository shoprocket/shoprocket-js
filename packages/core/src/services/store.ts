import { ApiClient } from '../api';
import type { Store } from '../types';

// Re-export types for backward compatibility
export type { Store } from '../types';

export class StoreService {
  constructor(private api: ApiClient) {}

  async get(): Promise<Store> {
    const response = await this.api.get<any>('/');
    return response.data || (response as any).store || response;
  }
}