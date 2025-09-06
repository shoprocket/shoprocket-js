import { ApiClient } from '../api';

export interface Store {
  id: string;
  name: string;
  slug: string;
  description?: string;
  currency_code: string;
  locale: string;
  timezone: string;
  logo?: {
    url: string;
  };
  settings?: {
    [key: string]: any;
  };
}

export class StoreService {
  constructor(private api: ApiClient) {}

  async get(): Promise<Store> {
    const response = await this.api.get<any>('/');
    return response.data || (response as any).store || response;
  }
}