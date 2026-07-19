import { ApiClient } from '../api';
import type { Category, CategoryListParams, ListMeta } from '../types';

// Re-export types for backward compatibility
export type { Category, CategoryListParams } from '../types';

export class CategoriesService {
  private inflight = new Map<string, Promise<any>>();

  constructor(private api: ApiClient) {}

  /**
   * List the store's categories.
   *
   * The API returns a FLAT list, ordered, of categories that actually have active products; the
   * caller builds the tree from `parentId`. There is deliberately no server-side `isRoot` /
   * `parentId` filter: a storefront needs the whole tree to render breadcrumbs and child pills
   * anyway, so filtering server-side just costs an extra round trip to get the rest back.
   */
  async list(params?: CategoryListParams): Promise<{
    data: Category[];
    meta?: ListMeta;
  }> {
    const queryParams = new URLSearchParams();
    if (params?.page) queryParams.append('page', params.page.toString());
    if (params?.perPage) queryParams.append('perPage', params.perPage.toString());

    const query = queryParams.toString();
    const endpoint = query ? `/categories?${query}` : '/categories';

    const existing = this.inflight.get(endpoint);
    if (existing) return existing;

    const promise = this.api.get(endpoint)
      .then(response => { this.inflight.delete(endpoint); return response; })
      .catch(err => { this.inflight.delete(endpoint); throw err; });

    this.inflight.set(endpoint, promise);
    return promise;
  }

  async get(
    idOrSlug: string,
    params?: { include?: string; lang?: string }
  ): Promise<{ data: Category; meta?: any }> {
    const queryParams = new URLSearchParams();

    if (params?.include) {
      queryParams.append('include', params.include);
    }
    if (params?.lang) {
      queryParams.append('lang', params.lang);
    }

    const query = queryParams.toString();
    const endpoint = query ? `/categories/${idOrSlug}?${query}` : `/categories/${idOrSlug}`;

    const existing = this.inflight.get(endpoint);
    if (existing) return existing;

    const promise = this.api.get(endpoint)
      .then(response => { this.inflight.delete(endpoint); return response; })
      .catch(err => { this.inflight.delete(endpoint); throw err; });

    this.inflight.set(endpoint, promise);
    return promise;
  }
}
