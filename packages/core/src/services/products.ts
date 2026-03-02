import { ApiClient } from '../api';
import type { Product, ProductListParams } from '../types';

// Re-export types for backward compatibility
export type { Product, ProductListParams } from '../types';

export class ProductsService {
  private inflight = new Map<string, Promise<Product>>();

  constructor(private api: ApiClient) {}

  async list(params?: ProductListParams): Promise<{
    data: Product[];
    meta?: any;
  }> {
    const queryParams = new URLSearchParams();

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          if (key === 'category') {
            const categoryValue = Array.isArray(value) ? value.join(',') : value.toString();
            queryParams.append('filter[category]', categoryValue);
          } else if (key === 'products') {
            const productsValue = Array.isArray(value) ? value.join(',') : value.toString();
            queryParams.append('filter[ids]', productsValue);
          } else if (key === 'search') {
            queryParams.append('filter[search]', value.toString());
          } else if (key === 'sort') {
            const sortValue = value.toString();
            if (sortValue.endsWith('_desc')) {
              queryParams.append('sort', '-' + sortValue.replace('_desc', ''));
            } else if (sortValue.endsWith('_asc')) {
              queryParams.append('sort', sortValue.replace('_asc', ''));
            } else {
              queryParams.append('sort', sortValue);
            }
          } else if (key === 'minPrice') {
            queryParams.append('filter[priceMin]', (Number(value) * 100).toString());
          } else if (key === 'maxPrice') {
            queryParams.append('filter[priceMax]', (Number(value) * 100).toString());
          } else if (key === 'inStock') {
            queryParams.append('filter[inStock]', value ? 'true' : 'false');
          } else if (key === 'include') {
            queryParams.append('include', value.toString());
          } else if (key === 'perPage') {
            queryParams.append('perPage', value.toString());
          } else {
            queryParams.append(key, value.toString());
          }
        }
      });
    }

    const endpoint = `/products${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.api.get<any>(endpoint);

    return {
      data: response.data || [],
      meta: response.meta
    };
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
