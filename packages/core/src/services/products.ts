import { ApiClient } from '../api';

export interface ProductMedia {
  id: string;
  path: string;
  type: string;
  alt?: string;
}

export interface ProductOption {
  id: string;
  name: string;
  values: Array<{
    id: string;
    value: string;
  }>;
}

export interface ProductVariant {
  id: string;
  sku?: string;
  price: number | { amount: number; amount_cents: number };
  inventory_quantity: number;
  option_values: string[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  full_description?: string;
  price: number | { amount: number; amount_cents: number };
  price_min?: number;
  price_min_cents?: number;
  has_variants: boolean;
  quick_add_eligible: boolean;
  default_variant_id?: string;
  has_stock: boolean;
  media?: ProductMedia[];
  options?: ProductOption[];
  variants?: ProductVariant[];
}

export interface ProductListParams {
  page?: number;
  per_page?: number;
  sort?: string;
  category?: string | string[];
  search?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
}

export class ProductsService {
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
            // Handle filter[category] format
            if (Array.isArray(value)) {
              // Multiple: filter[category][]=val1&filter[category][]=val2
              value.forEach(cat => {
                queryParams.append('filter[category][]', cat);
              });
            } else {
              // Single: filter[category]=val
              queryParams.append('filter[category]', value.toString());
            }
          } else if (key === 'search') {
            // Search uses filter[search] format
            queryParams.append('filter[search]', value.toString());
          } else if (key === 'sort') {
            // Convert sort format: "name_asc" -> "name", "name_desc" -> "-name"
            const sortValue = value.toString();
            if (sortValue.endsWith('_desc')) {
              queryParams.append('sort', '-' + sortValue.replace('_desc', ''));
            } else if (sortValue.endsWith('_asc')) {
              queryParams.append('sort', sortValue.replace('_asc', ''));
            } else {
              queryParams.append('sort', sortValue);
            }
          } else if (key === 'min_price') {
            // Price min uses filter[price_min] format (convert to cents)
            queryParams.append('filter[price_min]', (Number(value) * 100).toString());
          } else if (key === 'max_price') {
            // Price max uses filter[price_max] format (convert to cents)
            queryParams.append('filter[price_max]', (Number(value) * 100).toString());
          } else if (key === 'in_stock') {
            // In stock uses filter[in_stock] format
            queryParams.append('filter[in_stock]', value ? 'true' : 'false');
          } else {
            // Standard params (page, per_page)
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
    const response = await this.api.get<any>(endpoint, options);
    
    return response.data || response;
  }
}