/**
 * API Response Type Definitions
 */

export interface Money {
  amount: number;
  currency: string;
  formatted: string;
  inclusive?: boolean;
  note?: string;
}

export interface Media {
  id: string;
  url?: string;
  path?: string;
  filename?: string;
  name?: string;
  transformations?: string;
}

export interface ProductVariant {
  id: string;
  name?: string;
  price: Money;
  media_id?: string;
  option_values?: string[]; // API returns this instead of option_value_ids
  option_value_ids?: string[];
  inventory_count?: number;
  inventory_policy?: 'deny' | 'continue';
}

export interface ProductOption {
  id: string;
  name: string;
  values: Array<{
    id: string;
    value: string;
  }>;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  summary?: string;
  description?: string;
  price: Money;
  price_min?: number;
  price_max?: number;
  media: Media[];
  variants?: ProductVariant[];
  options?: ProductOption[];
  quick_add_eligible?: boolean;
  default_variant_id?: string;
  track_inventory: boolean;
  in_stock?: boolean;
  inventory_count?: number;
  has_variants?: boolean;
  variant_count?: number;
  has_required_options?: boolean;
  category?: string;
  brand?: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  variant_id?: string;
  variant_name?: string;
  quantity: number;
  price: Money;
  media?: Media[];
  inventory_count?: number;
  inventory_policy?: 'deny' | 'continue';
}

export interface CartTotals {
  subtotal: Money;
  tax: Money;
  shipping: Money;
  discount?: Money;
  total: Money;
}

export interface Cart {
  id: string;
  items: CartItem[];
  totals: CartTotals;
  currency: string;
  item_count: number;
  visitor_country?: string;
  has_checkout_data?: boolean;
  has_billing_address?: boolean;
  has_shipping_address?: boolean;
  requires_shipping?: boolean;
}

export interface Store {
  id: string;
  name: string;
  currency: string;
  locale: string;
  tracking?: {
    google_analytics?: {
      enabled: boolean;
      measurement_id: string;
    };
    facebook_pixel?: {
      enabled: boolean;
      pixel_id: string;
    };
    google_ads?: {
      enabled: boolean;
      conversion_id: string;
    };
  };
}

export interface Session {
  session_token: string;
  expires_at?: string;
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
    };
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}