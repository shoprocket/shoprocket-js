import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { repeat } from 'lit/directives/repeat.js';
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

  private customerCheckTimeout?: NodeJS.Timeout;
  private lastCheckedEmail?: string;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
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
    
    
    // Get HashRouter singleton instance
    this.hashRouter = HashRouter.getInstance();
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
          media: item.image || item.media?.[0],
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
        import('./address-form')
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
  
  private openCart(): void {
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
    
    // Track cart closed
    this.track(EVENTS.CART_CLOSED, this.cart);
  }

  // Checkout Methods
  private async startCheckout(): Promise<void> {
    // Show loading state while chunks load
    this.chunkLoading = true;
    
    try {
      // Lazy load checkout components and data in parallel
      await Promise.all([
        import('./customer-form'),
        import('./address-form'),
        // Always try to load checkout data when starting checkout
        this.loadCheckoutData()
      ]);
      
      this.isCheckingOut = true;
      this.checkoutStep = 'customer';
      
      // Track checkout started
      this.track(EVENTS.BEGIN_CHECKOUT, this.cart);
    } finally {
      this.chunkLoading = false;
    }
  }

  private exitCheckout(): void {
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
        this.checkoutStep = nextStep;
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
        this.checkoutStep = previousStep;
      }
    }
  }

  private handleCustomerChange(e: CustomEvent): void {
    const { customer } = e.detail;
    // Update cart state instead of local state
    cartState.updateCheckoutData(customer);
    this.customerErrors = {}; // Clear errors on change
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
    
    try {
      this.sendingLoginLink = true;
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
      const result = await this.sdk.cart.verifyAuth(this.customerData.email, this.otpCode);
      
      if (result.authenticated) {
        // Success - customer is now linked to cart
        this.loginLinkSent = false;
        this.otpCode = '';
        this.otpError = ''; // Clear any error
        this.customerCheckResult = undefined; // Clear check result
        
        // Force reload the checkout data which now contains the customer's saved details
        await this.loadCheckoutData(true);
        
        // Move to shipping step automatically since we have their data
        this.checkoutStep = 'shipping';
      } else {
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
    this.otpCode = '';
    this.otpError = '';
    this.loginLinkSent = false;
    await this.handleSendLoginLink();
  }

  private handleShippingAddressChange(e: CustomEvent): void {
    const { address } = e.detail;
    // Update cart state instead of local state
    cartState.updateShippingAddress(address);
    this.shippingErrors = {}; // Clear errors on change
  }
  

  private handleBillingAddressChange(e: CustomEvent): void {
    const { address } = e.detail;
    // Update cart state instead of local state
    cartState.updateBillingAddress(address);
    this.billingErrors = {}; // Clear errors on change
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
      const checkoutResponse = await this.sdk.cart.checkout({
        payment_method_type: 'card', // Default for now
        locale: 'en'
      });

      // Track purchase
      this.track(EVENTS.PURCHASE, { order: checkoutResponse });
      
      // Handle successful checkout
      // Handle successful checkout
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
      
      // Hide success message after 10 seconds
      const timeout = setTimeout(() => {
        this.showOrderSuccessMessage = false;
        this.orderDetails = null;
      }, 10000);
      this.timeouts.add(timeout);
      
    } catch (error: any) {
      console.error('Checkout failed:', error);
      
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
            this.showOrderSuccessMessage ? this.renderOrderSuccess() : 
            this.showOrderFailureMessage ? this.renderOrderFailure() :
            this.renderCartItems()}
        </div>
        ${!this.showOrderSuccessMessage && !this.showOrderFailureMessage ? html`
          <div class="sr-cart-footer ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-footer` : ''}">
            ${this.isCheckingOut ? this.renderCheckoutFooter() : this.renderCartFooter()}
          </div>
        ` : ''}
      </div>
    `;
  }

  private renderCartItems(): TemplateResult {
    if (!this.cart?.items?.length || this.showEmptyState) {
      return html`
        <div class="sr-cart-empty">
          <svg class="sr-cart-empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
          <p class="sr-cart-empty-text">Your cart is empty</p>
          <button 
            class="sr-cart-empty-button"
            @click="${() => this.closeCart()}"
          >
            Continue shopping
          </button>
        </div>
      `;
    }

    return html`
      ${repeat(
        this.cart.items,
        (item: any) => item.id,
        (item: any) => html`
        <div class="sr-cart-item-container ${this.removingItems.has(item.id) ? 'removing' : ''}">
          <div class="sr-cart-item">
          <!-- Product Image -->
          <div class="sr-cart-item-image"
               @click="${() => this.navigateToProduct(item)}">
            <img 
              src="${this.getMediaUrl(item.image, 'w=128,h=128,fit=cover')}" 
              alt="${item.product_name}"
              @error="${(e: Event) => this.handleImageError(e)}"
            >
          </div>
          
          <!-- Product Details -->
          <div class="sr-cart-item-content">
            <div class="sr-cart-item-header">
              <div class="sr-cart-item-info">
                <h4 class="sr-cart-item-title"
                    @click="${() => this.navigateToProduct(item)}">${item.product_name}</h4>
                ${item.variant_name ? html`
                  <div class="sr-cart-item-variant">${item.variant_name}</div>
                ` : ''}
              </div>
            </div>
            
            <div class="sr-cart-item-footer">
              <div class="sr-cart-item-price">
                <span class="sr-cart-item-subtotal ${this.priceChangedItems.has(item.id) ? 'price-changed' : ''}">
                  ${this.formatPrice(
                    item.subtotal !== undefined 
                      ? item.subtotal 
                      : (item.price?.amount || 0) * (item.quantity || 0)
                  )}
                </span>
              </div>
              
              <!-- Quantity Controls with Remove Button -->
              <div class="sr-cart-item-quantity">
                <!-- Remove Button -->
                <button 
                  class="sr-cart-item-remove"
                  @click="${() => this.removeItem(item.id)}"
                  aria-label="Remove item"
                  title="Remove item"
                >
                  <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                  </svg>
                </button>
                <div class="sr-cart-quantity">
                <button 
                  class="sr-cart-quantity-button"
                  @click="${() => this.updateQuantity(item.id, item.quantity - 1)}"
                  ?disabled="${item.quantity === 1}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span class="sr-cart-quantity-value">${item.quantity}</span>
                <sr-tooltip 
                  text="${item.inventory_policy === 'deny' && item.inventory_count !== undefined && item.quantity >= item.inventory_count ? `Maximum quantity (${item.inventory_count}) in cart` : ''}" 
                  position="top"
                >
                  <button 
                    class="sr-cart-quantity-button"
                    @click="${() => this.updateQuantity(item.id, item.quantity + 1)}"
                    ?disabled="${item.inventory_policy === 'deny' && item.inventory_count !== undefined && item.quantity >= item.inventory_count}"
                    aria-label="Increase quantity"
                  >
                    +
                  </button>
                </sr-tooltip>
              </div>
            </div>
          </div>
        </div>
      </div>
      `
      )}
    `;
  }

  private renderCartFooter(): TemplateResult {
    return html`
      <div class="sr-cart-subtotal">
        <span class="sr-cart-subtotal-label">Subtotal</span>
        <span class="sr-cart-subtotal-amount">
          <span class="sr-cart-total-price ${this.priceChangedItems.size > 0 ? 'price-changed' : ''}">${this.formatPrice(this.cart?.totals?.total)}</span>
        </span>
      </div>
      <button 
        class="sr-cart-checkout-button"
        @click="${this.startCheckout}"
        ?disabled="${!this.cart?.items?.length || this.chunkLoading}"
      >
        ${this.chunkLoading ? loadingSpinner('sm') : 'Checkout'}
      </button>
      <p class="sr-cart-powered-by">
        Taxes and shipping calculated at checkout
      </p>
    `;
  }
  
  private renderOrderSuccess(): TemplateResult {
    return html`
      <div class="sr-order-success" style="text-align: center; padding: 3rem 1rem;">
        <svg style="width: 64px; height: 64px; color: var(--color-success, #22c55e); margin: 0 auto 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.5rem;">Order Confirmed!</h2>
        <p style="color: var(--color-text-muted); margin: 0 0 1rem;">Thank you for your purchase</p>
        ${this.orderDetails?.order_number ? html`
          <p style="font-size: 0.875rem; color: var(--color-text-muted); margin: 0 0 2rem;">
            Order number: <strong>${this.orderDetails.order_number}</strong>
          </p>
        ` : ''}
        <button 
          class="sr-btn sr-btn-primary"
          @click="${() => {
            this.showOrderSuccessMessage = false;
            this.orderDetails = null;
            this.closeCart();
          }}"
          style="width: 100%; max-width: 200px;"
        >
          Continue Shopping
        </button>
      </div>
    `;
  }
  
  private renderOrderFailure(): TemplateResult {
    return html`
      <div class="sr-order-failure" style="text-align: center; padding: 3rem 1rem;">
        <svg style="width: 64px; height: 64px; color: var(--color-danger, #ef4444); margin: 0 auto 1.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <h2 style="font-size: 1.5rem; font-weight: 600; color: var(--color-text); margin: 0 0 0.5rem;">Order Failed</h2>
        <p style="color: var(--color-text-muted); margin: 0 0 1rem;">${this.orderFailureReason}</p>
        <button 
          class="sr-btn sr-btn-primary"
          @click="${() => {
            this.showOrderFailureMessage = false;
            this.orderFailureReason = '';
            // Go back to review step to try again
            this.checkoutStep = 'review';
          }}"
          style="width: 100%; max-width: 200px;"
        >
          Try Again
        </button>
      </div>
    `;
  }

  private renderCheckoutFlow(): TemplateResult {
    // Show loading spinner while chunks are loading
    if (this.chunkLoading) {
      return html`
        <div class="sr-checkout-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 300px;">
          ${loadingSpinner('lg')}
          <p style="margin-top: 1rem; color: var(--color-text-muted);">Loading checkout...</p>
        </div>
      `;
    }
    
    // Only render the current active step for better performance
    switch (this.checkoutStep) {
      case 'customer':
        return html`
          <div class="sr-checkout-step">
            ${this.renderCustomerContent()}
          </div>
        `;
      
      case 'shipping':
        return html`
          <div class="sr-checkout-step">
            ${this.renderShippingContent()}
          </div>
        `;
      
      case 'billing':
        // Skip billing if same as shipping
        if (this.sameAsBilling) {
          // This shouldn't happen, but handle gracefully
          this.checkoutStep = 'payment';
          return html`
            <div class="sr-checkout-step">
              ${this.renderPaymentContent()}
            </div>
          `;
        }
        return html`
          <div class="sr-checkout-step">
            ${this.renderBillingContent()}
          </div>
        `;
      
      case 'payment':
        return html`
          <div class="sr-checkout-step">
            ${this.renderPaymentContent()}
          </div>
        `;
      
      case 'review':
        return html`
          <div class="sr-checkout-step">
            ${this.renderReviewContent()}
          </div>
        `;
      
      default:
        // Fallback to customer step if unknown
        return html`
          <div class="sr-checkout-step">
            ${this.renderCustomerContent()}
          </div>
        `;
    }
  }

  private renderCustomerContent(): TemplateResult {
    // If OTP form is showing, only render the OTP section
    if (this.loginLinkSent) {
      return html`
        <div class="sr-checkout-step">
          <!-- OTP verification form -->
          <div class="sr-otp-section">
            <div class="sr-otp-header">
              <h4 class="sr-otp-title">Enter verification code</h4>
              <p class="sr-otp-subtitle">We sent a 6-digit code to ${this.customerData.email}</p>
            </div>
            
            <div class="sr-otp-inputs">
              ${Array.from({length: 6}, (_, i) => html`
                <input
                  type="text"
                  inputmode="numeric"
                  maxlength="1"
                  class="sr-otp-input ${this.otpError ? 'sr-field-error' : ''}"
                  .value="${this.otpCode[i] || ''}"
                  @input="${(e: Event) => this.handleOtpInput(e, i)}"
                  @keydown="${(e: KeyboardEvent) => this.handleOtpKeydown(e, i)}"
                  @paste="${(e: ClipboardEvent) => this.handleOtpPaste(e)}"
                  data-otp-index="${i}"
                />
              `)}
            </div>
            
            ${this.otpError ? html`
              <div class="sr-field-error-message">${this.otpError}</div>
            ` : ''}
            
            ${this.verifyingOtp ? html`
              <div class="sr-otp-verifying">
                <span class="sr-spinner"></span> Verifying...
              </div>
            ` : ''}
            
            <div class="sr-otp-resend">
              <p>Didn't receive code? 
                <button class="sr-btn-link" @click="${this.handleResendOtp}">
                  Resend
                </button>
              </p>
            </div>
            
            <!-- Proceed as guest option -->
            <div class="sr-otp-guest-option">
              <button class="sr-btn-link" @click="${() => { 
                this.loginLinkSent = false; 
                this.otpCode = ''; 
                this.otpError = '';
                this.customerCheckResult = undefined; 
              }}">
                Continue as guest instead
              </button>
            </div>
          </div>
        </div>
      `;
    }

    // Otherwise show the normal customer form flow
    return html`
      <shoprocket-customer-form
          .customer="${this.customerData}"
          .errors="${this.customerErrors}"
          .required="${true}"
          .show-guest-option="${true}"
          .is-guest="${this.isGuest}"
          @customer-change="${this.handleCustomerChange}"
          @customer-check="${this.handleCustomerCheck}"
          @guest-toggle="${(e: CustomEvent) => { this.isGuest = e.detail.isGuest; }}"
        ></shoprocket-customer-form>
      
      ${this.checkingCustomer && this.customerData.email ? html`
        <div class="sr-checking-customer">
          <span class="sr-spinner"></span>
          <span class="sr-checking-text">Checking email...</span>
        </div>
      ` : this.customerCheckResult && this.customerCheckResult.exists ? html`
        <div class="sr-auth-section">
          ${(() => {
            if (this.customerCheckResult.exists && !this.customerCheckResult.has_password) {
              // Customer exists but no password (guest checkout previously)
              return html`
                  <!-- Guest customer (no account) -->
                  ${!this.loginLinkSent ? html`
                    <div class="sr-returning-notice">
                      <svg class="sr-notice-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                      </svg>
                      <div class="sr-notice-text">
                        <p>Welcome back!</p>
                        <button 
                          class="sr-btn-link"
                          ?disabled="${this.sendingLoginLink}"
                          @click="${this.handleSendLoginLink}"
                        >
                          ${this.sendingLoginLink ? html`
                            <span class="sr-spinner"></span> Sending...
                          ` : 'Load my saved details'}
                        </button>
                      </div>
                    </div>
                  ` : ''}
                `;
              
            } else if (this.customerCheckResult.exists && this.customerCheckResult.has_password) {
              // Customer exists with password (registered account)
              return html`
                  <!-- Registered customer -->
                  <div class="sr-auth-notice">
                    <svg class="sr-auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                    </svg>
                    <div class="sr-auth-content">
                      <p class="sr-auth-title">Welcome back!</p>
                      <p class="sr-auth-subtitle">You have an account with this email address.</p>
                    </div>
                  </div>

                  ${this.showPasswordField ? html`
                    <!-- Password authentication -->
                    <div class="sr-field-group">
                      <input
                        type="password"
                        id="password"
                        class="sr-field-input peer ${this.customerPassword ? 'has-value' : ''}"
                        .value="${this.customerPassword}"
                        placeholder=" "
                        autocomplete="current-password"
                        @input="${(e: Event) => { this.customerPassword = (e.target as HTMLInputElement).value; }}"
                      >
                      <label class="sr-field-label" for="password">Password</label>
                    </div>
                    
                    <button 
                      class="sr-btn sr-btn-primary" 
                      ?disabled="${!this.customerPassword}"
                      @click="${() => { /* TODO: Handle password login */ }}"
                    >
                      Sign In
                    </button>
                    
                    <div class="sr-auth-divider">
                      <span>or</span>
                    </div>
                  ` : ''}

                  <!-- OTP option -->
                  <button 
                    class="sr-btn ${this.showPasswordField ? 'sr-btn-secondary' : 'sr-btn-primary'}"
                    ?disabled="${this.sendingLoginLink}"
                    @click="${this.handleSendLoginLink}"
                  >
                    ${this.sendingLoginLink ? html`
                      <span class="sr-spinner"></span> Sending...
                    ` : this.showPasswordField ? 'Use email verification instead' : html`
                      <svg class="sr-btn-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                      </svg>
                      Send Verification Code
                    `}
                  </button>

                  <!-- Guest checkout is implicit - they just continue with the main button -->
                `;
            }
            
            // Shouldn't reach here but return empty for safety
            return '';
          })()}
        </div>
      ` : ''}
    `;
  }

  private renderShippingContent(): TemplateResult {
    return html`
      <shoprocket-address-form
        title=""
        type="shipping"
        .sdk="${this.sdk}"
        .address="${this.shippingAddress}"
        .errors="${this.shippingErrors}"
        .required="${true}"
        .show-name="${false}"
        .show-phone="${false}"
        .showSameAsBilling="${true}"
        .sameAsBilling="${this.sameAsBilling}"
        @address-change="${this.handleShippingAddressChange}"
                @same-as-billing-change="${(e: CustomEvent) => {
          cartState.setSameAsBilling(e.detail.checked);
        }}"
      ></shoprocket-address-form>
    `;
  }

  private renderBillingContent(): TemplateResult {
    return html`
      <shoprocket-address-form
          title=""
          type="billing"
          .sdk="${this.sdk}"
          .address="${this.billingAddress}"
          .errors="${this.billingErrors}"
          .required="${true}"
          .show-name="${false}"
          @address-change="${this.handleBillingAddressChange}"
                  ></shoprocket-address-form>
    `;
  }

  private renderPaymentContent(): TemplateResult {
    return html`
      <div class="sr-payment-placeholder">
          <p>Payment integration coming soon...</p>
          <p>For now, this will proceed with a test order.</p>
        </div>
    `;
  }

  private renderReviewContent(): TemplateResult {
    return html`
        <!-- Order Summary -->
        <div class="sr-order-summary">
          <h4>Order Summary</h4>
          <div class="sr-order-items">
            ${this.cart?.items?.map(item => html`
              <div class="sr-order-item">
                <span class="sr-order-item-name">${item.product_name}</span>
                <span class="sr-order-item-quantity">×${item.quantity}</span>
                <span class="sr-order-item-price">${this.formatPrice(item.price)}</span>
              </div>
            `)}
          </div>
          
          <div class="sr-order-totals">
            <div class="sr-order-total-line">
              <span>Subtotal</span>
              <span>${this.formatPrice(this.cart?.totals?.subtotal)}</span>
            </div>
            ${this.cart?.totals?.tax ? html`
              <div class="sr-order-total-line">
                <span>Tax</span>
                <span>${this.formatPrice(this.cart.totals.tax)}</span>
              </div>
            ` : ''}
            ${this.cart?.totals?.shipping ? html`
              <div class="sr-order-total-line">
                <span>Shipping</span>
                <span>${this.formatPrice(this.cart.totals.shipping)}</span>
              </div>
            ` : ''}
            <div class="sr-order-total-line sr-order-total-final">
              <span>Total</span>
              <span>${this.formatPrice(this.cart?.totals?.total)}</span>
            </div>
          </div>
        </div>

        <!-- Customer & Address Summary -->
        <div class="sr-checkout-summary">
          <div class="sr-summary-section">
            <h5>Contact</h5>
            <p>${this.customerData.email}</p>
          </div>
          
          <div class="sr-summary-section">
            <h5>Shipping Address</h5>
            <div class="sr-summary-address">
              ${this.shippingAddress.name ? html`<p>${this.shippingAddress.name}</p>` : ''}
              <p>${this.shippingAddress.line1}</p>
              ${this.shippingAddress.line2 ? html`<p>${this.shippingAddress.line2}</p>` : ''}
              <p>${this.shippingAddress.city}, ${this.shippingAddress.state} ${this.shippingAddress.postal_code}</p>
              <p>${this.shippingAddress.country}</p>
            </div>
          </div>
          
          <div class="sr-summary-section">
            <h5>Billing Address</h5>
            ${this.sameAsBilling ? html`
              <p>Same as shipping address</p>
            ` : html`
              <div class="sr-summary-address">
                ${this.billingAddress.name ? html`<p>${this.billingAddress.name}</p>` : ''}
                <p>${this.billingAddress.line1}</p>
                ${this.billingAddress.line2 ? html`<p>${this.billingAddress.line2}</p>` : ''}
                <p>${this.billingAddress.city}, ${this.billingAddress.state} ${this.billingAddress.postal_code}</p>
                <p>${this.billingAddress.country}</p>
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  private renderCheckoutFooter(): TemplateResult {
    const canProceed = true; // Let HTML5 validation handle this

    // Show cart summary during checkout
    const subtotal = this.cart?.totals?.subtotal || { amount: 0, currency: 'USD', formatted: '$0.00' };
    
    return html`
      <div class="sr-cart-subtotal">
        <span class="sr-cart-subtotal-label">Subtotal</span>
        <span class="sr-cart-subtotal-amount">
          <span class="sr-cart-total-price">${this.formatPrice(subtotal)}</span>
        </span>
      </div>
      
      ${this.checkoutStep === 'review' ? html`
        <button 
          class="sr-cart-checkout-button"
          @click="${this.handleCheckoutComplete}"
          ?disabled="${this.checkoutLoading || !canProceed}"
        >
          ${this.checkoutLoading ? loadingSpinner('sm') : 'Complete Order'}
        </button>
      ` : html`
        <button 
          class="sr-cart-checkout-button sr-checkout-next-button"
          @click="${this.handleStepNext}"
          ?disabled="${this.checkoutLoading || this.chunkLoading || !canProceed}"
        >
          ${this.checkoutLoading || this.chunkLoading ? loadingSpinner('sm') : 'Continue'}
        </button>
      `}
      
      <p class="sr-cart-powered-by">
        ${this.checkoutStep === 'review' ? 
          'By completing your order, you agree to our terms' : 
          'Secure checkout powered by Shoprocket'}
      </p>
    `;
  }

  // Track the last requested quantity for each item
  private lastRequestedQuantity: Map<string, number> = new Map();
  
  // Shared method to update cart totals
  private updateCartTotals(): void {
    if (!this.cart || !this.cart.totals) return; // Don't try to update optimistic carts
    
    // Update item count
    this.cart.item_count = this.cart.items?.reduce((count, item) => count + item.quantity, 0) || 0;
    
    // Calculate new subtotal
    const newSubtotalAmount = this.cart.items?.reduce((sum: number, i: any) => {
      const price = i.price?.amount || 0;
      const qty = i.quantity || 0;
      return sum + (price * qty);
    }, 0) || 0;
    
    const currency = this.cart.currency || this.getStoreCurrency();
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
    const isMiddle = this.position.includes('middle');
    
    if (isMiddle) {
      return html`
        <div class="sr-cart-empty-container">
          ${itemCount > 0 ? html`
            <span class="sr-cart-badge-count">${itemCount}</span>
          ` : ''}
          <span class="sr-cart-icon" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
        </div>
      `;
    }
    
    // Bottom positions - standard layout
    return html`
      <span class="sr-cart-icon" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
      ${itemCount > 0 ? html`
        <span class="sr-cart-badge">
          ${itemCount > 99 ? '99+' : itemCount}
        </span>
      ` : ''}
    `;
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
    // Error takes priority over success
    if (this.floatingErrorMessage) {
      // Use middle position for vertical centering with cart toggle
      const verticalPosition = this.position.includes('top') ? 'top' : 'middle';
      const horizontalPosition = this.position.includes('left') ? 'left' : 'right';
      const notificationClasses = `sr-notification-${verticalPosition}-${horizontalPosition}`;
      
      let animationClass = '';
      if (this.errorNotificationSliding === 'in') {
        animationClass = 'sr-notification-slide-in';
      } else if (this.errorNotificationSliding === 'out') {
        animationClass = 'sr-notification-slide-out';
      }
      
      return html`
        <div class="sr-add-notification sr-notification-error ${notificationClasses} ${animationClass}">
          <!-- Triangle arrow -->
          ${this.renderNotificationArrow()}
          <div class="sr-add-notification-content">
            <svg class="sr-notification-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div class="sr-add-notification-details">
              <p class="sr-add-notification-title">${this.floatingErrorMessage}</p>
            </div>
          </div>
        </div>
      `;
    }
    
    if (this.recentlyAddedProduct) {
      const product = this.recentlyAddedProduct;
      // Use same position as cart toggle
      const notificationClasses = `sr-notification-${this.position}`;
      
      let animationClass = '';
      if (this.notificationSliding === 'in') {
        animationClass = 'sr-notification-slide-in';
      } else if (this.notificationSliding === 'out') {
        animationClass = 'sr-notification-slide-out';
      }
      
      return html`
        <div class="sr-add-notification ${notificationClasses} ${animationClass}">
          <!-- Triangle arrow -->
          ${this.renderNotificationArrow()}
          <div class="sr-add-notification-content">
            ${product.media ? html`
              <div class="sr-add-notification-image">
                <img 
                  src="${this.getMediaUrl(product.media, 'w=40,h=40,fit=cover')}" 
                  alt="${product.name}"
                  class="sr-add-notification-img"
                  @error="${(e: Event) => this.handleImageError(e)}"
                >
              </div>
            ` : ''}
            <div class="sr-add-notification-details">
              <p class="sr-add-notification-title">${product.name}</p>
              <div class="sr-add-notification-info">
                <span class="sr-add-notification-price">${this.formatPrice(product.price)}</span>
                ${product.variantText ? html`
                  <span class="sr-add-notification-variant">• ${product.variantText}</span>
                ` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    return html``;
  }
  

  private renderNotificationArrow(): TemplateResult {
    const isLeft = this.position.includes('left');
    const arrowClasses = `sr-notification-arrow sr-notification-arrow-${isLeft ? 'left' : 'right'}`;
    
    return html`
      <div class="${arrowClasses}">
        <div class="sr-arrow-inner">
        </div>
      </div>
    `;
  }
}