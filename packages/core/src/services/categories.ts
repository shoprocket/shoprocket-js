import { ApiClient } from '../api';

export interface Category {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
  productsCount: number;
  imageUrl: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  children?: Category[];
  parent?: {
    id: string;
    name: string;
    slug: string;
    level: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CategoryListParams {
  filter?: {
    id?: string | string[];
    parentId?: string;
    isRoot?: boolean;
    status?: string;
    slug?: string | string[];
  };
  include?: string; // 'children,parent'
  sort?: string;
  page?: number;
  perPage?: number;
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
