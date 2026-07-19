import { ApiClient } from '../api';
import type { CatalogMeta, Product, ProductListParams } from '../types';

// Re-export types for backward compatibility
export type { Product, ProductListParams } from '../types';

export class ProductsService {
  private inflight = new Map<string, Promise<Product>>();

  constructor(private api: ApiClient) {}

  /**
   * List products.
   *
   * Query params are flat (`q`, `category`, `priceMin`…) rather than the `filter[key]` form the v3
   * Laravel API used. Prices go over the wire in integer CENTS, matching the rest of the API; the
   * component layer works in whole currency units, so the conversion happens here, once.
   */
  async list(params?: ProductListParams): Promise<{
    data: Product[];
    meta?: CatalogMeta;
  }> {
    const q = new URLSearchParams();
    const set = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === '') return;
      q.append(key, Array.isArray(value) ? value.join(',') : String(value));
    };

    if (params) {
      set('page', params.page);
      set('perPage', params.perPage);
      set('q', params.search);
      set('category', params.category);
      // A hand-picked embed: ids or slugs, both accepted server-side.
      set('ids', params.products);
      set('sort', ProductsService.wireSort(params.sort));
      if (params.minPrice !== undefined) set('priceMin', Math.round(Number(params.minPrice) * 100));
      if (params.maxPrice !== undefined) set('priceMax', Math.round(Number(params.maxPrice) * 100));
      // Only ever sent as an opt-in: `inStock=false` would read as "show me out-of-stock only".
      if (params.inStock) set('inStock', 'true');
    }

    const response = await this.api.get<any>(`/products${q.toString() ? `?${q}` : ''}`);
    return { data: response.data ?? [], meta: response.meta };
  }

  /** Map the component layer's `price_asc` / `price_desc` onto the API's `price` / `-price`. */
  private static wireSort(sort?: string): string | undefined {
    if (!sort) return undefined;
    if (sort.endsWith('_desc')) return `-${sort.slice(0, -5)}`;
    if (sort.endsWith('_asc')) return sort.slice(0, -4);
    return sort;
  }

  async get(productId: string, includes?: string[], options?: RequestInit): Promise<Product> {
    const queryParams = new URLSearchParams();

    if (includes && includes.length > 0) {
      queryParams.append('include', includes.join(','));
    }

    const endpoint = `/products/${productId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    // Deduplicate concurrent requests for the same endpoint
    const existing = this.inflight.get(endpoint);
    if (existing) return existing;

    const promise = this.api.get<any>(endpoint, options)
      .then(response => {
        this.inflight.delete(endpoint);
        return response.data || response;
      })
      .catch(err => {
        this.inflight.delete(endpoint);
        throw err;
      });

    this.inflight.set(endpoint, promise);
    return promise;
  }
}
