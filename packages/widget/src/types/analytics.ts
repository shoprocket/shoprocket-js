/**
 * Analytics Event Type Definitions
 */

export interface EcommerceItem {
  item_id: string;
  item_name: string;
  category?: string;
  brand?: string;
  price: number;
  quantity: number;
  variant?: string;
  position?: number;
}

export interface ProductViewData {
  product_id: string;
  product_name: string;
  category?: string;
  price: number;
  currency: string;
}

export interface AddToCartData {
  currency: string;
  value: number;
  items: EcommerceItem[];
}

export interface RemoveFromCartData {
  currency: string;
  value: number;
  items: EcommerceItem[];
}

export interface BeginCheckoutData {
  currency: string;
  value: number;
  items: EcommerceItem[];
  coupon?: string;
}

export interface PurchaseData {
  transaction_id: string;
  currency: string;
  value: number;
  shipping?: number;
  tax?: number;
  coupon?: string;
  items: EcommerceItem[];
}

export interface ViewItemListData {
  item_list_id?: string;
  item_list_name: string;
  items: EcommerceItem[];
}

// All possible analytics events
export type AnalyticsEvent =
  | { name: 'page_view'; data: any }
  | { name: 'product_viewed'; data: ProductViewData }
  | { name: 'add_to_cart'; data: AddToCartData }
  | { name: 'remove_from_cart'; data: RemoveFromCartData }
  | { name: 'begin_checkout'; data: BeginCheckoutData }
  | { name: 'purchase'; data: PurchaseData }
  | { name: 'view_item_list'; data: ViewItemListData }
  | { name: 'cart_opened'; data: any }
  | { name: 'cart_closed'; data: any }
  | { name: 'search_performed'; data: { query: string; results_count: number } };

// Tracking configuration from API
export interface TrackingConfig {
  google_analytics?: {
    enabled: boolean;
    measurement_id: string;
    events?: string[];
  };
  facebook_pixel?: {
    enabled: boolean;
    pixel_id: string;
    events?: string[];
  };
  google_ads?: {
    enabled: boolean;
    conversion_id: string;
    events?: string[];
  };
}