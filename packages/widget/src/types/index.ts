export interface Price {
  amount?: number;
  amount_cents?: number;
  currency?: string;
}

export interface Product {
  id: string;
  name: string;
  slug?: string;
  price: Price;
  summary?: string;
  description?: string;
  media?: Media[];
  variants?: Variant[];
  options?: ProductOption[];
  quick_add_eligible?: boolean;
  default_variant_id?: string;
}

export interface Media {
  id: string;
  path?: string;
  url?: string;
}

export interface Variant {
  id: string;
  name?: string;
  price?: {
    amount: number;
    currency: string;
  };
  media_id?: string;
  option_values?: string[];
  option_value_ids?: string[];
}

export interface ProductOption {
  id: string;
  name: string;
  values: OptionValue[];
}

export interface OptionValue {
  id: string;
  name: string;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name?: string;
  variant_id?: string;
  variant_name?: string;
  price: number;
  quantity: number;
  media?: Media[];
}

export interface Cart {
  id: string;
  items: CartItem[];
  totals: {
    subtotal: number;
    tax: number;
    shipping: number;
    discount: number;
    total: number;
  };
  currency: string;
  item_count: number;
}