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
  price: number | { amount: number; amountCents: number };
  inventoryQuantity: number;
  optionValues: string[];
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  summary?: string;
  fullDescription?: string;
  price: number | { amount: number; amountCents: number };
  priceMin?: number;
  priceMinCents?: number;
  hasVariants: boolean;
  quickAddEligible: boolean;
  defaultVariantId?: string;
  hasStock: boolean;
  media?: ProductMedia[];
  options?: ProductOption[];
  variants?: ProductVariant[];
}

export interface ProductListParams {
  page?: number;
  perPage?: number;
  sort?: string;
  category?: string | string[];
  products?: string | string[];
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  include?: string; // e.g., 'categories' or 'categories,variants'
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
            // Handle filter[category] format - comma-separated values
            const categoryValue = Array.isArray(value) ? value.join(',') : value.toString();
            queryParams.append('filter[category]', categoryValue);
          } else if (key === 'products') {
            // Handle filter[ids] format - comma-separated product slugs or IDs
            const productsValue = Array.isArray(value) ? value.join(',') : value.toString();
            queryParams.append('filter[ids]', productsValue);
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
          } else if (key === 'minPrice') {
            // Price min uses filter[priceMin] format (convert to cents)
            queryParams.append('filter[priceMin]', (Number(value) * 100).toString());
          } else if (key === 'maxPrice') {
            // Price max uses filter[priceMax] format (convert to cents)
            queryParams.append('filter[priceMax]', (Number(value) * 100).toString());
          } else if (key === 'inStock') {
            // In stock uses filter[inStock] format
            queryParams.append('filter[inStock]', value ? 'true' : 'false');
          } else if (key === 'include') {
            // Include related resources (e.g., 'categories', 'categories,variants')
            queryParams.append('include', value.toString());
          } else if (key === 'perPage') {
            // Per page param
            queryParams.append('perPage', value.toString());
          } else {
            // Standard params (page)
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