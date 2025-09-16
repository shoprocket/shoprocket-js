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
  category?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
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
          queryParams.append(key, value.toString());
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