import { html, type TemplateResult } from 'lit';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Cart, ApiResponse, Money, CheckoutSettings } from '@shoprocket/core';
import { loadingOverlay } from './loading-spinner';
import { HashRouter, type HashState } from '../core/hash-router';
import { TIMEOUTS, WIDGET_EVENTS } from '../constants';
import './tooltip';
import { cartState } from '../core/cart-state';
import { internalState } from '../core/internal-state';
import { CookieManager } from '../utils/cookie-manager';
import { validateForm, hasErrors } from '../core/validation';
import { t } from '../utils/i18n';

// Lazy import checkout components only when needed
import type { CustomerData, CustomerFormErrors } from './customer-form';
import { type AddressData, type AddressFormErrors, countryRequiresState } from './address-form';

// Import SVG as string - Vite will inline it at build time
import shoppingBasketIcon from '../assets/icons/shopping-basket.svg?raw';

// Import types only (won't bundle the modules)
import type { CartItemsContext } from './cart/cart-items';
import type { CartFooterContext } from './cart/cart-footer';
import type { CartTriggerContext } from './cart/cart-trigger';
import type { OrderResultContext } from './cart/order-result';
import type { CheckoutWizardContext } from './cart/checkout-wizard';
import type { OrderDetails } from './cart/cart-types';

/**
 * Cart Widget Component - Shopping cart with slide-out panel
 * 
 * @element shoprocket-cart
 * @fires shoprocket:cart:updated - When cart contents change
 * @fires shoprocket:cart:loaded - When cart is initially loaded
 * @fires shoprocket:cart:error - When cart operations fail
 * 
 * @attr {string} data-shoprocket - Must be "cart" to initialize this component
 * @attr {string} [data-position="bottom-right"] - Position of cart icon (bottom-right, bottom-left, top-right, top-left)
 * @attr {string} [data-style="bubble"] - Visual style (bubble, drawer)
 * @attr {boolean} [data-floating=true] - Whether cart floats over page content
 * @attr {string} [data-show] - Comma-separated features to show
 * @attr {string} [data-hide] - Comma-separated features to hide
 * 
 * @listens open-cart - Opens the cart panel
 * @listens close-cart - Closes the cart panel
 * @listens toggle-cart - Toggles cart visibility
 * @listens shoprocket:cart:add-item - Adds item to cart
 * 
 * @example
 * <!-- Basic floating cart -->
 * <div data-shoprocket="cart"></div>
 * 
 * @example
 * <!-- Cart in top-left corner -->
 * <div data-shoprocket="cart" 
 *      data-position="top-left"></div>
 * 
 * @example
 * <!-- Embedded cart (not floating) -->
 * <div data-shoprocket="cart" 
 *      data-floating="false"></div>
 * 
 * @example
 * <!-- Minimal style cart -->
 * <div data-shoprocket="cart"
 *      data-style="minimal"
 *      data-position="bottom-left"></div>
 */
export class CartWidget extends ShoprocketElement {
  // Provide SDK via context to all child components (Phase 2: will enable this)
  // @provide({ context: sdkContext })
  // override sdk!: ShoprocketCore;

  // Lazy-loaded module cache (Phase 3: background prefetch)
  private cartModules: {
    cartItems?: typeof import('./cart/cart-items');
    cartFooter?: typeof import('./cart/cart-footer');
    cartTrigger?: typeof import('./cart/cart-trigger');
    orderResult?: typeof import('./cart/order-result');
    checkoutWizard?: typeof import('./cart/checkout-wizard');
  } = {};

  private modulesPrefetched = false;

  @property({ type: String })
  position = 'bottom-right';

  @property({ type: String, attribute: 'widget-style' })
  widgetStyle = 'bubble';

  @property({ type: Boolean })
  floating = false;

  @property({ type: Boolean, reflect: true })
  contained = false;

  /**
   * Get the effective widget style - forces 'drawer' for middle positions
   */
  private get effectiveWidgetStyle(): string {
    // Middle positions only work with drawer style
    if (this.position === 'middle-left' || this.position === 'middle-right') {
      return 'drawer';
    }
    return this.widgetStyle;
  }

  @state()
  private isOpen = false;

  private hashRouter!: HashRouter;

  @state()
  private cart: Cart | null = null;
  
  @state()
  
  @state()
  private recentlyAddedProduct: any = null;
  
  @state()
  private notificationSliding: 'in' | 'out' | null = null;
  
  @state()
  private floatingErrorMessage: string | null = null;
  
  @state()
  private errorNotificationSliding: 'in' | 'out' | null = null;
  
  @state()
  private showOrderSuccessMessage = false;
  
  @state()
  private orderDetails: any = null;
  
  @state()
  private showOrderFailureMessage = false;

  @state()
  private orderFailureReason: string = '';

  @state()
  private orderFailureCode: string = '';

  @state()
  private isPaymentFailure = false; // Track if failure is from payment gateway (don't auto-hide)

  @state()
  private showOrderNotFound = false; // Show when order ID is missing on payment return

  // Track if checkout data has been loaded
  private checkoutDataLoaded = false;

  // Track if checkout chunks have been prefetched (to avoid duplicate prefetches)
  private checkoutChunksPrefetched = false;

  // Timeout tracking for cleanup
  private timeouts = new Set<NodeJS.Timeout>();
  
  // Track pending API calls for debouncing
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  
  // Cart state subscription
  private unsubscribeCartState?: () => void;

  @state()
  private removingItems: Set<string> = new Set();
  
  @state()
  private showEmptyState = false;

  // Checkout State
  @state()
  private isCheckingOut = false;

  @state()
  private checkoutStep: 'customer' | 'shipping' | 'billing' | 'payment' | 'review' = 'customer';

  @state()
  private customerData: Partial<CustomerData> = {};

  @state()
  private shippingAddress: Partial<AddressData> = {};

  @state()
  private billingAddress: Partial<AddressData> = {};

  @state()
  private sameAsBilling = true; // Default to true - most customers use same address

  @state()
  private isGuest = true;

  @state()
  private customerErrors: CustomerFormErrors = {};

  @state()
  private shippingErrors: AddressFormErrors = {};

  @state()
  private billingErrors: AddressFormErrors = {};

  @state()
  private checkoutLoading = false;
  
  @state() 
  private chunkLoading = false;

  @state()
  private checkingCustomer = false;

  @state()
  private customerCheckResult?: {
    exists: boolean;
    has_password: boolean;
  };

  @state()
  private showPasswordField = false;

  @state()
  private authDismissed = false;

  @state()
  private customerPassword = '';

  @state()
  private sendingLoginLink = false;

  @state()
  private loginLinkSent = false;
  
  @state()
  private otpCode = '';
  
  @state()
  private verifyingOtp = false;
  
  @state()
  private otpError = '';
  
  @state()
  private resendingOtp = false;

  @state()
  private signingIn = false;
  
  @state()
  private paymentPending = false;

  @state()
  private paymentTimeout = false;

  @state()
  private checkingOrderStatus = false;

  private paymentPollingInterval?: ReturnType<typeof setInterval>;
  
  @state()
  private shouldResetOnNextOpen = false;

  // Payment method state
  @state()
  private paymentMethods: any[] = [];

  @state()
  private selectedPaymentMethod: any = null;

  @state()
  private paymentMethodsLoading = false;

  private paymentMethodsLoaded = false;

  // Review step state
  @state()
  private reviewItemsExpanded = false;

  // Checkout settings state
  @state()
  private termsAccepted = false;

  @state()
  private marketingOptIn = false;

  @state()
  private orderNotes = '';

  @state()
  private redirecting = false;

  // Account creation state (post-checkout)
  @state()
  private accountPassword = '';

  @state()
  private creatingAccount = false;

  @state()
  private accountCreated = false;

  @state()
  private accountError = '';

  // Coupon code state
  @state()
  private couponCode = '';

  @state()
  private couponError: string | null = null;

  @state()
  private couponLoading = false;

  private get checkoutSettings(): CheckoutSettings | undefined {
    return this.getStore()?.checkout;
  }

  // Tracks if user authenticated during this checkout session (OTP or password)
  private authenticatedDuringCheckout = false;

  private customerCheckTimeout?: NodeJS.Timeout;

  // Order ID for post-checkout order API access
  private lastCheckedEmail?: string;

  /**
   * Reset component to clean initial state
   * Centralized method to avoid state management inconsistencies
   */
  private resetToInitialState(): void {
    // Loading states
    this.checkoutLoading = false;
    this.chunkLoading = false;
    this.checkingCustomer = false;
    this.sendingLoginLink = false;
    this.signingIn = false;
    this.verifyingOtp = false;
    this.resendingOtp = false;
    this.paymentPending = false;
    this.paymentTimeout = false;
    this.checkingOrderStatus = false;
    this.stopPaymentPolling();

    // Checkout state
    this.isCheckingOut = false;
    this.checkoutStep = 'customer';
    this.checkoutChunksPrefetched = false; // Allow re-prefetch on next cart open

    // Order result states
    this.showOrderSuccessMessage = false;
    this.showOrderFailureMessage = false;
    this.showOrderNotFound = false;
    this.isPaymentFailure = false;
    this.orderFailureReason = '';
    this.orderDetails = null;

    // Auth states
    this.loginLinkSent = false;
    this.showPasswordField = false;
    this.authDismissed = false;
    this.customerPassword = '';
    this.otpCode = '';
    this.otpError = '';

    // Account creation states
    this.accountPassword = '';
    this.creatingAccount = false;
    this.accountCreated = false;
    this.accountError = '';
    this.authenticatedDuringCheckout = false;

    // Coupon states
    this.couponCode = '';
    this.couponError = null;
    this.couponLoading = false;

    // Checkout settings states
    this.termsAccepted = false;
    this.marketingOptIn = false;
    this.orderNotes = '';
    this.redirecting = false;

    // Payment method states
    this.paymentMethods = [];
    this.selectedPaymentMethod = null;
    this.paymentMethodsLoading = false;
    this.paymentMethodsLoaded = false;

    // Error states
    this.customerErrors = {};
    this.shippingErrors = {};
    this.billingErrors = {};
  }

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();

    // Initialize HashRouter first
    this.hashRouter = HashRouter.getInstance();

    // Restore session state that survives page refreshes
    if (sessionStorage.getItem('shoprocket_authenticated') === 'true') {
      this.authenticatedDuringCheckout = true;
    }

    // Check for payment return from gateway
    await this.checkPaymentReturn();
    
    // Subscribe to cart state changes
    this.unsubscribeCartState = cartState.subscribe((state) => {
      // Update local properties from cart state
      this.cart = state.cart;
      this.customerData = state.customer as CustomerData;
      this.shippingAddress = state.shippingAddress as AddressData;
      this.billingAddress = state.billingAddress as AddressData;
      this.sameAsBilling = state.sameAsBilling;

      // Pre-select country from geo-detection if no address saved yet
      if (!this.shippingAddress.country && state.cart?.visitorCountry) {
        this.shippingAddress = { ...this.shippingAddress, country: state.cart.visitorCountry };
        if (this.sameAsBilling) {
          this.billingAddress = { ...this.billingAddress, country: state.cart.visitorCountry };
        }
      }

      // Prefetch checkout data/components when cart has items (improves checkout start performance)
      if (this.cart?.items?.length && this.isOpen) {
        this.preloadCheckoutData();
        this.preloadCheckoutComponents();
      }

      // Request UI update
      this.requestUpdate();
    });
    
    // Listen for add item events (optimistic updates)
    // Note: Handlers are arrow functions, already bound to instance - no need for .bind()
    // Remove before adding to prevent duplicate listeners if connectedCallback is called multiple times
    window.removeEventListener(WIDGET_EVENTS.CART_ADD_ITEM, this.handleAddItem as EventListener);
    window.addEventListener(WIDGET_EVENTS.CART_ADD_ITEM, this.handleAddItem as EventListener);

    // Listen for product added events
    window.removeEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    window.addEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);

    // Listen for cart errors to show floating notifications
    window.removeEventListener(WIDGET_EVENTS.CART_ERROR, this.handleFloatingError as EventListener);
    window.addEventListener(WIDGET_EVENTS.CART_ERROR, this.handleFloatingError as EventListener);
    

    // Set up HashRouter event handling (already initialized above)
    this.hashRouter.removeEventListener('state-change', this.handleHashStateChange);
    this.hashRouter.addEventListener('state-change', this.handleHashStateChange);

    // Handle browser back/forward cache (bfcache) restoration
    window.removeEventListener('pageshow', this.handlePageShow);
    window.addEventListener('pageshow', this.handlePageShow);

    // Handle cart control events
    window.removeEventListener('open-cart', this.handleOpenCart as EventListener);
    window.removeEventListener('close-cart', this.handleCloseCart as EventListener);
    window.removeEventListener('toggle-cart', this.handleToggleCart as EventListener);
    window.addEventListener('open-cart', this.handleOpenCart as EventListener);
    window.addEventListener('close-cart', this.handleCloseCart as EventListener);
    window.addEventListener('toggle-cart', this.handleToggleCart as EventListener);
    
    // Cart state now manages internal state updates
    
    // Store data should already be cached by widget manager
    // If not available yet, wait a bit or skip (formatters will use defaults)

    // Load cart first (unless we're showing order success/not found)
    // For failures, we DO want to load cart (backend will return the order if < 10 mins)
    if (!this.showOrderSuccessMessage && !this.showOrderNotFound) {
      await this.loadCart();

      // Detect if the loaded cart is actually an order (e.g. page refresh during payment)
      // The backend returns orders within the edit window via GET /cart
      // Skip if checkPaymentReturn() already handled this (e.g. payment-cancelled → review step)
      if (!this.paymentPending && !this.showOrderFailureMessage && !this.isCheckingOut && this.cart?.type === 'order') {
        const status = this.cart?.order?.paymentStatus;
        if (status === 'paid' || status === 'processing' || status === 'completed') {
          await this.handlePaymentConfirmed(this.cart.id);
        }
        // For failed/cancelled/pending orders on normal page load (no #!/payment-return),
        // just show cart normally so customer can re-checkout.
        // Failure messages are only shown during active payment return flow (checkPaymentReturn).
      }
    }
    
    // Set initial cart state from hash
    const initialState = this.hashRouter.getCurrentState();
    this.isOpen = initialState.cartOpen;
    
    // Don't preload checkout data on initial page load, even if cart is open from URL
    // This prevents unnecessary API calls on page load
    // Checkout data will be loaded when user actually starts checkout
    
    // Apply initial scroll lock if cart is open
    if (this.isOpen) {
      document.body.style.overflow = 'hidden';
    }

    // Start prefetching cart modules in background (Phase 3: lazy loading)
    this.prefetchCartModules();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    // Restore scroll if cart was open
    if (this.isOpen) {
      document.body.style.overflow = '';
    }

    // Unsubscribe from cart state
    if (this.unsubscribeCartState) {
      this.unsubscribeCartState();
    }

    // Remove event listeners
    window.removeEventListener(WIDGET_EVENTS.CART_ADD_ITEM, this.handleAddItem as EventListener);
    window.removeEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    window.removeEventListener(WIDGET_EVENTS.CART_ERROR, this.handleFloatingError as EventListener);
    this.hashRouter.removeEventListener('state-change', this.handleHashStateChange);
    window.removeEventListener('pageshow', this.handlePageShow);
    window.removeEventListener('open-cart', this.handleOpenCart as EventListener);
    window.removeEventListener('close-cart', this.handleCloseCart as EventListener);
    window.removeEventListener('toggle-cart', this.handleToggleCart as EventListener);
    
    // Clean up ALL tracked timeouts
    this.timeouts.forEach(timeout => clearTimeout(timeout));
    this.timeouts.clear();
    
    // Clean up specific timeouts
    if (this.notificationTimeouts?.slideOut) {
      clearTimeout(this.notificationTimeouts.slideOut);
    }
    if (this.notificationTimeouts?.remove) {
      clearTimeout(this.notificationTimeouts.remove);
    }
    if (this.errorNotificationTimeouts?.slideOut) {
      clearTimeout(this.errorNotificationTimeouts.slideOut);
    }
    if (this.errorNotificationTimeouts?.remove) {
      clearTimeout(this.errorNotificationTimeouts.remove);
    }

    this.stopPaymentPolling();
  }

  /**
   * Prefetch cart modules in background for instant cart opening
   * Uses requestIdleCallback to avoid blocking critical rendering
   */
  private prefetchCartModules(): void {
    if (this.modulesPrefetched) return;

    const prefetch = async () => {
      try {
        // Load all cart modules in parallel during browser idle time
        const [cartItems, cartFooter, cartTrigger, orderResult] = await Promise.all([
          import('./cart/cart-items'),
          import('./cart/cart-footer'),
          import('./cart/cart-trigger'),
          import('./cart/order-result')
        ]);

        // Cache the loaded modules (merge, don't replace — checkoutWizard may already be cached)
        this.cartModules.cartItems = cartItems;
        this.cartModules.cartFooter = cartFooter;
        this.cartModules.cartTrigger = cartTrigger;
        this.cartModules.orderResult = orderResult;

        this.modulesPrefetched = true;
      } catch (error) {
        console.warn('[Cart] Failed to prefetch modules:', error);
        // Non-critical error - modules will lazy load on demand
      }
    };

    // Use requestIdleCallback if available, otherwise setTimeout
    if ('requestIdleCallback' in window) {
      requestIdleCallback(prefetch);
    } else {
      setTimeout(prefetch, 100);
    }
  }

  /**
   * Lazy load a cart module on demand (fallback if prefetch hasn't completed)
   */
  private async ensureModule<K extends keyof typeof this.cartModules>(
    module: K
  ): Promise<NonNullable<typeof this.cartModules[K]>> {
    // Return cached module if available
    if (this.cartModules[module]) {
      return this.cartModules[module]!;
    }

    // Load on demand
    switch (module) {
      case 'cartItems':
        this.cartModules.cartItems = await import('./cart/cart-items');
        return this.cartModules.cartItems as any;
      case 'cartFooter':
        this.cartModules.cartFooter = await import('./cart/cart-footer');
        return this.cartModules.cartFooter as any;
      case 'cartTrigger':
        this.cartModules.cartTrigger = await import('./cart/cart-trigger');
        return this.cartModules.cartTrigger as any;
      case 'orderResult':
        this.cartModules.orderResult = await import('./cart/order-result');
        return this.cartModules.orderResult as any;
      case 'checkoutWizard':
        this.cartModules.checkoutWizard = await import('./cart/checkout-wizard');
        return this.cartModules.checkoutWizard as any;
      default:
        throw new Error(`Unknown module: ${module}`);
    }

    // Clear any pending updates
    this.pendingUpdates.forEach(timeout => clearTimeout(timeout));
    this.pendingUpdates.clear();
    
    // Clear customer check timeout
    if (this.customerCheckTimeout) {
      clearTimeout(this.customerCheckTimeout);
    }
    
    // Clean up internal state cart reference
    // Note: We don't clear it entirely as other components may still exist
  }

  
  private handleAddItem = (event: CustomEvent): void => {
    const { item, stockInfo, bundleSelections } = event.detail;
    
    // Initialize cart first if needed
    if (!this.cart) {
      // Use store currency when creating new cart
      const currency = this.getStoreCurrency();
      const locale = navigator.language || 'en-US';
      const zeroPriceObj: Money = {
        amount: 0,
        currency,
        formatted: new Intl.NumberFormat(locale, {
          style: 'currency',
          currency
        }).format(0)
      };
      const newCart = {
        id: 'temp-' + Date.now(),
        items: [],
        totals: {
          subtotal: zeroPriceObj,
          tax: zeroPriceObj,
          shipping: zeroPriceObj,
          total: zeroPriceObj
        },
        currency,
        itemCount: 0
      };
      cartState.setCart(newCart as any);
      this.cart = newCart;
    }
    
    // Ensure cart has items array
    if (!this.cart.items) {
      this.cart.items = [];
    }
    
    // Bundle items never merge — each addition is a new line item
    const isBundle = item.productType === 'bundle';

    // Find existing item (do this once) — skip for bundles
    const existingItem = isBundle ? undefined : this.cart.items.find((cartItem: any) =>
      cartItem.productId === item.productId &&
      cartItem.variantId === item.variantId
    );
    
    // Validate stock if tracking inventory
    if (stockInfo?.trackInventory || stockInfo?.inventoryPolicy === 'deny') {
      const availableQuantity = stockInfo.availableQuantity ?? stockInfo.inventoryCount ?? 0;
      
      // Check if out of stock
      if (availableQuantity === 0) {
        window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ERROR, {
          detail: {
            type: 'out_of_stock',
            message: t('error.out_of_stock', 'Sorry, this item is out of stock')
          }
        }));
        return;
      }
      
      const currentQuantityInCart = existingItem?.quantity || 0;
      const requestedTotal = currentQuantityInCart + item.quantity;
      
      // Check if requested quantity exceeds available stock
      if (requestedTotal > availableQuantity) {
        const canAdd = availableQuantity - currentQuantityInCart;
        window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ERROR, {
          detail: {
            type: 'insufficient_stock',
            message: canAdd > 0 ?
              t('product.only_more_available', 'Only {count} more available', { count: canAdd }) :
              t('product.max_quantity_in_cart', 'Maximum quantity ({count}) already in cart', { count: availableQuantity }),
            availableQuantity: availableQuantity,
            currentQuantity: currentQuantityInCart
          }
        }));
        return;
      }
    }
    
    // Update existing item or add new one
    if (existingItem) {
      existingItem.quantity += item.quantity;
      // Update stock info if provided
      if (stockInfo) {
        existingItem.inventoryPolicy = stockInfo.inventoryPolicy || (stockInfo.trackInventory ? 'deny' : 'continue');
        existingItem.inventoryCount = stockInfo.inventoryCount ?? stockInfo.availableQuantity;
      }
    } else {
      // Add new item with a temporary ID and stock info
      const newItem = {
        ...item,
        id: 'temp-' + Date.now() + '-' + Math.random(),
        ...(stockInfo && {
          inventoryPolicy: stockInfo.inventoryPolicy || (stockInfo.trackInventory ? 'deny' : 'continue'),
          inventoryCount: stockInfo.inventoryCount ?? stockInfo.availableQuantity
        })
      };
      this.cart.items.push(newItem);
    }
    
    // Update item count optimistically (totals update when API responds)
    this.cart.itemCount = this.cart.items.reduce((count, i) => count + i.quantity, 0) || 0;
    cartState.setCart(this.cart);
    this.showEmptyState = false;
    
    // Cart state subscriptions handle updates
    
    // Dispatch product added event for UI feedback
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.PRODUCT_ADDED, {
      detail: {
        product: {
          id: item.productId,
          name: item.productName,
          price: item.price,
          media: (item as any).image || item.media?.[0],
          variantText: item.variantName
        }
      }
    }));
    
    // Track add to cart event
    this.track(EVENTS.ADD_TO_CART, item);
    
    // Make API call and refresh cart with real data
    this.sdk.cart.addItem({
      productId: item.productId,
      variantId: item.variantId,
      quantity: item.quantity,
      sourceUrl: item.sourceUrl,
      ...(bundleSelections && {
        bundleSelections: bundleSelections.map((sel: any) => ({
          variantId: sel.variantId,
          quantity: sel.quantity
        }))
      })
    }).then(response => {
      // Replace optimistic cart with real cart data
      if (response) {
        // Update cart state - this will trigger subscription and update UI
        cartState.setCart(response);
      }
    }).catch(error => {
      console.error('Failed to add to cart:', error);
      // Don't rollback - keep optimistic update
    });
  }
  
  // Event dispatching now handled by cart state subscriptions
  
  private handleOpenCart = (): void => {
    this.openCart();
  }
  
  private handleCloseCart = (): void => {
    this.closeCart();
  }
  
  private handleToggleCart = (): void => {
    this.toggleCart();
  }
  
  
  private notificationTimeouts: { slideOut?: NodeJS.Timeout; remove?: NodeJS.Timeout } = {};
  private errorNotificationTimeouts: { slideOut?: NodeJS.Timeout; remove?: NodeJS.Timeout } = {};

  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    
    // Clear any existing error notification
    this.floatingErrorMessage = null;
    this.errorNotificationSliding = null;
    if (this.errorNotificationTimeouts.slideOut) {
      clearTimeout(this.errorNotificationTimeouts.slideOut);
    }
    if (this.errorNotificationTimeouts.remove) {
      clearTimeout(this.errorNotificationTimeouts.remove);
    }
    
    // Clear existing success timeouts
    if (this.notificationTimeouts.slideOut) {
      clearTimeout(this.notificationTimeouts.slideOut);
    }
    if (this.notificationTimeouts.remove) {
      clearTimeout(this.notificationTimeouts.remove);
    }
    
    // Reset animation state
    this.notificationSliding = null;
    this.recentlyAddedProduct = product;
    
    // Small delay to ensure animation restarts
    requestAnimationFrame(() => {
      this.notificationSliding = 'in';
      
      // Start slide out after 3 seconds
      this.notificationTimeouts.slideOut = setTimeout(() => {
        this.notificationSliding = 'out';
        
        // Remove completely after slide animation completes
        this.notificationTimeouts.remove = setTimeout(() => {
          this.recentlyAddedProduct = null;
          this.notificationSliding = null;
        }, TIMEOUTS.ANIMATION); // Match animation duration
      }, 3000);
    });
  }
  
  private handleHashStateChange = (event: Event): void => {
    // HashRouter tells us when cart state changes
    const customEvent = event as CustomEvent<HashState>;
    const wasOpen = this.isOpen;
    this.isOpen = customEvent.detail.cartOpen;

    // Lock/unlock body scroll when cart opens/closes
    if (this.isOpen && !wasOpen) {
      // Cart is opening - lock scroll
      document.body.style.overflow = 'hidden';
    } else if (!this.isOpen && wasOpen) {
      // Cart is closing - restore scroll
      document.body.style.overflow = '';
    }

    // Check for payment return (handles normal hash navigation)
    this.checkPaymentReturn();
  }

  private handlePageShow = (event: PageTransitionEvent): void => {
    // Handle browser back/forward cache (bfcache) restoration
    // This fires when user clicks browser back button and page is restored from cache
    if (event.persisted) {
      console.log('Page restored from bfcache, URL:', window.location.hash);

      // When page is restored from bfcache, we're back on the checkout page
      // Need to clear any loading states that were active when we navigated away
      this.resetToInitialState();

      // Reload cart to get current state
      this.loadCart();

      // Check for payment return (in case URL does have payment return hash)
      this.checkPaymentReturn();
    }
  }


  /**
   * Load cart from API
   *
   * Updates both cartState (for public API) and returns cart directly.
   * Returns the cart immediately rather than waiting for subscription to update this.cart,
   * which is important for synchronous flows like payment return handling.
   */
  private async loadCart(): Promise<Cart | null> {
    let loadedCart: Cart | null = null;
    await this.withLoading('cart', async () => {
      try {
        const response = await this.sdk.cart.get();

        // Handle both wrapped and unwrapped responses
        if (response && typeof response === 'object') {
          const cart = 'data' in response ? (response as ApiResponse<Cart>).data : (response as Cart);

          // Ensure all items have subtotals calculated (if needed)
          if (cart?.items) {
            cart.items.forEach((item: any) => {
              if (item.subtotal === undefined && item.price?.amount !== undefined) {
                item.subtotal = item.price.amount * (item.quantity || 0);
              }
            });
          }

          // Update cart state - this will trigger subscription and update UI
          cartState.setCart(cart);
          loadedCart = cart;

          // Extract and store customerId for analytics (if authenticated)
          const customerId = (cart as any)?.customer?.customerId || null;
          internalState.setCustomerId(customerId);

          // Don't auto-set visitorCountry as default - this causes unnecessary API calls on page load
          // The user can select their country when they get to checkout
          // if (cart?.visitorCountry && !cart.hasShippingAddress && !cart.hasBillingAddress) {
          //   cartState.updateShippingAddress({ country: cart.visitorCountry });
          //   cartState.updateBillingAddress({ country: cart.visitorCountry });
          // }
          
          // Reset empty state if cart has items
          if (cart?.items?.length > 0) {
            this.showEmptyState = false;
          }
          
          // Dispatch cart data globally
          window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_LOADED, {
            detail: { cart }
          }));
          
          // Cart state subscriptions handle updates
        } else {
          this.cart = null;
        }
      } catch (err) {
        console.error('Failed to load cart:', err);
        this.cart = null;
        this.showInCartError(t('error.cart_load_failed', 'Failed to load cart data'));
      }
    });
    return loadedCart;
  }

  private async loadCheckoutData(forceReload = false): Promise<void> {
    // Skip if already loaded (unless forced)
    if (this.checkoutDataLoaded && !forceReload) return;
    
    try {
      await cartState.loadCheckoutData();
      this.checkoutDataLoaded = true;
    } catch (err) {
      console.error('Failed to load checkout data:', err);
      // It's ok if checkout data load fails - might be a new cart
    }
  }
  
  private preloadCheckoutData(): void {
    // Preload checkout data if we have items and not already in checkout
    if (this.cart?.items?.length && !this.isCheckingOut && !this.checkoutDataLoaded) {
      // Fire and forget - don't await
      this.loadCheckoutData().catch(() => {
        // Ignore errors - it's just a preload optimization
      });
    }
  }
  
  private async loadPaymentMethods(): Promise<void> {
    if (this.paymentMethodsLoaded || this.paymentMethodsLoading) return;
    this.paymentMethodsLoading = true;
    try {
      const result = await this.sdk.cart.getPaymentMethods();
      this.paymentMethods = result.paymentMethods;

      if (!this.selectedPaymentMethod && this.paymentMethods.length) {
        // Restore from order's gateway if retrying (cancel return, browser back, retry)
        const orderGateway = this.cart?.order?.paymentGateway;
        if (orderGateway) {
          const match = this.paymentMethods.find((m: any) => m.gateway === orderGateway);
          if (match) this.selectedPaymentMethod = match;
        }
        // Always default to first method if nothing selected (standard e-commerce UX)
        if (!this.selectedPaymentMethod) {
          this.selectedPaymentMethod = this.paymentMethods[0];
        }
      }

      this.paymentMethodsLoaded = true;
    } catch (err) {
      console.error('Failed to load payment methods:', err);
    } finally {
      this.paymentMethodsLoading = false;
    }
  }

  private preloadCheckoutComponents(): void {
    // Preload checkout components if we have items and haven't prefetched yet
    if (this.cart?.items?.length && !this.checkoutChunksPrefetched) {
      this.checkoutChunksPrefetched = true;

      // Fire and forget - don't await
      Promise.all([
        import('./customer-form'),
        import('./address-form'),
        import('./cart/checkout-wizard')
      ]).then(() => {
        console.log('[Cart] Checkout components prefetched');
      }).catch((error) => {
        // Reset flag on error so it can retry
        this.checkoutChunksPrefetched = false;
        console.warn('[Cart] Failed to prefetch checkout components:', error);
      });
    }
  }
  
  
  private toggleCart = (): void => {
    if (this.isOpen) {
      this.closeCart();
    } else {
      this.openCart();
    }
  }
  
  /**
   * Handle payment return from gateway
   * Single entry point for all payment return scenarios (redirect, browser back, etc.)
   */
  private handlingPaymentReturn = false;

  private async checkPaymentReturn(): Promise<void> {
    const hash = window.location.hash;
    const isPaymentReturn = hash.startsWith('#!/payment-return');
    const isPaymentCancelled = hash.startsWith('#!/payment-cancelled');

    if (!isPaymentReturn && !isPaymentCancelled) {
      return; // Not a payment return, nothing to do
    }

    // Prevent re-entry from updated() re-renders during async handling
    if (this.handlingPaymentReturn) return;
    this.handlingPaymentReturn = true;

    // Step 1: Reset all component state to clean slate
    this.resetToInitialState();

    // Step 2: Open cart immediately with loading state (after reset so it doesn't get cleared)
    this.isOpen = true;
    this.checkoutLoading = true;
    this.hashRouter.openCart();

    // Step 3: Load fresh cart data from API
    const cart = await this.loadCart();

    // Restore checkout preferences (notes, terms, marketing) from the order data
    this.restoreCheckoutPreferencesFromOrder(cart);

    // Step 3: Handle payment cancelled separately from payment failure
    if (isPaymentCancelled) {
      // USER CANCELLED: They clicked "Cancel and Return to Merchant" on gateway page

      this.checkoutLoading = false;

      // Cart is already an order — go to review step so user can retry immediately
      this.isCheckingOut = true;
      this.checkoutStep = 'review';
      this.orderDetails = cart;

      // Load checkout module, checkout data, and payment methods so review step renders fully
      // Gateway matching is handled centrally by loadPaymentMethods()
      await Promise.all([
        this.ensureModule('checkoutWizard'),
        this.loadCheckoutData(true),
        this.loadPaymentMethods()
      ]);

      this.cleanupPaymentReturnUrl();
      this.handlingPaymentReturn = false;
      return;
    }

    // Restore authentication flag from sessionStorage (survives payment redirect)
    if (sessionStorage.getItem('shoprocket_authenticated') === '1') {
      this.authenticatedDuringCheckout = true;
    }

    // Step 4: Determine what to show based on API response (for payment-return URLs)
    if (cart && cart.type === 'order' && cart.order) {
      const order = cart.order;
      const status = order.paymentStatus;

      if (status === 'paid' || status === 'completed' || status === 'processing') {
        // SUCCESS: Payment completed
        // Track purchase event for gateway payments
        // Pass full cart (has items, totals) - sanitizer extracts order metadata from cart.order
        this.track(EVENTS.PURCHASE, cart);

        this.showOrderSuccessMessage = true;
        this.orderDetails = cart;
        this.schedulePostCheckoutRedirect();

        // Clear stored order ID and auth flag
        sessionStorage.removeItem('shoprocket_order_id');
        sessionStorage.removeItem('shoprocket_authenticated');

        // Clear cart state and checkout data
        cartState.clear();

        // Reset the UI to show empty cart
        this.cart = null;
        this.exitCheckout();

        // Regenerate cart token (order is complete, start fresh cart)
        const newToken = CookieManager.regenerateCartToken();
        internalState.setCartToken(newToken);
        if (this.sdk) {
          this.sdk.setCartToken(newToken);
        }

        // Force refresh of cart state to ensure clean slate
        await this.loadCart();
      } else if (status === 'pending') {
        // PENDING: Payment is being processed (redirect returned before webhook confirmed)
        // Show "processing" UI and start polling for status updates
        this.paymentPending = true;
        this.orderDetails = cart;
        this.startPaymentPolling();
      } else if (status === 'failed' || status === 'cancelled') {
        // FAILURE: Payment failed/declined by gateway - allow retry
        this.showOrderFailureMessage = true;
        this.isPaymentFailure = true;
        this.orderFailureReason = t('error.payment_declined', 'Payment was declined. Please try again or use a different payment method.');
        this.orderDetails = cart;

        // Return to checkout review step to allow retry
        this.isCheckingOut = true;
        this.checkoutStep = 'review';

        // Load checkout module, data, and payment methods so review step works
        // Gateway matching is handled centrally by loadPaymentMethods()
        await Promise.all([
          this.ensureModule('checkoutWizard'),
          this.loadCheckoutData(true),
          this.loadPaymentMethods()
        ]);
      } else {
        // UNKNOWN: Status we don't recognize
        console.warn('Unknown order status:', status);
        this.showOrderFailureMessage = true;
        this.orderFailureReason = t('error.payment_status_unknown', 'Unable to verify payment status. Please check your email for confirmation.');
        this.orderDetails = cart;
      }
    } else {
      // NOT FOUND: No order found or expired
      this.showOrderNotFound = true;
    }

    // Step 4: Turn off loading state
    this.checkoutLoading = false;

    // Step 5: Clean up payment URL
    this.cleanupPaymentReturnUrl();
    this.handlingPaymentReturn = false;
  }
  
  private storeOrderId(orderId: string): void {
    // Store in session storage as backup
    sessionStorage.setItem('shoprocket_order_id', orderId);
  }

  /** Restore checkout preferences from the order data returned by the API */
  private restoreCheckoutPreferencesFromOrder(cart: any): void {
    if (cart?.order) {
      if (cart.order.customerNotes) this.orderNotes = cart.order.customerNotes;
      if (cart.order.termsAccepted) this.termsAccepted = true;
      if (cart.order.marketingOptIn !== undefined) this.marketingOptIn = cart.order.marketingOptIn;
    }
  }
  
  private startPaymentPolling(): void {
    const orderId = sessionStorage.getItem('shoprocket_order_id') || this.cart?.id;
    if (!orderId) {
      this.paymentTimeout = true;
      return;
    }

    this.paymentTimeout = false;
    let attempts = 0;
    let consecutiveErrors = 0;

    const poll = async () => {
      attempts++;
      try {
        const result = await this.sdk.cart.getOrderStatus(orderId);
        consecutiveErrors = 0;
        const status = result.paymentStatus || result.status;

        if (status === 'paid' || status === 'processing' || status === 'completed') {
          await this.handlePaymentConfirmed(orderId);
          return; // Stop polling
        } else if (status === 'failed' || status === 'cancelled') {
          this.handlePaymentFailed();
          return; // Stop polling
        }
      } catch {
        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          this.stopPaymentPolling();
          this.paymentTimeout = true;
          return;
        }
      }

      // Graduated intervals: 3s for first 30s (10 polls), then 5s up to ~2 min total
      if (attempts >= 28) {
        this.stopPaymentPolling();
        this.paymentTimeout = true;
        return;
      }
      const delay = attempts <= 10 ? 3000 : 5000;
      this.paymentPollingInterval = setTimeout(poll, delay) as any;
    };

    // First poll after initial delay
    this.paymentPollingInterval = setTimeout(poll, 3000) as any;
  }

  private stopPaymentPolling(): void {
    if (this.paymentPollingInterval) {
      clearTimeout(this.paymentPollingInterval);
      this.paymentPollingInterval = undefined;
    }
  }

  private async handlePaymentConfirmed(orderId: string): Promise<void> {
    this.stopPaymentPolling();
    this.paymentPending = false;

    // Load full cart data for success screen
    await this.loadCart();

    // Track purchase event
    this.track(EVENTS.PURCHASE, this.cart);

    this.showOrderSuccessMessage = true;
    this.orderDetails = this.cart;
    this.schedulePostCheckoutRedirect();

    // Clean up sessionStorage
    sessionStorage.removeItem('shoprocket_order_id');
    sessionStorage.removeItem('shoprocket_authenticated');

    // Clear cart state and reset
    cartState.clear();
    this.cart = null;
    this.exitCheckout();

    // Regenerate cart token for next order
    const newToken = CookieManager.regenerateCartToken();
    internalState.setCartToken(newToken);
    if (this.sdk) {
      this.sdk.setCartToken(newToken);
    }

    // Load fresh cart with new token
    await this.loadCart();
  }

  private handlePaymentFailed(): void {
    this.stopPaymentPolling();
    this.paymentPending = false;

    this.showOrderFailureMessage = true;
    this.isPaymentFailure = true;
    this.orderFailureReason = t('error.payment_declined', 'Payment was declined. Please try again or use a different payment method.');

    // Return to checkout review step for retry
    this.isCheckingOut = true;
    this.checkoutStep = 'review';
  }

  private async openCart(): Promise<void> {
    // Reset success state if flagged from previous session
    // BUT skip reset if we're showing a success message (likely from payment return)
    if (this.shouldResetOnNextOpen && !this.showOrderSuccessMessage) {
      this.showOrderSuccessMessage = false;
      this.orderDetails = null;
      this.shouldResetOnNextOpen = false;
      this.showOrderFailureMessage = false;
      this.isPaymentFailure = false;
      this.orderFailureReason = '';
      
      // Reload cart to get fresh state from server
      await this.loadCart();
    } else if (this.shouldResetOnNextOpen && this.showOrderSuccessMessage) {
      // Clear the reset flag but keep the success message
      this.shouldResetOnNextOpen = false;
    }
    
    this.hashRouter.openCart();
    
    // Preload checkout data and components when cart opens (if we have items)
    // This reduces latency when user clicks checkout
    this.preloadCheckoutData();
    this.preloadCheckoutComponents();
    
    // Track cart opened
    this.track(EVENTS.CART_OPENED, this.cart);
  }
  
  private closeCart(): void {
    // Clean up payment return URL if present (before hashRouter acts on it)
    const hash = window.location.hash;
    const isPaymentReturnUrl = hash.includes('#!/payment-return') || hash.includes('#!/payment-cancelled');

    if (isPaymentReturnUrl) {
      // Clean to base URL first
      const baseUrl = (window.location.href.split('?')[0] || '').split('#')[0] || window.location.origin;
      window.history.replaceState(null, '', baseUrl);

      // Manually trigger HashRouter sync (replaceState doesn't fire hashchange)
      this.hashRouter['updateStateFromHash']();
    } else {
      // Normal close - use hashRouter
      this.hashRouter.closeCart();
    }

    // Clear order success/failure states for privacy (don't show on next open)
    if (this.showOrderSuccessMessage) {
      this.showOrderSuccessMessage = false;
      this.orderDetails = null;
      sessionStorage.removeItem('shoprocket_order_id');
    }

    if (this.showOrderFailureMessage) {
      this.showOrderFailureMessage = false;
      this.isPaymentFailure = false;
      this.orderFailureReason = '';
      sessionStorage.removeItem('shoprocket_order_id');
    }

    if (this.showOrderNotFound) {
      this.showOrderNotFound = false;
    }

    if (this.paymentPending) {
      this.stopPaymentPolling();
      this.paymentPending = false;
      this.paymentTimeout = false;
    }

    // Track cart closed
    this.track(EVENTS.CART_CLOSED, this.cart);
  }

  // Checkout Methods
  private async startCheckout(): Promise<void> {
    // Show loading state while chunks load
    this.chunkLoading = true;

    try {
      // Lazy load checkout components, data, and payment methods in parallel
      const [_customerForm, _addressForm, checkoutWizard] = await Promise.all([
        import('./customer-form'),
        import('./address-form'),
        import('./cart/checkout-wizard'),
        // Always try to load checkout data when starting checkout
        this.loadCheckoutData(),
        // Prefetch payment methods so they're ready for the payment step
        this.loadPaymentMethods()
      ]);

      // Populate the module cache
      this.cartModules.checkoutWizard = checkoutWizard;

      this.isCheckingOut = true;
      this.checkoutStep = 'customer';

      // Initialize checkout settings state
      this.termsAccepted = false;
      this.marketingOptIn = this.checkoutSettings?.precheckMarketingOptIn ?? false;
      this.orderNotes = '';

      // Track checkout started with enhanced data
      this.track(EVENTS.BEGIN_CHECKOUT, {
        cart: this.cart,
        items_count: this.cart?.items?.length || 0,
        cart_value: this.cart?.totals?.total?.amount,
        currency: this.cart?.currency
      });

      // Track viewing first step with specific event
      this.track(EVENTS.CHECKOUT_CONTACT_VIEWED, {
        step_name: 'contact_information',
        step_number: 1,
        total_steps: this.sameAsBilling ? 4 : 5,
        cart_value: this.cart?.totals?.total?.amount
      });
    } finally {
      this.chunkLoading = false;
    }
  }

  private exitCheckout(): void {
    const wasOnStep = this.checkoutStep;
    
    // Track checkout abandonment (unless it's after successful order)
    if (!this.showOrderSuccessMessage && wasOnStep) {
      const stepNames: Record<string, string> = {
        'customer': 'contact_information',
        'shipping': 'shipping_address', 
        'billing': 'billing_address',
        'payment': 'payment_method',
        'review': 'order_review'
      };
      
      this.track(EVENTS.CHECKOUT_ABANDONED, {
        abandoned_at_step: stepNames[wasOnStep] || wasOnStep,
        cart_value: this.cart?.totals?.total?.amount,
        items_count: this.cart?.items?.length || 0
      });
    }
    
    this.isCheckingOut = false;
    this.checkoutStep = 'customer';
    this.customerErrors = {};
    this.shippingErrors = {};
    this.billingErrors = {};
    
    // Reset checkout data flag after successful order completion
    if (this.showOrderSuccessMessage) {
      this.checkoutDataLoaded = false;
    }
  }

  private getStepEventName(step: string, type: 'viewed' | 'completed'): string {
    const eventMap: Record<string, Record<'viewed' | 'completed', string>> = {
      'customer': {
        'viewed': EVENTS.CHECKOUT_CONTACT_VIEWED,
        'completed': EVENTS.CHECKOUT_CONTACT_COMPLETED
      },
      'shipping': {
        'viewed': EVENTS.CHECKOUT_SHIPPING_VIEWED,
        'completed': EVENTS.CHECKOUT_SHIPPING_COMPLETED
      },
      'billing': {
        'viewed': EVENTS.CHECKOUT_BILLING_VIEWED,
        'completed': EVENTS.CHECKOUT_BILLING_COMPLETED
      },
      'payment': {
        'viewed': EVENTS.CHECKOUT_PAYMENT_VIEWED,
        'completed': EVENTS.CHECKOUT_PAYMENT_COMPLETED
      },
      'review': {
        'viewed': EVENTS.CHECKOUT_REVIEW_VIEWED,
        'completed': EVENTS.CHECKOUT_REVIEW_COMPLETED
      }
    };
    
    return eventMap[step]?.[type] || `checkout_${step}_${type}`;
  }

  private get shouldSkipPaymentStep(): boolean {
    return this.paymentMethods.length === 1 && this.paymentMethods[0]?.gateway !== 'manual';
  }

  private getCheckoutSteps(): Array<'customer' | 'shipping' | 'billing' | 'payment' | 'review'> {
    const allSteps: Array<'customer' | 'shipping' | 'billing' | 'payment' | 'review'> =
      ['customer', 'shipping', 'billing', 'payment', 'review'];

    return allSteps.filter(step => {
      if (step === 'shipping' && this.cart?.requiresShipping === false) return false;
      if (step === 'billing' && this.sameAsBilling && this.cart?.requiresShipping !== false) return false;
      if (step === 'payment' && this.shouldSkipPaymentStep) return false;
      return true;
    });
  }

  private async nextCheckoutStep(): Promise<void> {
    const steps = this.getCheckoutSteps();

    const currentIndex = steps.indexOf(this.checkoutStep);
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep) {
        const previousStep = this.checkoutStep;

        // After shipping step, flush checkout data in the background to trigger
        // tax calculation on the backend while user completes billing/payment steps
        if (previousStep === 'shipping') {
          cartState.flush();
        }

        // Before entering review step, refresh cart to get updated totals
        // (tax/shipping should already be calculated from the earlier flush)
        if (nextStep === 'review') {
          this.checkoutLoading = true;
          this.requestUpdate();
          await this.loadCart();
          this.checkoutLoading = false;
        }

        // Map internal step names to readable names
        const stepNames: Record<string, string> = {
          'customer': 'contact_information',
          'shipping': 'shipping_address',
          'billing': 'billing_address',
          'payment': 'payment_method',
          'review': 'order_review'
        };

        // Track completion of current step with specific event
        this.track(this.getStepEventName(previousStep, 'completed'), {
          step_name: stepNames[previousStep],
          step_number: steps.indexOf(previousStep) + 1,
          next_step: stepNames[nextStep],
          total_steps: steps.length,
          cart_value: this.cart?.totals?.total?.amount,
          progress_percentage: Math.round(((steps.indexOf(nextStep) + 1) / steps.length) * 100)
        });

        // Move to next step
        this.checkoutStep = nextStep;

        // Track viewing the new step with specific event
        this.track(this.getStepEventName(nextStep, 'viewed'), {
          step_name: stepNames[nextStep],
          step_number: steps.indexOf(nextStep) + 1,
          from_step: stepNames[previousStep],
          total_steps: steps.length,
          cart_value: this.cart?.totals?.total?.amount
        });
      }
    }
  }

  private getCheckoutStepTitle(): string {
    // Special case: if we're on customer step and showing OTP form
    if (this.checkoutStep === 'customer' && this.loginLinkSent) {
      return t('checkout.enter_code', 'Enter verification code');
    }
    
    switch (this.checkoutStep) {
      case 'customer': return t('checkout.contact_info', 'Contact Info');
      case 'shipping': return t('checkout.shipping_address', 'Shipping Address');
      case 'billing': return t('checkout.billing_address', 'Billing Address');
      case 'payment': return t('checkout.payment', 'Payment');
      case 'review': return t('checkout.review_order', 'Review Order');
      default: return t('checkout.proceed', 'Checkout');
    }
  }

  private handleBackButton(): void {
    // Clear any error state when navigating back
    this.showOrderFailureMessage = false;
    this.isPaymentFailure = false;
    this.orderFailureReason = '';

    // Special case: if showing OTP form, go back to contact form
    if (this.checkoutStep === 'customer' && this.loginLinkSent) {
      this.loginLinkSent = false;
      this.otpCode = '';
      this.otpError = '';
      return;
    }

    // Otherwise handle normal back navigation
    if (this.checkoutStep === 'customer') {
      this.exitCheckout();
    } else {
      this.previousCheckoutStep();
    }
  }

  private previousCheckoutStep(): void {
    const steps = this.getCheckoutSteps();
    
    const currentIndex = steps.indexOf(this.checkoutStep);
    if (currentIndex > 0 && currentIndex < steps.length) {
      const previousStep = steps[currentIndex - 1];
      if (previousStep) {
        const fromStep = this.checkoutStep;
        
        // Map internal step names to readable names
        const stepNames: Record<string, string> = {
          'customer': 'contact_information',
          'shipping': 'shipping_address',
          'billing': 'billing_address',
          'payment': 'payment_method',
          'review': 'order_review'
        };
        
        // Track going back
        this.track(EVENTS.CHECKOUT_STEP_BACK, {
          from_step: stepNames[fromStep],
          to_step: stepNames[previousStep],
          step_number: steps.indexOf(previousStep) + 1,
          total_steps: steps.length,
          cart_value: this.cart?.totals?.total?.amount
        });
        
        // Move back to previous step
        this.checkoutStep = previousStep;
      }
    }
  }

  private handleCustomerChange(e: CustomEvent): void {
    const { customer } = e.detail;
    // Update cart state instead of local state
    cartState.updateCheckoutData(customer);
    this.customerErrors = {}; // Clear errors on change
    
    // Track customer data entry
    if (customer.email && customer.email !== this.customerData.email) {
      this.track(EVENTS.CHECKOUT_EMAIL_ENTERED, {
        step: 'customer',
        has_account: this.customerCheckResult?.exists || false
      });
    }
    
    if (customer.firstName && customer.lastName &&
        (customer.firstName !== this.customerData.firstName ||
         customer.lastName !== this.customerData.lastName)) {
      this.track(EVENTS.CHECKOUT_NAME_ENTERED, {
        step: 'customer',
        is_guest: this.isGuest
      });
    }
    
    if (customer.phone && customer.phone !== this.customerData.phone) {
      this.track(EVENTS.CHECKOUT_PHONE_ENTERED, {
        step: 'customer'
      });
    }
  }
  
  

  private handleCustomerCheck(e: CustomEvent): void {
    const { email } = e.detail;
    
    // Only check if email has changed
    if (this.lastCheckedEmail === email) {
      return;
    }
    
    // Clear any existing timeout
    if (this.customerCheckTimeout) {
      clearTimeout(this.customerCheckTimeout);
    }
    
    // Reset states when email changes
    this.customerCheckResult = undefined;
    this.showPasswordField = false;
    this.authDismissed = false;
    this.loginLinkSent = false;
    this.otpCode = '';
    this.otpError = '';
    
    // Debounce the customer check
    this.customerCheckTimeout = setTimeout(async () => {
      // Only check if we have a valid email
      if (!email || !email.includes('@')) return;
      
      // Store the email we're checking
      this.lastCheckedEmail = email;
      
      try {
        this.checkingCustomer = true;
        // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
        const result = await this.sdk.cart.checkCheckoutData(email);
        
        // Update state based on result
        this.customerCheckResult = result;

        // Track customer identification result
        this.track(EVENTS.CHECKOUT_CUSTOMER_IDENTIFIED, {
          email,
          exists: result.exists,
          has_password: result.hasPassword
        });

        // Don't auto-expand password field — show compact banner first
        // User clicks "Sign in" in the banner to expand it
        this.showPasswordField = false;
        this.authDismissed = false;

        // Reset login state when checking new email
        this.loginLinkSent = false;
        this.customerPassword = '';
      } catch (error) {
        console.error('Customer check failed:', error);
      } finally {
        this.checkingCustomer = false;
      }
    }, 500); // 500ms debounce
  }

  private async handleSendLoginLink(): Promise<void> {
    if (!this.customerData.email || this.sendingLoginLink) return;

    // Track method selection when user had both options
    if (this.customerCheckResult?.hasPassword) {
      this.track(EVENTS.CHECKOUT_AUTH_METHOD_SELECTED, {
        email: this.customerData.email,
        method: 'otp',
        had_password_option: true
      });
    }

    // Track auth request
    this.track(EVENTS.CHECKOUT_AUTH_REQUESTED, {
      email: this.customerData.email,
      step: 'customer',
      method: 'otp'
    });
    
    try {
      this.sendingLoginLink = true;
      // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
      const result = await this.sdk.cart.sendAuth(this.customerData.email);

      // API now returns camelCase via AuthStatusResource
      if (result.authSent) {
        this.loginLinkSent = true;
        // Don't auto-hide when showing OTP form - user needs time to enter code
        // The OTP form will clear loginLinkSent when verification is complete or resend is clicked

        // Auto-focus the first OTP input after render
        this.updateComplete.then(() => {
          const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
          firstInput?.focus();
        });
      }
    } catch (error: any) {
      console.error('Failed to send authentication:', error);

      // Handle specific error types
      let errorMessage = t('error.verification_send_failed', 'Failed to send verification code. Please try again.');

      // API wrapper returns { status, message, code } directly (not response.status)
      if (error.status === 429) {
        errorMessage = t('error.rate_limit', 'Too many attempts. Please wait a moment before trying again.');
      } else if (error.message && error.message !== 'API request failed') {
        errorMessage = error.message;
      }

      this.showAnimatedError(errorMessage);
    } finally {
      this.sendingLoginLink = false;
    }
  }

  // OTP handling methods
  private handleOtpInput(e: Event, index: number): void {
    const input = e.target as HTMLInputElement;
    const value = input.value;
    
    // Only accept numbers
    if (!/^\d*$/.test(value)) {
      input.value = '';
      return;
    }
    
    // Clear error when user starts typing again
    if (this.otpError) {
      this.otpError = '';
    }
    
    // Update OTP code
    const otpArray = this.otpCode.split('');
    otpArray[index] = value;
    this.otpCode = otpArray.join('');
    
    // Auto-focus next input
    if (value && index < 5) {
      const nextInput = this.shadowRoot?.querySelector(`[data-otp-index="${index + 1}"]`) as HTMLInputElement;
      nextInput?.focus();
    }
    
    // Auto-submit when all 6 digits are entered
    if (this.otpCode.length === 6 && /^\d{6}$/.test(this.otpCode)) {
      this.handleVerifyOtp();
    }
  }
  
  private handleOtpKeydown(e: KeyboardEvent, index: number): void {
    // Handle backspace
    if (e.key === 'Backspace' && !this.otpCode[index] && index > 0) {
      const prevInput = this.shadowRoot?.querySelector(`[data-otp-index="${index - 1}"]`) as HTMLInputElement;
      prevInput?.focus();
    }
  }
  
  private handleOtpPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const paste = e.clipboardData?.getData('text');
    if (paste && /^\d{6}$/.test(paste)) {
      this.otpCode = paste;
      
      // Fill all input fields visually
      const inputs = this.shadowRoot?.querySelectorAll('.sr-otp-input') as NodeListOf<HTMLInputElement>;
      paste.split('').forEach((digit, index) => {
        if (inputs[index]) {
          inputs[index].value = digit;
        }
      });
      
      // Focus last input
      const lastInput = this.shadowRoot?.querySelector('[data-otp-index="5"]') as HTMLInputElement;
      lastInput?.focus();
      
      // Auto-submit after paste
      this.handleVerifyOtp();
    }
  }
  
  private async handleVerifyOtp(): Promise<void> {
    if (this.otpCode.length !== 6 || this.verifyingOtp || !this.customerData.email) return;
    
    try {
      this.verifyingOtp = true;
      
      // Call API to verify OTP
      // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
      const result = await this.sdk.cart.verifyAuth(this.customerData.email, this.otpCode);

      if (result.authenticated) {
        this.authenticatedDuringCheckout = true;
        sessionStorage.setItem('shoprocket_authenticated', '1');

        // Track successful auth
        this.track(EVENTS.CHECKOUT_AUTH_SUCCESS, {
          email: this.customerData.email,
          step: 'customer',
          method: 'otp'
        });
        
        // Success - customer is now linked to cart
        this.loginLinkSent = false;
        this.otpCode = '';
        this.otpError = ''; // Clear any error
        this.customerCheckResult = undefined; // Clear check result
        
        // Force reload the checkout data which now contains the customer's saved details
        await this.loadCheckoutData(true);
        
        // Move to shipping step automatically since we have their data
        this.checkoutStep = 'shipping';
        
        // Track auto-advance after authentication
        this.track(EVENTS.CHECKOUT_CONTACT_COMPLETED, {
          step_name: 'contact_information',
          step_number: 1,
          next_step: 'shipping_address',
          total_steps: this.sameAsBilling ? 4 : 5,
          auto_advance: true,
          reason: 'authenticated_user'
        });
        
        this.track(EVENTS.CHECKOUT_SHIPPING_VIEWED, {
          step_name: 'shipping_address',
          step_number: 2,
          from_step: 'contact_information',
          total_steps: this.sameAsBilling ? 4 : 5
        });
      } else {
        // Track failed auth
        this.track(EVENTS.CHECKOUT_AUTH_FAILED, {
          email: this.customerData.email,
          step: 'customer',
          method: 'otp',
          error: 'invalid_code'
        });
        
        // Invalid OTP
        const errorMessage = result.message || t('error.invalid_code', 'Invalid verification code. Please try again.');
        this.otpError = errorMessage;
        this.showAnimatedError(errorMessage);
        this.otpCode = ''; // Clear the code
        
        // Clear all input fields
        const inputs = this.shadowRoot?.querySelectorAll('.sr-otp-input') as NodeListOf<HTMLInputElement>;
        inputs.forEach(input => input.value = '');
        
        // Focus first input
        const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
        firstInput?.focus();
      }
    } catch (error: any) {
      console.error('OTP verification failed:', error);
      // Handle API error response
      let errorMessage = t('error.verification_failed', 'Verification failed. Please try again.');

      // API wrapper returns { status, message, code } directly
      if (error.message && error.message !== 'API request failed') {
        errorMessage = error.message;
      }

      this.otpError = errorMessage;
      this.showAnimatedError(errorMessage);
      this.otpCode = ''; // Clear the code

      // Clear all input fields
      const inputs = this.shadowRoot?.querySelectorAll('.sr-otp-input') as NodeListOf<HTMLInputElement>;
      inputs.forEach(input => input.value = '');
      
      // Focus first input
      const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
      firstInput?.focus();
    } finally {
      this.verifyingOtp = false;
    }
  }

  private async handlePasswordLogin(): Promise<void> {
    if (!this.customerPassword || !this.customerData.email || this.signingIn) return;

    // Track method selection (password chosen over OTP)
    this.track(EVENTS.CHECKOUT_AUTH_METHOD_SELECTED, {
      email: this.customerData.email,
      method: 'password',
      had_password_option: true
    });

    try {
      this.signingIn = true;

      // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
      const result = await this.sdk.cart.passwordLogin(this.customerData.email, this.customerPassword);

      if (!result.authenticated) {
        throw new Error(result.message || 'Invalid email or password.');
      }

      this.authenticatedDuringCheckout = true;
      sessionStorage.setItem('shoprocket_authenticated', '1');

      // Track successful auth
      this.track(EVENTS.CHECKOUT_AUTH_SUCCESS, {
        email: this.customerData.email,
        step: 'customer',
        method: 'password'
      });

      // Clear auth state
      this.loginLinkSent = false;
      this.customerPassword = '';
      this.customerCheckResult = undefined;

      // Reload checkout data with saved addresses
      await this.loadCheckoutData(true);

      // Advance to shipping
      this.checkoutStep = 'shipping';

      // Track auto-advance after authentication
      this.track(EVENTS.CHECKOUT_CONTACT_COMPLETED, {
        step_name: 'contact_information',
        step_number: 1,
        next_step: 'shipping_address',
        total_steps: this.sameAsBilling ? 4 : 5,
        auto_advance: true,
        reason: 'authenticated_user'
      });

      this.track(EVENTS.CHECKOUT_SHIPPING_VIEWED, {
        step_name: 'shipping_address',
        step_number: 2,
        from_step: 'contact_information',
        total_steps: this.sameAsBilling ? 4 : 5
      });
    } catch (error: any) {
      console.error('Password login failed:', error);

      this.track(EVENTS.CHECKOUT_AUTH_FAILED, {
        email: this.customerData.email,
        step: 'customer',
        method: 'password',
        error: error.status === 429 ? 'rate_limited' : 'invalid_credentials'
      });

      let errorMessage = t('error.login_failed', 'Invalid email or password. Please try again.');
      if (error.message && error.message !== 'API request failed') {
        errorMessage = error.message;
      }

      this.showAnimatedError(errorMessage);
      this.customerPassword = '';
    } finally {
      this.signingIn = false;
    }
  }

  private async handleResendOtp(): Promise<void> {
    // Track OTP resend
    this.track(EVENTS.CHECKOUT_AUTH_RESENT, {
      email: this.customerData.email,
      step: 'customer'
    });
    
    // Clear the OTP code and error, but keep the form visible
    this.otpCode = '';
    this.otpError = '';
    this.resendingOtp = true;
    
    // Clear all input fields
    this.updateComplete.then(() => {
      const inputs = this.shadowRoot?.querySelectorAll('.sr-otp-input') as NodeListOf<HTMLInputElement>;
      inputs.forEach(input => input.value = '');
    });
    
    try {
      // Send new OTP without hiding the form
      // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
      const result = await this.sdk.cart.sendAuth(this.customerData.email);

      // API now returns camelCase via AuthStatusResource
      if (result.authSent) {
        // Keep loginLinkSent true to stay on OTP form
        // Just focus the first input again
        this.updateComplete.then(() => {
          const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
          firstInput?.focus();
        });
      }
    } catch (error: any) {
      console.error('Failed to resend authentication:', error);

      // Handle specific error types
      let errorMessage = t('error.resend_failed', 'Failed to resend code. Please try again.');

      // API wrapper returns { status, message, code } directly (not response.status)
      if (error.status === 429) {
        errorMessage = t('error.rate_limit', 'Too many attempts. Please wait a moment before trying again.');
      } else if (error.message && error.message !== 'API request failed') {
        errorMessage = error.message;
      }

      this.otpError = errorMessage;
      this.showAnimatedError(errorMessage);
    } finally {
      this.resendingOtp = false;
    }
  }

  private handleShippingAddressChange(e: CustomEvent): void {
    const { address } = e.detail;
    // Update cart state instead of local state
    cartState.updateShippingAddress(address);
    this.shippingErrors = {}; // Clear errors on change
    
    // Track shipping address entry (only when complete)
    if (address.line1 && address.city && address.postalCode && address.country) {
      this.track(EVENTS.CHECKOUT_SHIPPING_ENTERED, {
        step: 'shipping',
        country: address.country,
        has_line2: !!address.line2
      });
    }
  }
  

  private handleBillingAddressChange(e: CustomEvent): void {
    const { address } = e.detail;
    // Update cart state instead of local state
    cartState.updateBillingAddress(address);
    this.billingErrors = {}; // Clear errors on change
    
    // Track billing address entry (only when complete and not same as shipping)
    if (!this.sameAsBilling && address.line1 && address.city && address.postalCode && address.country) {
      this.track(EVENTS.CHECKOUT_BILLING_ENTERED, {
        step: 'billing',
        country: address.country,
        different_from_shipping: true
      });
    }
  }


  // Cart state now handles all debouncing and API synchronization

  private handleStepNext(): void {
    // Basic validation - just check required fields are not empty
    // Full validation happens server-side on checkout submit
    if (this.checkoutStep === 'customer') {
      // Basic required field check
      const cs = this.checkoutSettings;
      const schema = {
        email: ['required' as const, 'email' as const],
        firstName: this.isGuest ? ['required' as const] : [],
        lastName: this.isGuest ? ['required' as const] : [],
        ...(cs?.phoneNumberField === 'required' ? { phone: ['required' as const] } : {})
      };
      
      this.customerErrors = validateForm(this.customerData, schema) as CustomerFormErrors;
      
      if (hasErrors(this.customerErrors)) {
        this.requestUpdate();
        return;
      }
    } else if (this.checkoutStep === 'shipping') {
      // Basic required field check - respect checkout settings visibility
      const cs = this.checkoutSettings;
      const schema: Record<string, ('required')[]> = {
        line1: ['required'],
        city: ['required'],
        postalCode: ['required'],
        country: ['required'],
        ...(countryRequiresState(this.shippingAddress.country) ? { state: ['required'] } : {}),
        ...(cs?.companyNameField === 'required' ? { company: ['required'] } : {}),
        ...(cs?.addressLine2Field === 'required' ? { line2: ['required'] } : {})
      };

      this.shippingErrors = validateForm(this.shippingAddress, schema) as AddressFormErrors;

      if (hasErrors(this.shippingErrors)) {
        this.requestUpdate();
        return;
      }
    } else if (this.checkoutStep === 'billing' && !this.sameAsBilling) {
      // Basic required field check - respect checkout settings visibility
      const cs = this.checkoutSettings;
      const schema: Record<string, ('required')[]> = {
        line1: ['required'],
        city: ['required'],
        postalCode: ['required'],
        country: ['required'],
        ...(countryRequiresState(this.billingAddress.country) ? { state: ['required'] } : {}),
        ...(cs?.companyNameField === 'required' ? { company: ['required'] } : {}),
        ...(cs?.addressLine2Field === 'required' ? { line2: ['required'] } : {})
      };

      this.billingErrors = validateForm(this.billingAddress, schema) as AddressFormErrors;

      if (hasErrors(this.billingErrors)) {
        this.requestUpdate();
        return;
      }
    } else if (this.checkoutStep === 'payment') {
      // Must have a payment method selected
      if (!this.selectedPaymentMethod) {
        return; // Don't proceed without selection
      }
    }

    // Clear errors and navigate to next step
    this.customerErrors = {};
    this.shippingErrors = {};
    this.billingErrors = {};
    this.nextCheckoutStep();
  }

  private async handleCheckoutComplete(): Promise<void> {
    // Validate terms acceptance if required
    if (this.checkoutSettings?.termsMode === 'required_checkbox' && !this.termsAccepted) {
      this.showAnimatedError(t('checkout.terms_required', 'Please accept the terms and conditions to continue.'));
      return;
    }

    // Validate payment method is selected before proceeding
    if (!this.selectedPaymentMethod) {
      // Ensure methods are loaded
      await this.loadPaymentMethods();

      // If only one method, auto-select and continue (don't show payment step)
      if (this.paymentMethods.length === 1) {
        this.selectedPaymentMethod = this.paymentMethods[0];
      } else {
        // Multiple methods — send user to payment step to choose
        this.checkoutStep = 'payment';
        return;
      }
    }

    // Server will perform full validation (stock, prices, taxes, addresses, etc.)
    // and return errors if anything is invalid
    this.checkoutLoading = true;

    try {
      // Flush any pending cart state changes to the API before checkout
      await cartState.flush();

      // Server validates everything: stock levels, prices, addresses, etc.
      const currentUrl = window.location?.href?.split('?')[0]?.split('#')[0] || '';

      // Build checkout options from selected payment method
      const pm = this.selectedPaymentMethod;
      const checkoutApiResponse = await this.sdk.cart.checkout({
        gateway: pm?.gateway || 'stripe',
        manualPaymentMethodId: pm?.manualMethodId || pm?.manual_method_id,
        locale: 'en',
        returnUrl: `${currentUrl}#!/payment-return`,
        cancelUrl: `${currentUrl}#!/payment-cancelled`,
        agreeToTerms: this.termsAccepted || undefined,
        marketingOptIn: this.marketingOptIn || undefined,
        notes: this.orderNotes || undefined
      });
      
      // Handle wrapped API response format
      const checkoutResponse = 'data' in checkoutApiResponse ? checkoutApiResponse.data : checkoutApiResponse;
      const checkoutMeta = 'meta' in checkoutApiResponse ? checkoutApiResponse.meta : null;
      
      // Store order ID for later reference
      const orderId = checkoutResponse.id || checkoutResponse.order_id;
      if (orderId) {
        this.storeOrderId(orderId);
      }

      // Handle different order types
      if (checkoutMeta?.payment_url) {
        // Order requires payment - redirect to gateway
        // Track redirect
        this.track(EVENTS.CHECKOUT_PAYMENT_REDIRECT, {
          order_id: checkoutResponse.id,
          payment_gateway: checkoutMeta.payment_gateway,
          test_mode: checkoutMeta.test_mode
        });

        // Modify payment URL to include order ID in return URLs if possible
        let paymentUrl = checkoutMeta.payment_url;

        // For some gateways, we can update return URLs by modifying the payment URL
        // This is gateway-specific - for now just store order ID and redirect
        // Keep loading state active during redirect
        // Don't set checkoutLoading = false, let the redirect happen with spinner visible
        window.location.href = paymentUrl;

        // Return early but don't clear loading state
        // The finally block will be skipped by returning here without throwing
        return; // Stop here, payment will be handled on return
        
      } else if (checkoutResponse.status === 'completed' || checkoutResponse.status === 'paid') {
        // Free order, 100% discount, or instant payment method
        // Track purchase
        this.track(EVENTS.PURCHASE, { order: checkoutResponse });
        
        // Show success in the cart body
        this.showOrderSuccessMessage = true;
        this.orderDetails = checkoutResponse;
        this.schedulePostCheckoutRedirect();

        // Clear cart state and checkout data
        cartState.clear();

        // Reset the UI to show empty cart
        this.cart = null;
        this.exitCheckout();
        
        // Regenerate cart token for next order
        const newToken = CookieManager.regenerateCartToken();
        internalState.setCartToken(newToken);
        
        // Update SDK with new token
        if (this.sdk) {
          this.sdk.setCartToken(newToken);
        }
        
        // Force refresh of cart state to ensure clean slate
        await this.loadCart();

        // Clear loading state for completed orders
        this.checkoutLoading = false;

      } else if (checkoutResponse.status === 'pending' && checkoutResponse.paymentMethod === 'offline') {
        // Offline payment method (cash on delivery, bank transfer, etc.)
        // Track as purchase but show special instructions
        this.track(EVENTS.PURCHASE, { 
          order: checkoutResponse,
          payment_type: 'offline'
        });
        
        // Show success with offline payment instructions
        this.showOrderSuccessMessage = true;
        this.orderDetails = checkoutResponse;
        this.schedulePostCheckoutRedirect();
        
        // Clear cart and reset as with completed orders
        cartState.clear();
        this.cart = null;
        this.exitCheckout();
        
        const newToken = CookieManager.regenerateCartToken();
        internalState.setCartToken(newToken);
        if (this.sdk) {
          this.sdk.setCartToken(newToken);
        }
        await this.loadCart();

        // Clear loading state for offline payment orders
        this.checkoutLoading = false;
      } else if (checkoutResponse.paymentStatus === 'pending' || checkoutResponse.status === 'pending') {
        // Order exists with pending payment but no payment URL returned
        // This happens when retrying checkout on an existing order
        this.showOrderFailureMessage = true;
        this.isPaymentFailure = true;
        this.orderFailureReason = t('error.payment_retry', 'Unable to create a new payment session. Please try again.');
        this.checkoutLoading = false;
      } else {
        // Truly unexpected response
        console.warn('Unexpected checkout response:', checkoutResponse);
        this.checkoutLoading = false;
      }
      
    } catch (error: any) {
      console.error('Checkout failed:', error);
      
      // Track checkout error
      this.track(EVENTS.CHECKOUT_ERROR, {
        step: 'review',
        error_type: 'checkout_failed',
        error_message: error.message || 'Unknown error'
      });
      
      // Extract error message — prefer specific validation errors over generic message
      let errorMessage = t('error.checkout_failed', 'Checkout failed. Please try again.');

      // Check for cart validation errors (stock, price changes, etc.)
      const validationErrors = error.details?.validation_errors
        || error.response?.data?.error?.details?.validation_errors
        || error.data?.error?.details?.validation_errors;

      if (validationErrors?.length) {
        // Use the specific validation error messages (deduplicated)
        errorMessage = [...new Set(validationErrors.map((e: any) => e.message))].join('\n');
      } else if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.data?.error?.message) {
        errorMessage = error.data.error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      // Check if order expired (not found error)
      const isExpiredOrder = errorMessage.includes('not found') || errorMessage.includes('expired');
      if (isExpiredOrder) {
        errorMessage = t('error.order_expired', 'Order expired. Please start a new order or contact support if you need assistance.');
      }

      // Show error in cart view, not as floating notification
      this.showOrderFailureMessage = true;
      this.isPaymentFailure = false; // API errors can auto-hide
      this.orderFailureReason = errorMessage;
      this.orderFailureCode = error.code || '';

      // Auto-hide after 10 seconds (only for API errors, not payment failures)
      const timeout = setTimeout(() => {
        if (!this.isPaymentFailure) {
          this.showOrderFailureMessage = false;
          this.orderFailureReason = '';
        }
      }, 10000);
      this.timeouts.add(timeout);

      // Only clear loading on error, not on successful redirect
      this.checkoutLoading = false;
    }

    // Note: checkoutLoading stays true for payment redirects to show spinner during navigation
  }

  protected override render(): TemplateResult {
    // Calculate total quantity across all items
    const totalQuantity = this.cart?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

    return html`
      <!-- Generic Overlay -->
      <div
        class="sr-cart-overlay ${this.isOpen ? 'open' : 'closed'}"
        @click="${() => this.isOpen && this.closeCart()}"
      ></div>

      <!-- Cart Toggle Button -->
      <div class="sr-cart-toggle-container sr-cart-toggle-${this.position} ${this.floating ? 'sr-cart-floating' : ''}" data-shoprocket="cart-toggle">
        <button
          class="sr-cart-toggle-button ${this.isOpen ? 'hidden' : ''}"
          @click="${this.toggleCart}"
          aria-label="${t('cart.open', 'Open shopping cart')}"
        >
          ${this.renderTriggerContent(totalQuantity)}
        </button>

        ${this.renderNotification()}
      </div>

      <!-- Cart Panel - SEPARATE from toggle button -->
      <div class="sr-cart-panel sr-cart-panel-${this.effectiveWidgetStyle} sr-cart-panel-${this.position} ${this.isOpen ? 'open' : 'closed'}">
        <div class="sr-cart-header ${this.effectiveWidgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-header` : ''}">
          ${this.isCheckingOut ? html`
            <button 
              class="sr-cart-back-arrow" 
              @click="${this.handleBackButton}"
              title="Back"
            >
              ←
            </button>
          ` : ''}
          <h2 class="sr-cart-title">
            ${this.isCheckingOut ? this.getCheckoutStepTitle() : t('cart.title', 'Cart')}
          </h2>
          <button class="sr-cart-close" @click="${() => this.closeCart()}" aria-label="${t('cart.close', 'Close cart')}">
            <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
          ${this.renderInCartNotification()}
        </div>
        <div class="sr-cart-body ${this.effectiveWidgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-items` : ''}">
          ${this.checkoutLoading && !this.isCheckingOut ? loadingOverlay() :
          this.isCheckingOut && !this.showOrderSuccessMessage && !this.showOrderFailureMessage && !this.showOrderNotFound ?
            this.renderCheckoutFlow() :
            this.paymentPending ? this.renderPaymentPending() :
            this.showOrderSuccessMessage ? this.renderOrderSuccess() :
            this.showOrderFailureMessage ? this.renderOrderFailure() :
            this.showOrderNotFound ? this.renderOrderNotFound() :
            this.renderCartItems()}
        </div>
        ${!this.showOrderSuccessMessage && !this.showOrderFailureMessage && !this.showOrderNotFound && !this.paymentPending && this.cart?.items?.length ? html`
          <div class="sr-cart-footer ${this.effectiveWidgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-footer` : ''}">
            ${this.isCheckingOut ? this.renderCheckoutFooter() : this.renderCartFooter()}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderCartItems(): TemplateResult {
    // If modules not loaded yet, show loading spinner (rare - only if user is very fast)
    if (!this.cartModules.cartItems) {
      this.ensureModule('cartItems').then(() => this.requestUpdate());
      return loadingOverlay();
    }

    const context: CartItemsContext = {
      cart: this.cart,
      showEmptyState: this.showEmptyState,
      removingItems: this.removingItems,
      closeCart: () => this.closeCart(),
      navigateToProduct: (item) => this.navigateToProduct(item),
      updateQuantity: (itemId, quantity) => this.updateQuantity(itemId, quantity),
      removeItem: (itemId) => this.removeItem(itemId),
      formatPrice: (amount) => this.formatPrice(amount),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e)
    };

    return this.cartModules.cartItems.renderCartItems(context);
  }

  private renderCartFooter(): TemplateResult {
    if (!this.cartModules.cartFooter) {
      this.ensureModule('cartFooter').then(() => this.requestUpdate());
      return html``;
    }

    const context: CartFooterContext = {
      cart: this.cart,
      chunkLoading: this.chunkLoading,
      formatPrice: (amount) => this.formatPrice(amount),
      startCheckout: () => this.startCheckout(),
      couponCode: this.couponCode,
      couponError: this.couponError,
      couponLoading: this.couponLoading,
      showCouponField: this.checkoutSettings?.showCouponField ?? true,
      onCouponInput: (value: string) => { this.couponCode = value; this.couponError = null; },
      onApplyCoupon: () => this.applyCoupon(),
      onRemoveCoupon: () => this.removeCoupon(),
    };

    return this.cartModules.cartFooter.renderCartFooter(context);
  }

  private async applyCoupon(): Promise<void> {
    if (!this.couponCode.trim() || this.couponLoading) return;
    this.couponLoading = true;
    this.couponError = null;
    try {
      const result = await this.sdk.cart.applyDiscount(this.couponCode.trim());
      if (result.cart) cartState.setCart(result.cart);
      this.couponCode = '';
    } catch (err: any) {
      this.couponError = err?.message || t('cart.coupon_invalid', 'Invalid discount code');
    } finally {
      this.couponLoading = false;
    }
  }

  private async removeCoupon(): Promise<void> {
    try {
      const result = await this.sdk.cart.removeDiscount();
      if (result.cart) cartState.setCart(result.cart);
    } catch (err: any) {
      console.error('Failed to remove discount:', err);
    }
  }
  
  /** Default no-op account creation context for non-success order result screens */
  private defaultAccountCreationContext() {
    return {
      isAuthenticated: true, // Hide account creation on non-success screens
      accountPassword: '',
      creatingAccount: false,
      accountCreated: false,
      accountError: '',
      handleAccountPasswordInput: () => {},
      handleCreateAccount: async () => {}
    };
  }

  /** Default no-op context fields for screens that don't use them */
  private defaultOrderResultContext(): Partial<OrderResultContext> {
    return {
      checkingOrderStatus: false
    };
  }

  private renderOrderSuccess(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingOverlay();
    }

    const orderData = this.orderDetails?.data || this.orderDetails;
    const customerEmail = orderData?.customer?.email || this.customerData.email;

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => this.handleContinueShopping(),
      handleCheckOrderStatus: () => {},
      handleRetryPayment: () => {},
      handleBackToCart: () => this.exitCheckout(),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e),
      checkingOrderStatus: false,

      // Checkout settings
      confirmationMessage: this.checkoutSettings?.confirmationMessage,
      redirectAfterCheckout: this.checkoutSettings?.redirectAfterCheckout,
      redirectUrl: this.checkoutSettings?.redirectUrl,
      redirecting: this.redirecting,

      // Account creation - hide if authenticated or customer already has an account
      isAuthenticated: this.authenticatedDuringCheckout || !!this.customerCheckResult?.hasPassword || !!this.cart?.isAuthenticated,
      accountPassword: this.accountPassword,
      creatingAccount: this.creatingAccount,
      accountCreated: this.accountCreated,
      accountError: this.accountError,
      handleAccountPasswordInput: (e: Event) => {
        this.accountPassword = (e.target as HTMLInputElement).value;
        this.accountError = '';
      },
      handleCreateAccount: async () => {
        if (this.accountPassword.length < 8) {
          this.accountError = t('error.password_too_short', 'Password must be at least 8 characters.');
          return;
        }

        try {
          this.creatingAccount = true;
          this.accountError = '';

          const email = customerEmail || this.customerData.email;
          // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
          const result = await this.sdk.cart.createAccount(email, this.accountPassword);

          if (!result.authenticated) {
            throw new Error(result.message || 'Failed to create account.');
          }

          this.accountCreated = true;
          this.accountPassword = '';

          this.track(EVENTS.CHECKOUT_ACCOUNT_CREATED, {
            email,
            method: 'post_checkout'
          });
        } catch (error: any) {
          console.error('Account creation failed:', error);
          this.accountError = error.message && error.message !== 'API request failed'
            ? error.message
            : t('error.account_creation_failed', 'Failed to create account. Please try again.');
        } finally {
          this.creatingAccount = false;
        }
      }
    };

    return this.cartModules.orderResult.renderOrderSuccess(this.orderDetails as OrderDetails, customerEmail, context);
  }
  
  /**
   * Schedule post-checkout redirect if configured.
   * Shows success for 3s, then auto-redirects with fallback link.
   */
  private schedulePostCheckoutRedirect(): void {
    const settings = this.checkoutSettings;
    if (settings?.redirectAfterCheckout && settings?.redirectUrl) {
      const timeout = setTimeout(() => {
        this.redirecting = true;
        // Give 500ms for "Redirecting..." text to show, then redirect
        const redirectTimeout = setTimeout(() => {
          if (settings.redirectUrl) {
            window.location.href = settings.redirectUrl;
          }
        }, 500);
        this.timeouts.add(redirectTimeout);
      }, 3000);
      this.timeouts.add(timeout);
    }
  }

  private handleContinueShopping(): void {
    this.stopPaymentPolling();
    this.showOrderSuccessMessage = false;
    this.orderDetails = null;
    this.shouldResetOnNextOpen = false; // Don't double-reset

    // Note: Cart token already regenerated when success was detected
    // closeCart() will handle payment return URL cleanup

    this.closeCart();

    // Reload cart to get fresh state with new token
    this.loadCart();
  }

  /**
   * Clean up payment return/cancelled URLs
   * Removes payment-return and payment-cancelled fragments and any gateway query params
   * Uses replaceState to avoid page reload
   */
  private cleanupPaymentReturnUrl(): void {
    const hash = window.location.hash;
    if (hash.includes('#!/payment-return') || hash.includes('#!/payment-cancelled')) {
      // Clean to cart hash: remove payment params but keep cart route
      const baseUrl = (window.location.href.split('?')[0] || '').split('#')[0] || window.location.origin;
      window.history.replaceState(null, '', `${baseUrl}#!/~/cart`);

      // Manually trigger hashchange to sync HashRouter (since replaceState doesn't trigger it)
      this.hashRouter['updateStateFromHash']();
    }
  }
  
  private renderPaymentPending(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingOverlay();
    }

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => this.handleContinueShopping(),
      handleCheckOrderStatus: async () => {
        const orderId = sessionStorage.getItem('shoprocket_order_id');
        if (!orderId) return;
        this.checkingOrderStatus = true;
        try {
          const result = await this.sdk.cart.getOrderStatus(orderId);
          const status = result.paymentStatus || result.status;
          if (status === 'paid' || status === 'processing' || status === 'completed') {
            await this.handlePaymentConfirmed(orderId);
          } else if (status === 'failed' || status === 'cancelled') {
            this.handlePaymentFailed();
          }
        } catch { /* swallow */ }
        finally { this.checkingOrderStatus = false; }
      },
      handleRetryPayment: async () => {
        this.stopPaymentPolling();
        this.paymentPending = false;
        this.paymentTimeout = false;
        this.checkoutStep = 'review';
        this.isCheckingOut = true;
        await Promise.all([
          this.ensureModule('checkoutWizard'),
          this.loadCheckoutData(true),
          this.loadPaymentMethods()
        ]);
        this.requestUpdate();
      },
      handleBackToCart: () => this.exitCheckout(),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e),
      checkingOrderStatus: this.checkingOrderStatus,
      ...this.defaultAccountCreationContext()
    };

    return this.cartModules.orderResult.renderPaymentPending(this.paymentTimeout, context);
  }
  
  private renderOrderFailure(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingOverlay();
    }

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => this.handleContinueShopping(),
      handleCheckOrderStatus: () => {},
      checkingOrderStatus: false,
      handleRetryPayment: async () => {
        this.showOrderFailureMessage = false;
        this.isPaymentFailure = false;
        this.orderFailureReason = '';
        this.checkoutStep = 'review';
        this.isCheckingOut = true;
        await Promise.all([
          this.ensureModule('checkoutWizard'),
          this.loadCheckoutData(true),
          this.loadPaymentMethods()
        ]);
        this.requestUpdate();
      },
      handleBackToCart: () => {
        // Clear stored order ID when going back to cart
        sessionStorage.removeItem('shoprocket_order_id');

        // Clear failure state
        this.showOrderFailureMessage = false;
        this.isPaymentFailure = false;
        this.orderFailureReason = '';
        this.orderDetails = null;

        // Clean up payment return URL
        this.cleanupPaymentReturnUrl();

        this.exitCheckout();
      },
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e),
      ...this.defaultAccountCreationContext()
    };

    return this.cartModules.orderResult.renderOrderFailure(this.orderFailureReason, context, this.orderFailureCode);
  }

  private renderOrderNotFound(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingOverlay();
    }

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => {
        this.showOrderNotFound = false;

        // Clean up payment return URL and trigger HashRouter update
        const baseUrl = (window.location.href.split('?')[0] || '').split('#')[0] || window.location.origin;
        window.history.replaceState(null, '', baseUrl);

        // Manually trigger hashchange to sync HashRouter (since replaceState doesn't trigger it)
        this.hashRouter['updateStateFromHash']();

        // Track cart closed (state will be synced via HashRouter)
        this.track(EVENTS.CART_CLOSED, this.cart);

        // Reload cart for fresh state
        this.loadCart();
      },
      handleCheckOrderStatus: () => {},
      checkingOrderStatus: false,
      handleRetryPayment: () => {},
      handleBackToCart: () => {
        this.showOrderNotFound = false;

        // Clean up payment return URL and trigger HashRouter update
        const baseUrl = (window.location.href.split('?')[0] || '').split('#')[0] || window.location.origin;
        window.history.replaceState(null, '', baseUrl);

        // Manually trigger hashchange to sync HashRouter
        this.hashRouter['updateStateFromHash']();

        // Exit checkout
        this.isCheckingOut = false;
        this.checkoutStep = 'customer';

        // Track cart closed (state will be synced via HashRouter)
        this.track(EVENTS.CART_CLOSED, this.cart);
      },
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e),
      ...this.defaultAccountCreationContext()
    };

    return this.cartModules.orderResult.renderOrderNotFound(context);
  }

  private buildCheckoutWizardContext(): CheckoutWizardContext {
    return {
      cart: this.cart,
      checkoutStep: this.checkoutStep,
      chunkLoading: this.chunkLoading,
      checkoutLoading: this.checkoutLoading,
      customerData: this.customerData,
      customerErrors: this.customerErrors,
      isGuest: this.isGuest,
      checkingCustomer: this.checkingCustomer,
      customerCheckResult: this.customerCheckResult,
      showPasswordField: this.showPasswordField,
      authDismissed: this.authDismissed,
      customerPassword: this.customerPassword,
      signingIn: this.signingIn,
      sendingLoginLink: this.sendingLoginLink,
      loginLinkSent: this.loginLinkSent,
      otpCode: this.otpCode,
      verifyingOtp: this.verifyingOtp,
      otpError: this.otpError,
      resendingOtp: this.resendingOtp,
      shippingAddress: this.shippingAddress,
      shippingErrors: this.shippingErrors,
      billingAddress: this.billingAddress,
      billingErrors: this.billingErrors,
      sameAsBilling: this.sameAsBilling,
      paymentMethods: this.paymentMethods,
      selectedPaymentMethod: this.selectedPaymentMethod,
      paymentMethodsLoading: this.paymentMethodsLoading,
      paymentStepSkipped: this.shouldSkipPaymentStep,
      reviewItemsExpanded: this.reviewItemsExpanded,
      checkoutSettings: this.checkoutSettings,
      termsAccepted: this.termsAccepted,
      marketingOptIn: this.marketingOptIn,
      orderNotes: this.orderNotes,
      handleTermsAcceptedChange: (checked: boolean) => { this.termsAccepted = checked; },
      handleMarketingOptInChange: (checked: boolean) => { this.marketingOptIn = checked; },
      handleOrderNotesChange: (value: string) => { this.orderNotes = value; },
      addressAutocompleteEnabled: !!this.getStore()?.features?.addressAutocomplete,
      visitorCountry: this.cart?.visitorCountry || '',
      sdk: this.sdk,
      handleBackButton: () => this.handleBackButton(),
      handleCustomerChange: (e) => this.handleCustomerChange(e),
      handleCustomerCheck: (e) => this.handleCustomerCheck(e),
      handleGuestToggle: (e: CustomEvent) => { this.isGuest = e.detail.isGuest; },
      handlePasswordInput: (e: Event) => { this.customerPassword = (e.target as HTMLInputElement).value; },
      handleSendLoginLink: () => this.handleSendLoginLink(),
      handlePasswordLogin: () => this.handlePasswordLogin(),
      handleShowPasswordField: () => { this.showPasswordField = true; },
      handleDismissAuth: () => { this.authDismissed = true; },
      handleOtpInput: (e, i) => this.handleOtpInput(e, i),
      handleOtpKeydown: (e, i) => this.handleOtpKeydown(e, i),
      handleOtpPaste: (e) => this.handleOtpPaste(e),
      handleResendOtp: () => this.handleResendOtp(),
      handleShippingAddressChange: (e) => this.handleShippingAddressChange(e),
      handleSameAsBillingChange: (e: CustomEvent) => {
        const checked = e.detail.checked;
        cartState.setSameAsBilling(checked);
        this.track(EVENTS.CHECKOUT_SAME_BILLING_TOGGLED, {
          step: 'shipping',
          same_as_shipping: checked
        });
      },
      handleBillingAddressChange: (e) => this.handleBillingAddressChange(e),
      handlePaymentMethodSelect: (method: any) => { this.selectedPaymentMethod = method; },
      toggleReviewItems: () => { this.reviewItemsExpanded = !this.reviewItemsExpanded; },
      handleStepNext: () => this.handleStepNext(),
      handleCheckoutComplete: () => this.handleCheckoutComplete(),
      setCheckoutStep: (step) => { this.checkoutStep = step; },
      exitCheckout: () => this.exitCheckout(),
      formatPrice: (amount) => this.formatPrice(amount),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e),
      getCheckoutStepTitle: () => this.getCheckoutStepTitle(),
      track: (event, data) => this.track(event, data),
    };
  }

  private renderCheckoutFlow(): TemplateResult {
    if (!this.cartModules.checkoutWizard) {
      return loadingOverlay();
    }

    return this.cartModules.checkoutWizard.renderCheckoutFlow(this.buildCheckoutWizardContext());
  }

  private renderCheckoutFooter(): TemplateResult {
    if (!this.cartModules.checkoutWizard) {
      return html``;
    }

    return this.cartModules.checkoutWizard.renderCheckoutFooter(this.buildCheckoutWizardContext());
  }

  // Track the last requested quantity for each item
  private lastRequestedQuantity: Map<string, number> = new Map();
  
  private async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    
    const item = this.cart?.items.find((i: any) => i.id === itemId);
    if (!item) return;
    
    // Store original quantity for analytics
    const originalQuantity = item.quantity;
    
    // Check if we're increasing quantity and need stock validation
    if (quantity > item.quantity) {
      // Check if item has inventory policy and stock info
      if (item.inventoryPolicy === 'deny' && item.inventoryCount !== undefined) {
        if (quantity > item.inventoryCount) {
          // Show error notification
          const message = item.inventoryCount === 0
            ? t('product.out_of_stock', 'Out of Stock')
            : t('product.max_quantity_in_cart', 'Maximum quantity ({count}) already in cart', { count: item.inventoryCount });
          
          window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ERROR, {
            detail: { message }
          }));
          return;
        }
      }
    }
    
    // Track what quantity we're requesting
    this.lastRequestedQuantity.set(itemId, quantity);
    
    // Optimistic update - immediately update quantity in UI (no totals recalc)
    item.quantity = quantity;
    this.cart.itemCount = this.cart.items?.reduce((count, i) => count + i.quantity, 0) || 0;
    this.requestUpdate();

    // Track quantity change with dedicated event
    this.track(EVENTS.CART_QUANTITY_UPDATED, {
      ...item,
      old_quantity: originalQuantity,
      new_quantity: quantity,
      delta: quantity - originalQuantity  // positive = increase, negative = decrease
    });

    // Cancel any pending update for this item
    if (this.pendingUpdates.has(itemId)) {
      clearTimeout(this.pendingUpdates.get(itemId));
      this.pendingUpdates.delete(itemId);
    }

    // Debounce the API call - server response updates totals authoritatively
    const timeoutId = setTimeout(() => {
      this.sdk.cart.updateItem(itemId, quantity).then(response => {
        if (response) cartState.setCart(response);
      }).catch(error => {
        console.error('Failed to update quantity:', error);
      });

      // Clean up
      this.pendingUpdates.delete(itemId);
      this.lastRequestedQuantity.delete(itemId);
    }, TIMEOUTS.DEBOUNCE);

    this.pendingUpdates.set(itemId, timeoutId);
  }

  private async removeItem(itemId: string): Promise<void> {
    const itemIndex = this.cart?.items.findIndex((i: any) => i.id === itemId);
    if (itemIndex === undefined || itemIndex < 0) return;
    
    // Store item data for analytics before removing
    const item = this.cart?.items[itemIndex];
    if (!item) return;
    
    // Store current open state
    const wasOpen = this.isOpen;
    
    // Mark item as being removed for animation
    this.removingItems.add(itemId);
    this.requestUpdate();
    
    // Wait for animation to complete
    const timeout = setTimeout(async () => {
      this.timeouts.delete(timeout);
      if (!this.cart) return;
      
      // Optimistic update - remove from UI after animation
      this.cart.items.splice(itemIndex, 1);
      this.cart.itemCount = this.cart.items.reduce((count, i) => count + i.quantity, 0) || 0;

      // Check if cart is now empty
      if (this.cart.items.length === 0) {
        this.showEmptyState = true;
      }

      this.removingItems.delete(itemId);
      this.requestUpdate();

      // Server response updates totals authoritatively
      this.sdk.cart.removeItem(itemId).then(response => {
        if (response) cartState.setCart(response);
      }).catch(error => {
        console.error('Failed to remove item:', error);
      });
      
      // Force cart to stay open after update
      this.isOpen = wasOpen;
      
      // If cart should be open, ensure URL has cart hash
      // Let the hash router handle this properly to preserve user hash
      if (wasOpen) {
        this.hashRouter.openCart();
      }
      
      // Cart state subscriptions handle updates
      
      // Track item removal
      this.track(EVENTS.REMOVE_FROM_CART, item);
    }, TIMEOUTS.ANIMATION); // Wait for slide out animation
  }

  private navigateToProduct(item: any): void {
    // Use source URL if available, otherwise fallback to hash navigation
    if (item.sourceUrl) {
      // Navigate to the original page where item was added
      window.location.href = item.sourceUrl;
    } else if (item.productSlug) {
      // Fallback to hash navigation on current page
      this.closeCart();
      // Use hash router to navigate properly
      this.hashRouter.navigateToProduct(item.productSlug);
    }
  }



  private renderTriggerContent(itemCount: number): TemplateResult {
    if (!this.cartModules.cartTrigger) {
      this.ensureModule('cartTrigger').then(() => this.requestUpdate());
      // Show icon immediately while module loads (don't show count until styled properly)
      return html`
        <span class="sr-cart-icon" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
      `;
    }

    return this.cartModules.cartTrigger.renderTriggerContent(itemCount, this.position, shoppingBasketIcon);
  }
  
  // Shared method for displaying animated error notifications (used by both events and direct calls)
  private showAnimatedError(message: string): void {
    // Clear any existing success notification
    this.recentlyAddedProduct = null;
    this.notificationSliding = null;
    if (this.notificationTimeouts.slideOut) {
      clearTimeout(this.notificationTimeouts.slideOut);
    }
    if (this.notificationTimeouts.remove) {
      clearTimeout(this.notificationTimeouts.remove);
    }

    // Clear any existing error timeouts
    if (this.errorNotificationTimeouts.slideOut) {
      clearTimeout(this.errorNotificationTimeouts.slideOut);
    }
    if (this.errorNotificationTimeouts.remove) {
      clearTimeout(this.errorNotificationTimeouts.remove);
    }

    // Show the error notification
    this.errorNotificationSliding = null;
    this.floatingErrorMessage = message;

    // Trigger animation after next render
    requestAnimationFrame(() => {
      this.errorNotificationSliding = 'in';

      // Start slide out after 4 seconds
      this.errorNotificationTimeouts.slideOut = setTimeout(() => {
        this.errorNotificationSliding = 'out';

        // Remove completely after slide animation completes
        this.errorNotificationTimeouts.remove = setTimeout(() => {
          this.floatingErrorMessage = null;
          this.errorNotificationSliding = null;
        }, TIMEOUTS.ANIMATION);
      }, 4000);
    });
  }

  private handleFloatingError = (event: CustomEvent): void => {
    const { message } = event.detail;
    this.showAnimatedError(message);
  }
  
  private renderNotification(): TemplateResult {
    if (!this.cartModules.cartTrigger) {
      // Notifications are non-critical, return empty if not loaded yet
      this.ensureModule('cartTrigger').then(() => this.requestUpdate());
      return html``;
    }

    const context: CartTriggerContext = {
      position: this.position,
      recentlyAddedProduct: this.recentlyAddedProduct,
      notificationSliding: this.notificationSliding,
      floatingErrorMessage: null, // Errors now only show inside cart header, not on trigger badge
      errorNotificationSliding: this.errorNotificationSliding,
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      formatPrice: (amount) => this.formatPrice(amount),
      handleImageError: (e) => this.handleImageError(e)
    };

    return this.cartModules.cartTrigger.renderNotification(context);
  }

  private renderInCartNotification(): TemplateResult {
    if (!this.floatingErrorMessage) {
      return html``;
    }

    let animationClass = '';
    if (this.errorNotificationSliding === 'in') {
      animationClass = 'sr-notification-slide-down-in';
    } else if (this.errorNotificationSliding === 'out') {
      animationClass = 'sr-notification-slide-down-out';
    }

    return html`
      <div class="sr-in-cart-notification sr-notification-error ${animationClass}">
        <div class="sr-in-cart-notification-content">
          <svg class="sr-notification-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div class="sr-in-cart-notification-message">
            <p>${this.floatingErrorMessage}</p>
          </div>
        </div>
      </div>
    `;
  }
}