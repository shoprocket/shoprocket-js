import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Cart, ApiResponse, Money } from '../types/api';
import { loadingSpinner } from './loading-spinner';
import { HashRouter, type HashState } from '../core/hash-router';
import { TIMEOUTS, WIDGET_EVENTS } from '../constants';
import './tooltip';
import { cartState } from '../core/cart-state';
import { internalState } from '../core/internal-state';
import { CookieManager } from '../utils/cookie-manager';
import { validateForm, hasErrors } from '../core/validation';

// Lazy import checkout components only when needed
import type { CustomerData, CustomerFormErrors } from './customer-form';
import type { AddressData, AddressFormErrors } from './address-form';

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
 * @attr {string} [data-style="bubble"] - Visual style (bubble, minimal, custom)
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

  @property({ type: String, attribute: 'data-style' })
  widgetStyle = 'bubble';

  @property({ type: Boolean })
  floating = false;

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
  
  
  // Track if checkout data has been loaded
  private checkoutDataLoaded = false;
  
  // Timeout tracking for cleanup
  private timeouts = new Set<NodeJS.Timeout>();
  
  // Track pending API calls for debouncing
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  
  // Cart state subscription
  private unsubscribeCartState?: () => void;
  
  @state()
  private priceChangedItems: Set<string> = new Set();
  
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
  private paymentPending = false;
  
  @state()
  // Payment polling removed - using order API approach
  
  // paymentPollingAttempts removed - no longer needed
  
  @state()
  private paymentTimeout = false;
  
  @state()
  private shouldResetOnNextOpen = false;

  private customerCheckTimeout?: NodeJS.Timeout;
  
  // Order ID for post-checkout order API access
  private currentOrderId?: string;
  private lastCheckedEmail?: string;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Initialize HashRouter first
    this.hashRouter = HashRouter.getInstance();
    
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
      
      // Request UI update
      this.requestUpdate();
    });
    
    // Listen for add item events (optimistic updates)
    this.handleAddItem = this.handleAddItem.bind(this);
    window.addEventListener(WIDGET_EVENTS.CART_ADD_ITEM, this.handleAddItem as EventListener);
    
    // Listen for product added events
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener(WIDGET_EVENTS.PRODUCT_ADDED, this.handleProductAdded as EventListener);
    
    // Listen for cart errors to show floating notifications
    this.handleFloatingError = this.handleFloatingError.bind(this);
    window.addEventListener(WIDGET_EVENTS.CART_ERROR, this.handleFloatingError as EventListener);
    
    
    // Set up HashRouter event handling (already initialized above)
    this.handleHashStateChange = this.handleHashStateChange.bind(this);
    this.hashRouter.addEventListener('state-change', this.handleHashStateChange);
    
    // Handle cart control events
    this.handleOpenCart = this.handleOpenCart.bind(this);
    this.handleCloseCart = this.handleCloseCart.bind(this);
    this.handleToggleCart = this.handleToggleCart.bind(this);
    window.addEventListener('open-cart', this.handleOpenCart as EventListener);
    window.addEventListener('close-cart', this.handleCloseCart as EventListener);
    window.addEventListener('toggle-cart', this.handleToggleCart as EventListener);
    
    // Cart state now manages internal state updates
    
    // Store data should already be cached by widget manager
    // If not available yet, wait a bit or skip (formatters will use defaults)
    
    // Load cart first
    await this.loadCart();
    
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

        // Cache the loaded modules
        this.cartModules = {
          cartItems,
          cartFooter,
          cartTrigger,
          orderResult
        };

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
    const { item, stockInfo } = event.detail;
    
    // Initialize cart first if needed
    if (!this.cart) {
      // Use store currency when creating new cart
      const currency = this.getStoreCurrency();
      const zeroPriceObj: Money = {
        amount: 0,
        currency,
        formatted: new Intl.NumberFormat('en-US', {
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
        item_count: 0
      };
      cartState.setCart(newCart as any);
      this.cart = newCart;
    }
    
    // Ensure cart has items array
    if (!this.cart.items) {
      this.cart.items = [];
    }
    
    // Find existing item (do this once)
    const existingItem = this.cart.items.find((cartItem: any) => 
      cartItem.product_id === item.product_id && 
      cartItem.variant_id === item.variant_id
    );
    
    // Validate stock if tracking inventory
    if (stockInfo?.track_inventory || stockInfo?.inventory_policy === 'deny') {
      const availableQuantity = stockInfo.available_quantity ?? stockInfo.inventory_count ?? 0;
      
      // Check if out of stock
      if (availableQuantity === 0) {
        window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ERROR, {
          detail: {
            type: 'out_of_stock',
            message: 'Sorry, this item is out of stock'
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
              `Only ${canAdd} more available` : 
              `Maximum quantity (${availableQuantity}) already in cart`,
            available_quantity: availableQuantity,
            current_quantity: currentQuantityInCart
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
        existingItem.inventory_policy = stockInfo.inventory_policy || (stockInfo.track_inventory ? 'deny' : 'continue');
        existingItem.inventory_count = stockInfo.inventory_count ?? stockInfo.available_quantity;
      }
    } else {
      // Add new item with a temporary ID and stock info
      const newItem = {
        ...item,
        id: 'temp-' + Date.now() + '-' + Math.random(),
        ...(stockInfo && {
          inventory_policy: stockInfo.inventory_policy || (stockInfo.track_inventory ? 'deny' : 'continue'),
          inventory_count: stockInfo.inventory_count ?? stockInfo.available_quantity
        })
      };
      this.cart.items.push(newItem);
    }
    
    // Update totals and cart state
    this.updateCartTotals();
    cartState.setCart(this.cart);
    this.showEmptyState = false;
    
    // Cart state subscriptions handle updates
    
    // Dispatch product added event for UI feedback
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.PRODUCT_ADDED, {
      detail: { 
        product: {
          id: item.product_id,
          name: item.product_name,
          price: item.price,
          media: (item as any).image || item.media?.[0],
          variantText: item.variant_name
        }
      }
    }));
    
    // Track add to cart event
    this.track(EVENTS.ADD_TO_CART, item);
    
    // Make API call and refresh cart with real data
    this.sdk.cart.addItem({
      product_id: item.product_id,
      variant_id: item.variant_id,
      quantity: item.quantity,
      source_url: item.source_url
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
  }


  private async loadCart(): Promise<void> {
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
          
          // Don't auto-set visitor_country as default - this causes unnecessary API calls on page load
          // The user can select their country when they get to checkout
          // if (cart?.visitor_country && !cart.has_shipping_address && !cart.has_billing_address) {
          //   cartState.updateShippingAddress({ country: cart.visitor_country });
          //   cartState.updateBillingAddress({ country: cart.visitor_country });
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
        this.showError('Failed to load cart data');
      }
    });
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
  
  private preloadCheckoutComponents(): void {
    // Preload checkout components if we have items and not already loading
    if (this.cart?.items?.length && !this.isCheckingOut && !this.chunkLoading) {
      // Fire and forget - don't await
      Promise.all([
        import('./customer-form'),
        import('./address-form'),
        import('./cart/checkout-wizard')
      ]).then(() => {
        // Components are now cached for instant loading
      }).catch(() => {
        // Ignore errors - it's just a preload optimization
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
  
  private async checkPaymentReturn(): Promise<void> {
    const hash = window.location.hash;
    const isPaymentReturn = hash.startsWith('#!/payment-return');
    const isPaymentCancelled = hash.startsWith('#!/payment-cancelled');
    
    if (isPaymentReturn) {
      console.log('Payment return detected, looking for order ID...');
      
      // Extract order ID from hash fragment (format: #!/payment-return&order_id=123)
      let orderId = null;
      if (hash.includes('&order_id=')) {
        const hashParams = new URLSearchParams(hash.split('&').slice(1).join('&'));
        orderId = hashParams.get('order_id');
        console.log('Found order ID in URL:', orderId);
      } else {
        // Fallback to stored order ID
        orderId = this.findOrderId();
        console.log('Found order ID in storage:', orderId);
      }
      
      if (orderId) {
        console.log('Loading order details via order API for:', orderId);
        try {
          // Use order API to get order details
          // @ts-ignore - TypeScript has module resolution issues but method exists at runtime
          const orderData = await this.sdk.cart.getOrder(orderId);
          console.log('Order data loaded:', orderData);
          
          // Display order confirmation
          this.showOrderSuccessMessage = true;
          this.orderDetails = orderData;
          
          // Clear stored order ID since we've successfully shown the confirmation
          sessionStorage.removeItem('shoprocket_order_id');
          this.currentOrderId = undefined;
          
          console.log('Showing order confirmation for order:', orderId);
          
        } catch (error) {
          console.error('Failed to load order via API:', error);
          
          // Fallback: try cart API (in case order is still in cart state)
          console.log('Fallback: trying cart API...');
          await this.loadCart();
          
          if (this.cart && (this.cart as any).order_status) {
            console.log('Found order in cart, showing success');
            this.showOrderSuccessMessage = true;
            this.orderDetails = this.cart;
          } else {
            // Order API failed and cart doesn't have order info
            // Show a message that order was likely successful but we can't load details
            console.log('Could not load order details, showing confirmation with limited info');
            this.showOrderSuccessMessage = true;
            this.orderDetails = { 
              id: orderId, 
              status: 'processing',
              message: 'Your order has been received. You should receive a confirmation email shortly.'
            };
            
            // Set an error message that will show alongside the success
            this.errorMessage = 'Order details are currently unavailable. Please check your email for confirmation.';
            
            // Clear stored order ID even though we couldn't load full details
            sessionStorage.removeItem('shoprocket_order_id');
            this.currentOrderId = undefined;
            
            // Clear the error after a delay
            setTimeout(() => {
              this.errorMessage = null;
            }, 10000);
          }
        }
      } else {
        console.log('No order ID found, trying cart API as fallback...');
        
        // Fallback: load cart normally
        await this.loadCart();
        
        if (this.cart && (this.cart as any).order_status) {
          console.log('Found order status in cart:', (this.cart as any).order_status);
          this.showOrderSuccessMessage = true;
          this.orderDetails = this.cart;
        } else {
          console.log('No order found anywhere, showing generic success');
          this.showOrderSuccessMessage = true;
          this.orderDetails = { id: 'unknown', status: 'completed' };
        }
      }
      
      // Open cart to show the confirmation
      this.hashRouter.openCart();
      
      // Don't clean up URL immediately - leave it for user to see
      // The hash will naturally be cleaned when user navigates or closes cart
      
    } else if (isPaymentCancelled) {
      console.log('Payment cancelled - reopening cart');
      
      // Load cart to show current state
      await this.loadCart();
      
      // Show a message that payment was cancelled
      this.errorMessage = 'Payment was cancelled. Your items are still in your cart.';
      
      // Clear the message after a delay
      setTimeout(() => {
        this.errorMessage = null;
      }, 5000);
      
      // Open cart so user can try again
      this.hashRouter.openCart();
      
      // Don't clean up URL immediately - leave it for user to see
      // The hash will naturally be cleaned when user navigates or closes cart
    }
  }
  
  private findOrderId(): string | null {
    // Try multiple sources for the order ID
    
    // 1. Check if we stored it during checkout
    if (this.currentOrderId) {
      return this.currentOrderId;
    }
    
    // 2. Check session storage
    const sessionOrderId = sessionStorage.getItem('shoprocket_order_id');
    if (sessionOrderId) {
      return sessionOrderId;
    }
    
    // 3. Check if it's in the URL (some gateways might pass it back)
    const urlParams = new URLSearchParams(window.location.search);
    const urlOrderId = urlParams.get('order_id') || urlParams.get('order');
    if (urlOrderId) {
      return urlOrderId;
    }
    
    return null;
  }
  
  private storeOrderId(orderId: string): void {
    this.currentOrderId = orderId;
    // Store in session storage as backup
    sessionStorage.setItem('shoprocket_order_id', orderId);
  }
  
  // Payment polling methods removed - now using order API approach for payment returns
  
  private async openCart(): Promise<void> {
    // Reset success state if flagged from previous session
    // BUT skip reset if we're showing a success message (likely from payment return)
    if (this.shouldResetOnNextOpen && !this.showOrderSuccessMessage) {
      this.showOrderSuccessMessage = false;
      this.orderDetails = null;
      this.shouldResetOnNextOpen = false;
      this.showOrderFailureMessage = false;
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
    this.hashRouter.closeCart();
    
    // If we're closing after showing order success, ensure cleanup
    if (this.showOrderSuccessMessage) {
      sessionStorage.removeItem('shoprocket_order_id');
      this.currentOrderId = undefined;
    }
    
    // Track cart closed
    this.track(EVENTS.CART_CLOSED, this.cart);
  }

  // Checkout Methods
  private async startCheckout(): Promise<void> {
    // Show loading state while chunks load
    this.chunkLoading = true;

    try {
      // Lazy load checkout components and data in parallel
      const [_customerForm, _addressForm, checkoutWizard] = await Promise.all([
        import('./customer-form'),
        import('./address-form'),
        import('./cart/checkout-wizard'),
        // Always try to load checkout data when starting checkout
        this.loadCheckoutData()
      ]);

      // Populate the module cache
      this.cartModules.checkoutWizard = checkoutWizard;

      this.isCheckingOut = true;
      this.checkoutStep = 'customer';

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

  private nextCheckoutStep(): void {
    const allSteps: Array<'customer' | 'shipping' | 'billing' | 'payment' | 'review'> = 
      ['customer', 'shipping', 'billing', 'payment', 'review'];
    
    // Skip billing step if using same address
    const steps = this.sameAsBilling ? 
      allSteps.filter(step => step !== 'billing') : 
      allSteps;
    
    const currentIndex = steps.indexOf(this.checkoutStep);
    if (currentIndex >= 0 && currentIndex < steps.length - 1) {
      const nextStep = steps[currentIndex + 1];
      if (nextStep) {
        const previousStep = this.checkoutStep;
        
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
      return 'Enter verification code';
    }
    
    switch (this.checkoutStep) {
      case 'customer': return 'Contact Info';
      case 'shipping': return 'Shipping Address';
      case 'billing': return 'Billing Address';
      case 'payment': return 'Payment';
      case 'review': return 'Review Order';
      default: return 'Checkout';
    }
  }

  private handleBackButton(): void {
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
    const allSteps: Array<'customer' | 'shipping' | 'billing' | 'payment' | 'review'> = 
      ['customer', 'shipping', 'billing', 'payment', 'review'];
    
    // Skip billing step if using same address
    const steps = this.sameAsBilling ? 
      allSteps.filter(step => step !== 'billing') : 
      allSteps;
    
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
    
    if (customer.first_name && customer.last_name && 
        (customer.first_name !== this.customerData.first_name || 
         customer.last_name !== this.customerData.last_name)) {
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
        
        // Show password field if customer exists and has password
        this.showPasswordField = result.exists && result.has_password;
        
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
      
      if (result.auth_sent) {
        this.loginLinkSent = true;
        // Don't auto-hide when showing OTP form - user needs time to enter code
        // The OTP form will clear loginLinkSent when verification is complete or resend is clicked
        
        // Auto-focus the first OTP input after render
        this.updateComplete.then(() => {
          const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
          firstInput?.focus();
        });
      }
    } catch (error) {
      console.error('Failed to send authentication:', error);
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
        const errorMessage = result.message || 'Invalid verification code. Please try again.';
        this.otpError = errorMessage;
        this.showError(errorMessage);
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
      let errorMessage = 'Verification failed. Please try again.';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.data?.error?.message) {
        errorMessage = error.data.error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      }
      
      this.otpError = errorMessage;
      this.showError(errorMessage);
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
      
      if (result.auth_sent) {
        // Keep loginLinkSent true to stay on OTP form
        // Just focus the first input again
        this.updateComplete.then(() => {
          const firstInput = this.shadowRoot?.querySelector('[data-otp-index="0"]') as HTMLInputElement;
          firstInput?.focus();
        });
      }
    } catch (error) {
      console.error('Failed to resend authentication:', error);
      this.otpError = 'Failed to resend code. Please try again.';
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
    if (address.line1 && address.city && address.postal_code && address.country) {
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
    if (!this.sameAsBilling && address.line1 && address.city && address.postal_code && address.country) {
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
      const schema = {
        email: ['required' as const, 'email' as const],
        first_name: this.isGuest ? ['required' as const] : [],
        last_name: this.isGuest ? ['required' as const] : []
      };
      
      this.customerErrors = validateForm(this.customerData, schema) as CustomerFormErrors;
      
      if (hasErrors(this.customerErrors)) {
        this.requestUpdate();
        return;
      }
    } else if (this.checkoutStep === 'shipping') {
      // Basic required field check - no complex validation
      const schema = {
        line1: ['required' as const],
        city: ['required' as const],
        postal_code: ['required' as const],
        country: ['required' as const]
        // State requirement will be validated server-side
      };
      
      this.shippingErrors = validateForm(this.shippingAddress, schema) as AddressFormErrors;
      
      if (hasErrors(this.shippingErrors)) {
        this.requestUpdate();
        return;
      }
    } else if (this.checkoutStep === 'billing' && !this.sameAsBilling) {
      // Basic required field check - no complex validation
      const schema = {
        line1: ['required' as const],
        city: ['required' as const],
        postal_code: ['required' as const],
        country: ['required' as const]
        // State requirement will be validated server-side
      };
      
      this.billingErrors = validateForm(this.billingAddress, schema) as AddressFormErrors;
      
      if (hasErrors(this.billingErrors)) {
        this.requestUpdate();
        return;
      }
    }

    // Clear errors and navigate to next step
    this.customerErrors = {};
    this.shippingErrors = {};
    this.billingErrors = {};
    this.nextCheckoutStep();
  }

  private async handleCheckoutComplete(): Promise<void> {
    // Server will perform full validation (stock, prices, taxes, addresses, etc.)
    // and return errors if anything is invalid
    this.checkoutLoading = true;
    
    try {
      // Cart state ensures data is already synced
      // Server validates everything: stock levels, prices, addresses, etc.
      const currentUrl = window.location?.href?.split('?')[0]?.split('#')[0] || '';
      
      // First call checkout to get the order ID
      const checkoutApiResponse = await this.sdk.cart.checkout({
        payment_method_type: 'card', // Default for now
        locale: 'en',
        // Initial return URLs without order ID - will be updated with redirect if needed
        return_url: `${currentUrl}#!/payment-return`,
        cancel_url: `${currentUrl}#!/payment-cancelled`
      } as any);
      
      // Handle wrapped API response format
      const checkoutResponse = 'data' in checkoutApiResponse ? checkoutApiResponse.data : checkoutApiResponse;
      const checkoutMeta = 'meta' in checkoutApiResponse ? checkoutApiResponse.meta : null;
      
      // Store order ID for later reference
      const orderId = checkoutResponse.id || checkoutResponse.order_id;
      if (orderId) {
        this.storeOrderId(orderId);
        console.log('Stored order ID for payment return:', orderId);
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
        if (orderId) {
          console.log('Redirecting to payment gateway with stored order ID:', orderId);
        }
        
        // Redirect to payment gateway
        window.location.href = paymentUrl;
        return; // Stop here, payment will be handled on return
        
      } else if (checkoutResponse.status === 'completed' || checkoutResponse.status === 'paid') {
        // Free order, 100% discount, or instant payment method
        // Track purchase
        this.track(EVENTS.PURCHASE, { order: checkoutResponse });
        
        // Show success in the cart body
        this.showOrderSuccessMessage = true;
        this.orderDetails = checkoutResponse;
        
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
        
      } else if (checkoutResponse.status === 'pending' && checkoutResponse.payment_method === 'offline') {
        // Offline payment method (cash on delivery, bank transfer, etc.)
        // Track as purchase but show special instructions
        this.track(EVENTS.PURCHASE, { 
          order: checkoutResponse,
          payment_type: 'offline'
        });
        
        // Show success with offline payment instructions
        this.showOrderSuccessMessage = true;
        this.orderDetails = checkoutResponse;
        // Could add a flag like this.showOfflineInstructions = true;
        
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
      }
      
    } catch (error: any) {
      console.error('Checkout failed:', error);
      
      // Track checkout error
      this.track(EVENTS.CHECKOUT_ERROR, {
        step: 'review',
        error_type: 'checkout_failed',
        error_message: error.message || 'Unknown error'
      });
      
      // Extract error message
      let errorMessage = 'Checkout failed. Please try again.';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.data?.error?.message) {
        errorMessage = error.data.error.message;
      } else if (error.error?.message) {
        errorMessage = error.error.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // Show error in cart view, not as floating notification
      this.showOrderFailureMessage = true;
      this.orderFailureReason = errorMessage;
      
      // Auto-hide after 10 seconds
      const timeout = setTimeout(() => {
        this.showOrderFailureMessage = false;
        this.orderFailureReason = '';
      }, 10000);
      this.timeouts.add(timeout);
    } finally {
      this.checkoutLoading = false;
    }
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
        >
          ${this.renderTriggerContent(totalQuantity)}
        </button>
        
        ${this.renderNotification()}
      </div>
      
      <!-- Cart Panel - SEPARATE from toggle button -->
      <div class="sr-cart-panel sr-cart-panel-${this.widgetStyle} sr-cart-panel-${this.position} ${this.isOpen ? 'open' : 'closed'}">
        <div class="sr-cart-header ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-header` : ''}">
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
            ${this.isCheckingOut ? this.getCheckoutStepTitle() : 'Cart'}
          </h2>
          <button class="sr-cart-close" @click="${() => this.closeCart()}">
            <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="sr-cart-body ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-items` : ''}">
          ${this.isCheckingOut && !this.showOrderSuccessMessage && !this.showOrderFailureMessage ? 
            this.renderCheckoutFlow() :
            this.paymentPending ? this.renderPaymentPending() :
            this.showOrderSuccessMessage ? this.renderOrderSuccess() : 
            this.showOrderFailureMessage ? this.renderOrderFailure() :
            this.renderCartItems()}
        </div>
        ${!this.showOrderSuccessMessage && !this.showOrderFailureMessage && this.cart?.items?.length ? html`
          <div class="sr-cart-footer ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-footer` : ''}">
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
      return loadingSpinner('md');
    }

    const context: CartItemsContext = {
      cart: this.cart,
      showEmptyState: this.showEmptyState,
      removingItems: this.removingItems,
      priceChangedItems: this.priceChangedItems,
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
      priceChangedItems: this.priceChangedItems,
      chunkLoading: this.chunkLoading,
      formatPrice: (amount) => this.formatPrice(amount),
      startCheckout: () => this.startCheckout()
    };

    return this.cartModules.cartFooter.renderCartFooter(context);
  }
  
  private renderOrderSuccess(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingSpinner('lg');
    }

    const orderData = this.orderDetails?.data || this.orderDetails;
    const customerEmail = orderData?.customer?.email || this.customerData.email;

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => this.handleContinueShopping(),
      handleCheckOrderStatus: () => { /* TODO: implement */ },
      handleRetryPayment: () => { /* TODO: implement */ },
      handleBackToCart: () => this.exitCheckout(),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e)
    };

    return this.cartModules.orderResult.renderOrderSuccess(this.orderDetails as OrderDetails, customerEmail, context);
  }
  
  private handleContinueShopping(): void {
    this.showOrderSuccessMessage = false;
    this.orderDetails = null;
    this.shouldResetOnNextOpen = false; // Don't double-reset
    this.closeCart();
    
    // Reload cart to get fresh state for next purchase
    this.loadCart();
  }
  
  private renderPaymentPending(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingSpinner('lg');
    }

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => this.handleContinueShopping(),
      handleCheckOrderStatus: () => { /* TODO: implement */ },
      handleRetryPayment: () => { /* TODO: implement */ },
      handleBackToCart: () => this.exitCheckout(),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e)
    };

    return this.cartModules.orderResult.renderPaymentPending(this.paymentTimeout, context);
  }
  
  private renderOrderFailure(): TemplateResult {
    if (!this.cartModules.orderResult) {
      this.ensureModule('orderResult').then(() => this.requestUpdate());
      return loadingSpinner('lg');
    }

    const context: OrderResultContext = {
      formatPrice: (amount) => this.formatPrice(amount),
      handleContinueShopping: () => this.handleContinueShopping(),
      handleCheckOrderStatus: () => { /* TODO: implement */ },
      handleRetryPayment: () => {
        this.showOrderFailureMessage = false;
        this.orderFailureReason = '';
        this.checkoutStep = 'review';
      },
      handleBackToCart: () => this.exitCheckout(),
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      handleImageError: (e) => this.handleImageError(e)
    };

    return this.cartModules.orderResult.renderOrderFailure(this.orderFailureReason, context);
  }

  private renderCheckoutFlow(): TemplateResult {
    if (!this.cartModules.checkoutWizard) {
      return html`${loadingSpinner('lg')}`;
    }

    const context: CheckoutWizardContext = {
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
      customerPassword: this.customerPassword,
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
      sdk: this.sdk,
      handleBackButton: () => this.handleBackButton(),
      handleCustomerChange: (e) => this.handleCustomerChange(e),
      handleCustomerCheck: (e) => this.handleCustomerCheck(e),
      handleGuestToggle: (e: CustomEvent) => { this.isGuest = e.detail.isGuest; },
      handleSendLoginLink: () => this.handleSendLoginLink(),
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

    return this.cartModules.checkoutWizard.renderCheckoutFlow(context);
  }

  private renderCheckoutFooter(): TemplateResult {
    if (!this.cartModules.checkoutWizard) {
      return html``;
    }

    const context: CheckoutWizardContext = {
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
      customerPassword: this.customerPassword,
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
      sdk: this.sdk,
      handleBackButton: () => this.handleBackButton(),
      handleCustomerChange: (e) => this.handleCustomerChange(e),
      handleCustomerCheck: (e) => this.handleCustomerCheck(e),
      handleGuestToggle: (e: CustomEvent) => { this.isGuest = e.detail.isGuest; },
      handleSendLoginLink: () => this.handleSendLoginLink(),
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

    return this.cartModules.checkoutWizard.renderCheckoutFooter(context);
  }

  // Track the last requested quantity for each item
  private lastRequestedQuantity: Map<string, number> = new Map();
  
  // Shared method to update cart totals
  private updateCartTotals(): void {
    if (!this.cart || !this.cart.totals) return; // Don't try to update optimistic carts

    // Update item count
    this.cart.item_count = this.cart.items?.reduce((count, item) => count + item.quantity, 0) || 0;

    const currency = this.cart.currency || this.getStoreCurrency();

    // Update each line item's subtotal (for optimistic updates)
    this.cart.items?.forEach((item: any) => {
      const price = item.price?.amount || 0;
      const qty = item.quantity || 0;
      const lineTotal = price * qty;

      item.subtotal = {
        amount: lineTotal,
        currency,
        formatted: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency
        }).format(lineTotal / 100)
      };
    });

    // Calculate new cart subtotal
    const newSubtotalAmount = this.cart.items?.reduce((sum: number, i: any) => {
      return sum + (i.subtotal?.amount || 0);
    }, 0) || 0;

    const subtotalObj: Money = {
      amount: newSubtotalAmount,
      currency,
      formatted: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(newSubtotalAmount / 100)
    };

    this.cart.totals.subtotal = subtotalObj;
    this.cart.totals.total = subtotalObj; // Simplified - doesn't account for tax/shipping
  }

  private async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    
    const item = this.cart?.items.find((i: any) => i.id === itemId);
    if (!item) return;
    
    // Store original quantity for analytics
    const originalQuantity = item.quantity;
    
    // Check if we're increasing quantity and need stock validation
    if (quantity > item.quantity) {
      // Check if item has inventory policy and stock info
      if (item.inventory_policy === 'deny' && item.inventory_count !== undefined) {
        if (quantity > item.inventory_count) {
          // Show error notification
          const message = item.inventory_count === 0 
            ? 'Out of stock' 
            : `Maximum quantity (${item.inventory_count}) already in cart`;
          
          window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_ERROR, {
            detail: { message }
          }));
          return;
        }
      }
    }
    
    // Track what quantity we're requesting
    this.lastRequestedQuantity.set(itemId, quantity);
    
    // Optimistic update - immediately update UI
    item.quantity = quantity;
    
    // Update totals
    this.updateCartTotals();
    
    // Trigger animations immediately
    this.priceChangedItems.add(itemId);
    this.priceChangedItems.add('cart-total');
    this.requestUpdate();
    
    // Remove animation after it completes
    const timeout = setTimeout(() => {
      this.priceChangedItems.delete(itemId);
      this.priceChangedItems.delete('cart-total');
      this.requestUpdate();
      this.timeouts.delete(timeout);
    }, 600);
    this.timeouts.add(timeout);
    
    // Cart state subscriptions handle updates
    
    // Track quantity change
    const eventType = quantity > originalQuantity ? EVENTS.ADD_TO_CART : EVENTS.REMOVE_FROM_CART;
    this.track(eventType, { 
      ...item, 
      quantity: Math.abs(quantity - originalQuantity) 
    });
    
    // Cancel any pending update for this item
    if (this.pendingUpdates.has(itemId)) {
      clearTimeout(this.pendingUpdates.get(itemId));
      this.pendingUpdates.delete(itemId);
    }
    
    // Debounce the API call - wait 1 second after last click
    const timeoutId = setTimeout(() => {
      // Fire and forget - don't await or handle response
      this.sdk.cart.updateItem(itemId, quantity).catch(error => {
        console.error('Failed to update quantity:', error);
        // Don't rollback UI state - keep the optimistic update
      });
      
      // Clean up
      this.pendingUpdates.delete(itemId);
      this.lastRequestedQuantity.delete(itemId);
    }, TIMEOUTS.DEBOUNCE); // Wait 300ms after last click
    
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
      
      // Check if cart is now empty
      if (this.cart.items.length === 0) {
        this.showEmptyState = true;
      }
    
      // Update totals
      this.updateCartTotals();
      
      // Trigger animation for cart total
      this.priceChangedItems.add('cart-total');
      this.removingItems.delete(itemId);
      this.requestUpdate();
      
      // Remove animation after it completes (independent of API)
      const animTimeout = setTimeout(() => {
        this.priceChangedItems.delete('cart-total');
        this.requestUpdate();
        this.timeouts.delete(animTimeout);
      }, 600);
      this.timeouts.add(animTimeout);
      
      // Fire and forget - don't await or handle response
      this.sdk.cart.removeItem(itemId).catch(error => {
        console.error('Failed to remove item:', error);
        // Don't rollback UI state - keep the optimistic update
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
    if (item.source_url) {
      // Navigate to the original page where item was added
      window.location.href = item.source_url;
    } else if (item.product_slug) {
      // Fallback to hash navigation on current page
      this.closeCart();
      // Use hash router to navigate properly
      this.hashRouter.navigateToProduct(item.product_slug);
    }
  }



  private renderTriggerContent(itemCount: number): TemplateResult {
    if (!this.cartModules.cartTrigger) {
      this.ensureModule('cartTrigger').then(() => this.requestUpdate());
      // Minimal fallback for trigger (must always render something)
      return html`<span>${itemCount}</span>`;
    }

    return this.cartModules.cartTrigger.renderTriggerContent(itemCount, this.position, shoppingBasketIcon);
  }
  
  private handleFloatingError = (event: CustomEvent): void => {
    const { message } = event.detail;
    
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
        }, TIMEOUTS.ANIMATION); // Match animation duration
      }, 4000);
    });
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
      floatingErrorMessage: this.floatingErrorMessage,
      errorNotificationSliding: this.errorNotificationSliding,
      getMediaUrl: (media, transforms) => this.getMediaUrl(media, transforms),
      formatPrice: (amount) => this.formatPrice(amount),
      handleImageError: (e) => this.handleImageError(e)
    };

    return this.cartModules.cartTrigger.renderNotification(context);
  }
}