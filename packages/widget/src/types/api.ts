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
  mediaId?: string;
  optionValues?: string[]; // API returns this instead of optionValueIds
  optionValueIds?: string[];
  inventoryCount?: number;
  inventoryPolicy?: 'deny' | 'continue';
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
  priceMin?: number;
  priceMax?: number;
  media: Media[];
  variants?: ProductVariant[];
  options?: ProductOption[];
  quickAddEligible?: boolean;
  defaultVariantId?: string;
  trackInventory: boolean;
  inStock?: boolean;
  inventoryCount?: number;
  hasVariants?: boolean;
  variantCount?: number;
  hasRequiredOptions?: boolean;
  categories?: Array<{
    id: string;
    slug: string;
    name: string;
  }>;
  brand?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  price: Money;
  media?: Media[];
  inventoryCount?: number;
  inventoryPolicy?: 'deny' | 'continue';
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
  itemCount: number;
  visitorCountry?: string;
  hasCheckoutData?: boolean;
  hasBillingAddress?: boolean;
  hasShippingAddress?: boolean;
  requiresShipping?: boolean;
  // Order fields added for post-checkout state
  orderStatus?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'cancelled' | 'failed';
  orderDetails?: {
    orderId: string;
    orderNumber?: string;
    createdAt?: string;
    paymentMethod?: string;
  };
  orderId?: string;
}

export interface Store {
  id: string;
  name: string;
  currency: string;
  locale: string;
  tracking?: {
    googleAnalytics?: {
      enabled: boolean;
      measurementId: string;
    };
    facebookPixel?: {
      enabled: boolean;
      pixelId: string;
    };
    googleAds?: {
      enabled: boolean;
      conversionId: string;
    };
  };
}

export interface Session {
  sessionToken: string;
  expiresAt?: string;
}

// API Response wrappers
export interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      total: number;
      count: number;
      perPage: number;
      currentPage: number;
      totalPages: number;
    };
    // Payment-related meta fields
    paymentUrl?: string;
    paymentGateway?: string;
    testMode?: boolean;
    message?: string;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}