import { ApiClient } from '../api';
import type { Category, CategoryListParams } from '../types';

// Re-export types for backward compatibility
export type { Category, CategoryListParams } from '../types';

export class CategoriesService {
  constructor(private api: ApiClient) {}

  async list(params?: CategoryListParams): Promise<{
    data: Category[];
    meta?: any;
    links?: any;
  }> {
    const queryParams = new URLSearchParams();

    if (params) {
      // Handle filters
      if (params.filter) {
        Object.entries(params.filter).forEach(([key, value]) => {
          if (value !== undefined) {
            if ((key === 'id' || key === 'slug') && Array.isArray(value)) {
              // Multiple values: filter[key]=val1,val2 (comma-separated)
              queryParams.append(`filter[${key}]`, value.join(','));
            } else if (key === 'isRoot' && typeof value === 'boolean') {
              // Boolean: filter[isRoot]=true
              queryParams.append('filter[isRoot]', value.toString());
            } else if (key === 'parentId') {
              // Parent ID filter
              queryParams.append('filter[parentId]', value.toString());
            } else {
              // Single value: filter[key]=value
              queryParams.append(`filter[${key}]`, value.toString());
            }
          }
        });
      }

      // Handle other params
      if (params.include) queryParams.append('include', params.include);
      if (params.sort) queryParams.append('sort', params.sort);
      if (params.page) queryParams.append('page', params.page.toString());
      if (params.perPage) queryParams.append('perPage', params.perPage.toString());
      if (params.lang) queryParams.append('lang', params.lang);
    }

    const response = await this.api.get(`/categories?${queryParams.toString()}`);
    return response;
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
    const url = query ? `/categories/${idOrSlug}?${query}` : `/categories/${idOrSlug}`;

    const response = await this.api.get(url);
    return response;
  }
}
