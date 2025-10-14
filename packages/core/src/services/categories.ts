import { ApiClient } from '../api';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  parent_id: string | null;
  level: number;
  sort_order: number;
  products_count: number;
  image_url: string | null;
  meta_title: string | null;
  meta_description: string | null;
  children?: Category[];
  parent?: {
    id: string;
    name: string;
    slug: string;
    level: number;
  };
  created_at: string;
  updated_at: string;
}

export interface CategoryListParams {
  filter?: {
    id?: string | string[];
    parent_id?: string;
    is_root?: boolean;
    status?: string;
    slug?: string | string[];
  };
  include?: string; // 'children,parent'
  sort?: string;
  page?: number;
  per_page?: number;
  lang?: string;
}

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
              // Multiple values: filter[key][]=val1&filter[key][]=val2
              value.forEach(val => {
                queryParams.append(`filter[${key}][]`, val);
              });
            } else if (key === 'is_root' && typeof value === 'boolean') {
              // Boolean: filter[is_root]=true
              queryParams.append('filter[is_root]', value.toString());
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
      if (params.per_page) queryParams.append('per_page', params.per_page.toString());
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
