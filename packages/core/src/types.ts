/**
 * Core API Type Definitions
 * Single source of truth for all Shoprocket API types
 */

// ============================================================================
// Common Types
// ============================================================================

/**
 * Pagination sidecar returned alongside `data` by every list endpoint. Mirrors the API's
 * `listMetaSchema` - keep the two in step.
 */
export interface ListMeta {
  page: number;
  perPage: number;
  total: number;
  /** 0 when nothing matched, so "no results" is unambiguous. */
  totalPages: number;
}

/** `ListMeta` plus the facts a catalog grid needs about the whole matching set, not just the page. */
export interface CatalogMeta extends ListMeta {
  /** ISO-4217 code the prices in `data` are denominated in. */
  currency: string;
  /** Lowest/highest variant price across ALL matches, in integer cents. Null when empty. */
  priceMin: number | null;
  priceMax: number | null;
}

export interface Money {
  amount: number;
  currency: string;
  formatted: string;
  inclusive?: boolean;
  note?: string;
  // Sale fields (present on single-product response; list response TBD)
  isOnSale?: boolean;
  originalAmount?: number;
  originalFormatted?: string;
  discountPercentage?: number;
  saleName?: string;
}

/** Server-resolved rendition URLs. The client never constructs a CDN path itself. */
export interface MediaUrls {
  thumb?: string;
  card?: string;
  card2x?: string;
  gallery?: string;
  gallery2x?: string;
}

export interface Media {
  id: string;
  /** The untransformed original; the fallback when a named rendition is absent. */
  url?: string;
  urls?: MediaUrls;
  kind?: 'image' | 'video';
  mime?: string;
  width?: number | null;
  height?: number | null;
  alt?: string;
  position?: number;
  /** Set when this image belongs to one specific variant rather than the product. */
  variantId?: string | null;
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
    color?: string | null;
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

export interface BundleComponentVariant {
  id: string;
  name?: string;
  price: Money;
  inStock: boolean;
  inventoryCount?: number;
  optionValues?: string[];
}

export interface BundleComponent {
  id: string;
  product: {
    id: string;
    name: string;
    media: Media[];
    options?: Array<{
      id: string;
      name: string;
      values: Array<{ id: string; value: string; color?: string | null }>;
    }>;
  };
  variants: BundleComponentVariant[];
}

export interface BundleConfig {
  minQuantity: number;
  maxQuantity: number | null;
  quantityIncrement: number;
  allowDuplicates: boolean;
  showComponentPrices: boolean;
  components: BundleComponent[];
}

export interface BundleSelection {
  variantId: string;
  quantity: number;
}

export interface CartBundleSelection {
  productName: string;
  variantName?: string;
  quantity: number;
  media?: Media;
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
  productType?: string;
  bundleConfig?: BundleConfig;
  reviewCount?: number;
  averageRating?: number;
}

export interface ProductListParams {
  page?: number;
  perPage?: number;
  /** `featured` | `name` | `price` | `newest`, optionally suffixed `_asc` / `_desc`. */
  sort?: string;
  /** Category slug or id. */
  category?: string | string[];
  /** Hand-picked product ids or slugs, for a curated embed. */
  products?: string | string[];
  search?: string;
  /** Whole currency units, converted to cents on the wire. */
  minPrice?: number;
  maxPrice?: number;
  /** Opt-in only: omitted rather than sent as false. */
  inStock?: boolean;
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
  page?: number;
  perPage?: number;
}

// ============================================================================
// Cart Types
// ============================================================================

/**
 * A cart line. Prices are integer CENTS, like everywhere else on this API, and the display fields
 * are snapshots taken when the line was added - so a line still renders coherently after the
 * product behind it is deleted.
 *
 * `unitPrice` is likewise the price at add time. It is never silently re-priced under the shopper;
 * drift is revalidated once at checkout and reported back as `priceChanges`.
 */
export interface CartItem {
  id: string;
  /** Null once the catalog product is gone. The line survives it. */
  productId: string | null;
  /** Always present: price and stock live on variants, so a simple product has exactly one. */
  variantId: string;
  name: string;
  variantName: string | null;
  sku: string | null;
  /** Cents, snapshotted at add time. */
  unitPrice: number;
  quantity: number;
  /** Cents (unitPrice × quantity). */
  subtotal: number;
  position: number;
  /** One resolved URL, variant image first then the product's. Not a media array. */
  imageUrl: string | null;
}

/** Cart totals, all integer cents. Recomputed server-side on every mutation, never sent up. */
export interface CartTotals {
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingTotal: number;
  total: number;
}

/**
 * Where a cart ships or bills to. Every field is nullable because this is collected
 * PROGRESSIVELY - a half-typed address is a legitimate state the server stores, and refusing to
 * store one is what would break abandonment capture. Completeness is checked at checkout.
 */
export interface CartAddress {
  name: string | null;
  company: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  /** ISO-3166-1 alpha-2. Drives both shipping-zone matching and the tax jurisdiction. */
  countryCode: string | null;
  phone: string | null;
}

/** Address as input: an omitted field is left alone, an explicit null clears it. */
export type CartAddressInput = Partial<Record<keyof CartAddress, string | null>>;

/**
 * A shipping rate offered for the cart's CURRENT stored address and contents. Derived server-side
 * rather than quoted from an address passed up, so the price offered is the price charged. `cost`
 * already has any free-above-threshold applied.
 */
export interface ShippingOption {
  /** shipr_… - pass back as `shippingRateId` on `cart.patch()`. */
  id: string;
  name: string;
  description: string | null;
  /** Cents. */
  cost: number;
  estimatedDaysMin: number | null;
  estimatedDaysMax: number | null;
}

export interface ShippingOptions {
  options: ShippingOption[];
  /**
   * True when the cart has no country stored yet, so no zone can match. Distinguishes "we don't
   * know where you are" from "we don't ship there" - different messages to the shopper.
   */
  addressRequired: boolean;
}

/**
 * A live basket. Deliberately NOT an order: checkout copies a cart into an order and never mutates
 * one into the other, so there is no `type: 'order'` state to check for here. After a payment
 * redirect, ask `cart.getOrderStatus()` instead.
 */
export interface Cart {
  id: string;
  /** ISO-4217, snapshotted when the cart was opened. */
  currencyCode: string;
  email: string | null;
  items: CartItem[];
  shippingAddress: CartAddress | null;
  billingAddress: CartAddress | null;
  shippingRateId: string | null;
  /** Display snapshot of the chosen rate, frozen at selection. */
  shippingMethodName: string | null;
  totals: CartTotals;
  expiresAt: string;
  updatedAt: string;
}

/** Progressive checkout collection: write whatever the shopper has filled in so far. */
export interface PatchCartParams {
  email?: string | null;
  customerName?: string | null;
  shippingAddress?: CartAddressInput | null;
  billingAddress?: CartAddressInput | null;
  /** From `getShippingOptions()`. Refused if it is not a rate the stored address resolves to. */
  shippingRateId?: string | null;
}

export interface AddToCartParams {
  /** Either identifies the thing bought; `productId` alone takes that product's first variant. */
  productId?: string;
  variantId?: string;
  quantity?: number;
}

export interface UpdateCartItemParams {
  itemId: string;
  quantity: number;
}

// ---- Checkout ----

export interface CheckoutParams {
  /** Usually already on the cart via progressive collection; supplying it here overrides. */
  email?: string;
  customerName?: string;
  /**
   * The total last shown to the shopper. When present the server refuses on mismatch, so nobody is
   * ever charged a figure they were not shown.
   */
  expectedTotal?: number;
  /** Retry with this set after showing the shopper the drifted prices. */
  acceptPriceChanges?: boolean;
}

/** A line whose catalog price moved between add-to-cart and checkout. Surfaced, never absorbed. */
export interface CartPriceChange {
  itemId: string;
  name: string;
  previousUnitPrice: number;
  currentUnitPrice: number;
}

export type CheckoutRejection =
  | 'empty_cart'
  | 'price_changed'
  | 'insufficient_stock'
  | 'already_converted'
  | 'unavailable_item';

/**
 * A refused checkout. Thrown rather than returned so a caller cannot ignore it, and carries enough
 * detail for the client to re-render the cart rather than show a generic failure.
 */
export interface CheckoutRejected {
  rejection: CheckoutRejection;
  message: string;
  priceChanges?: CartPriceChange[];
  stockIssues?: Array<{ itemId: string; name: string; requested: number; available: number }>;
}

/** The order checkout created. It exists and holds stock BEFORE the shopper is sent to a gateway. */
export interface CheckoutAccepted {
  orderId: string;
  orderNumber: string;
  total: number;
  currencyCode: string;
  paymentStatus: string;
  /** When the stock reservation lapses if payment never completes. */
  reservationExpiresAt: string;
}

export interface StartPaymentParams {
  gateway?: string;
  /** Absolute https URL. Where the gateway returns the shopper on success. */
  returnUrl: string;
  /** Defaults to `returnUrl`. */
  cancelUrl?: string;
}

export interface StartPaymentResult {
  paymentId: string;
  status: string;
  /** Send the shopper here. */
  redirectUrl: string;
  amount: number;
  currencyCode: string;
}

/**
 * What a storefront polls after coming back from a hosted payment page. The webhook remains the
 * only writer of payment status - this only reports what was persisted, because the browser comes
 * back before, after, or instead of the webhook does.
 */
export interface OrderPaymentState {
  id: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  total: number;
  currencyCode: string;
}

// ============================================================================
// Store Types
// ============================================================================

export type FieldVisibility = 'required' | 'optional' | 'hidden';

export interface CheckoutSettings {
  termsMode: 'required_checkbox' | 'notice' | 'hidden';
  termsDisplay: 'url' | 'text';
  termsUrl: string | null;
  termsText: string | null;
  termsNoticeText: string | null;
  privacyPolicyUrl: string | null;
  refundPolicyUrl: string | null;
  showMarketingOptIn: boolean;
  precheckMarketingOptIn: boolean;
  companyNameField: FieldVisibility;
  phoneNumberField: FieldVisibility;
  addressLine2Field: FieldVisibility;
  showCouponField: boolean;
  showNotesField: boolean;
  confirmationMessage: string | null;
  redirectAfterCheckout: boolean;
  redirectUrl: string | null;
  minimumOrderValue?: number | null; // In cents. Blocks checkout below this cart total.
}

export interface Store {
  id: string;
  name: string;
  currency: string;
  locale: string;
  baseCurrencyCode?: string;
  checkout?: CheckoutSettings;
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
  /** libaddressinput-derived label type: state | province | prefecture | do_si | oblast | emirate | department | county | parish | island | area */
  stateNameType?: string | null;
  /** PCRE regex for postal code validation (dr5hn-sourced; null if country has no postal system) */
  postalRegex?: string | null;
  /** Placeholder example postal code (derived from postal format template) */
  postalExample?: string | null;
  flag?: string;
}

export interface State {
  code: string;
  /** Full ISO 3166-2 code (e.g. "JP-13", "CA-QC") */
  iso3166_2?: string | null;
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
// Review Types
// ============================================================================

export interface Review {
  id: string;
  rating: number;
  title: string;
  content: string;
  authorName: string;
  isVerifiedPurchase: boolean;
  source: 'organic' | 'imported' | 'manual';
  createdAt: string;
}

export interface ReviewStats {
  avgRating: number;
  reviewCount: number;
  ratingDistribution: Record<number, number>;
}

export interface ReviewsResponse {
  data: Review[];
  meta: ReviewStats & {
    page: number;
    perPage: number;
    total: number;
  };
}

export interface SubmitReviewParams {
  rating: number;
  title: string;
  content: string;
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
