/**
 * Core API Type Definitions
 * Single source of truth for all Shoprocket API types
 */

// ============================================================================
// Common Types
// ============================================================================

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
  alt?: string;
  isVideo?: boolean;
  aspectRatio?: number;
}

// ============================================================================
// Product Types
// ============================================================================

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
  name?: string;
  sku?: string;
  price: Money;
  mediaId?: string;
  optionValues?: string[];
  optionValueIds?: string[];
  inventoryCount?: number;
  inventoryPolicy?: 'deny' | 'continue';
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  summary?: string;
  description?: string;
  fullDescription?: string;
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
  status?: string;
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
  include?: string;
}

// ============================================================================
// Category Types
// ============================================================================

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
  include?: string;
  sort?: string;
  page?: number;
  perPage?: number;
  lang?: string;
}

// ============================================================================
// Cart Types
// ============================================================================

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
  // Order fields for post-checkout state
  orderStatus?: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'cancelled' | 'failed';
  orderDetails?: {
    orderId: string;
    orderNumber?: string;
    createdAt?: string;
    paymentMethod?: string;
  };
  orderId?: string;
}

export interface AddToCartParams {
  productId: string;
  variantId?: string;
  quantity?: number;
}

export interface UpdateCartItemParams {
  itemId: string;
  quantity: number;
}

// ============================================================================
// Store Types
// ============================================================================

export interface Store {
  id: string;
  name: string;
  currency: string;
  locale: string;
  baseCurrencyCode?: string;
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

// ============================================================================
// Session Types
// ============================================================================

export interface Session {
  id: string;
  sessionToken: string;
  visitorId: string;
  locale?: string;
  expiresAt?: string;
}

export interface CreateSessionData {
  userAgent?: string;
  entryPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmTerm?: string;
  utmContent?: string;
}

// ============================================================================
// Location Types
// ============================================================================

export interface Country {
  code: string;
  name: string;
  phoneCode?: string;
  currency?: string;
  requiresState?: boolean;
  flag?: string;
}

export interface State {
  code: string;
  name: string;
}

export interface CountriesResponse {
  success: boolean;
  data: {
    countries: Country[];
    locale: string;
  };
}

export interface StatesResponse {
  success: boolean;
  data: {
    country: {
      code: string;
      name: string;
    };
    states: State[];
  };
}

export interface LocationData {
  country: Country;
  currency?: string;
  locale?: string;
}

// ============================================================================
// Embed Types
// ============================================================================

export interface CatalogConfiguration {
  colorScheme?: 'auto' | 'light' | 'dark';
  displayMode?: 'grid' | 'carousel';
  detailMode?: 'inline' | 'modal';
  filterMode?: 'all' | 'categories' | 'products';
  categories?: string;
  products?: string;
  limit?: number;
  columns?: number;
  columnsMd?: number;
  columnsSm?: number;
  routable?: boolean;
  filterPosition?: 'top' | 'left';
  arrows?: boolean;
  dots?: boolean;
  infinite?: boolean;
  features?: string[] | Record<string, boolean>;
}

export interface EmbedConfig {
  widgetType: string;
  theme?: string;
  themeCssUrl?: string;
  configuration: CatalogConfiguration | Record<string, any>;
  store?: {
    publishableKey: string;
    [key: string]: any;
  };
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    perPage?: number;
    pagination?: {
      total: number;
      count: number;
      perPage: number;
      currentPage: number;
      totalPages: number;
    };
    // Additional meta fields
    currency?: string;
    country?: string;
    locale?: string;
    displayMode?: string;
    priceMin?: number; // Store-wide minimum price (for filter bounds)
    priceMax?: number; // Store-wide maximum price (for filter bounds)
    paymentUrl?: string;
    paymentGateway?: string;
    testMode?: boolean;
    message?: string;
    links?: {
      first?: string;
      prev?: string | null;
      next?: string | null;
      last?: string;
    };
  };
  error?: {
    message: string;
    code?: string;
  };
}

export interface ApiError {
  message: string;
  errors?: Record<string, string[]>;
  code?: string;
}
