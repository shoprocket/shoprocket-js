import { html, type TemplateResult } from 'lit';
import { property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { repeat } from 'lit/directives/repeat.js';
import { ShoprocketElement, EVENTS } from '../core/base-component';
import type { Cart, ApiResponse, Money } from '../types/api';
import { HashRouter, type HashState } from '../core/hash-router';
import { TIMEOUTS, WIDGET_EVENTS } from '../constants';
import './tooltip';
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
  
  // Timeout tracking for cleanup
  private timeouts = new Set<NodeJS.Timeout>();
  
  // Track pending API calls for debouncing
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  
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

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Remove cart update listener - we are the source of these events!
    
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
    
    // Update internal state with cart methods and data
    const { internalState } = await import('../core/internal-state');
    const self = this;
    internalState.setCart({
      toggle: this.toggleCart.bind(this),
      open: this.openCart.bind(this),
      close: this.closeCart.bind(this),
      get data(): Cart | null { return self.cart; }
    });
    
    // Store data should already be cached by widget manager
    // If not available yet, wait a bit or skip (formatters will use defaults)
    
    // Load cart data
    await this.loadCart();
    
    // Set initial cart state from hash
    const initialState = this.hashRouter.getCurrentState();
    this.isOpen = initialState.cartOpen;
    
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
    if (this.customerUpdateTimeout) {
      clearTimeout(this.customerUpdateTimeout);
    }
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
    
    // Clean up internal state cart reference
    // Note: We don't clear it entirely as other components may still exist
  }

  
  private handleAddItem = (event: CustomEvent): void => {
    const { item, stockInfo } = event.detail;
    
    // Validate stock if tracking inventory (track_inventory or inventory_policy === 'deny')
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
      
      // Check existing quantity in cart
      const existingItem = this.cart?.items.find((cartItem: any) => 
        cartItem.product_id === item.product_id && 
        cartItem.variant_id === item.variant_id
      );
      
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
        return; // STOP HERE - DO NOT ADD TO CART
      }
    }
    
    // Initialize cart if needed
    if (!this.cart) {
      const currency = this.getStoreCurrency();
      const zeroPriceObj: Money = {
        amount: 0,
        currency,
        formatted: new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency
        }).format(0)
      };
      this.cart = {
        id: 'temp-' + Date.now(),
        items: [],
        totals: {
          subtotal: zeroPriceObj,
          tax: zeroPriceObj,
          shipping: zeroPriceObj,
          total: zeroPriceObj
        },
        currency
      };
    }
    
    // Check if item already exists in cart
    const existingItem = this.cart.items.find((cartItem: any) => 
      cartItem.product_id === item.product_id && 
      cartItem.variant_id === item.variant_id
    );
    
    if (existingItem) {
      // Update quantity
      existingItem.quantity += item.quantity;
      // Update stock info if provided
      if (stockInfo) {
        existingItem.inventory_policy = stockInfo.inventory_policy || (stockInfo.track_inventory ? 'deny' : 'continue');
        existingItem.inventory_count = stockInfo.inventory_count ?? stockInfo.available_quantity;
      }
    } else {
      // Calculate subtotal for new item (price is always a Money object)
      const subtotal = item.price.amount * item.quantity;
      
      // Add new item with a temporary ID, subtotal, and stock info
      const newItem = {
        ...item,
        id: 'temp-' + Date.now() + '-' + Math.random(),
        subtotal: subtotal,
        // Include stock info if provided
        ...(stockInfo && {
          inventory_policy: stockInfo.inventory_policy || (stockInfo.track_inventory ? 'deny' : 'continue'),
          inventory_count: stockInfo.inventory_count ?? stockInfo.available_quantity
        })
      };
      this.cart.items.push(newItem);
    }
    
    // Update totals (safely handle price)
    const newSubtotalAmount = this.cart.items.reduce((sum: number, cartItem: any) => {
      const price = cartItem.price?.amount || 0;
      const qty = cartItem.quantity || 0;
      return sum + (price * qty);
    }, 0);
    
    const currency = this.cart.currency || this.getStoreCurrency();
    this.cart.totals.subtotal = {
      amount: newSubtotalAmount,
      currency,
      formatted: new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency
      }).format(newSubtotalAmount / 100)
    };
    this.cart.totals.total = this.cart.totals.subtotal; // Simplified - doesn't account for tax/shipping
    
    // Reset empty state
    this.showEmptyState = false;
    
    // Trigger update
    this.requestUpdate();
    
    // Dispatch cart updated event
    this.dispatchCartUpdatedEvent();
    
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
        this.cart = response;
        this.requestUpdate();
        this.dispatchCartUpdatedEvent();
      }
    }).catch(error => {
      console.error('Failed to add to cart:', error);
      // Don't rollback - keep optimistic update
    });
  }
  
  private dispatchCartUpdatedEvent(): void {
    if (!this.cart) return;
    
    // Create a simplified cart state for other components
    const cartState = {
      items: this.cart.items.map((item: any) => ({
        product_id: item.product_id,
        variant_id: item.variant_id,
        quantity: item.quantity
      })),
      total_items: this.cart.items.reduce((sum: number, item: any) => sum + item.quantity, 0)
    };
    
    window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_UPDATED, {
      detail: { cart: cartState }
    }));
  }
  
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
          this.cart = 'data' in response ? (response as ApiResponse<Cart>).data : (response as Cart);
          
          // Populate customer data from cart if available
          this.populateCustomerDataFromCart();
          
          // Reset empty state if cart has items
          if (this.cart?.items?.length > 0) {
            this.showEmptyState = false;
          }
          
          // Dispatch cart data globally
          window.dispatchEvent(new CustomEvent(WIDGET_EVENTS.CART_LOADED, {
            detail: { cart: this.cart }
          }));
          
          // Also dispatch simplified cart state
          this.dispatchCartUpdatedEvent();
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

  private populateCustomerDataFromCart(): void {
    if (!this.cart) return;

    // Extract customer data from cart response
    const cartCustomer = (this.cart as any).customer;
    if (cartCustomer) {
      this.customerData = {
        email: cartCustomer.email || '',
        first_name: cartCustomer.first_name || '',
        last_name: cartCustomer.last_name || '',
        phone: cartCustomer.phone || '',
        company: cartCustomer.company || ''
      };

      // Extract shipping address from customer object
      const shippingAddress = cartCustomer.shipping_address;
      if (shippingAddress) {
        this.shippingAddress = {
          line1: shippingAddress.line1 || '',
          line2: shippingAddress.line2 || '',
          city: shippingAddress.city || '',
          state: shippingAddress.state || '',
          postal_code: shippingAddress.postal_code || '',
          country: shippingAddress.country || '',
          name: shippingAddress.name || '',
          company: shippingAddress.company || '',
          phone: shippingAddress.phone || ''
        };
      } else if ((this.cart as any).visitor_country) {
        // If no shipping address saved, use visitor's detected country
        this.shippingAddress = {
          country: (this.cart as any).visitor_country
        };
      }

      // Extract billing address from customer object
      const billingAddress = cartCustomer.billing_address;
      if (billingAddress) {
        this.billingAddress = {
          line1: billingAddress.line1 || '',
          line2: billingAddress.line2 || '',
          city: billingAddress.city || '',
          state: billingAddress.state || '',
          postal_code: billingAddress.postal_code || '',
          country: billingAddress.country || '',
          name: billingAddress.name || '',
          company: billingAddress.company || '',
          phone: billingAddress.phone || ''
        };
      } else if (shippingAddress && this.sameAsBilling) {
        // If no separate billing address and same_as_billing is true, use shipping
        this.billingAddress = { ...this.shippingAddress };
      } else if ((this.cart as any).visitor_country) {
        // If no billing address saved, use visitor's detected country
        this.billingAddress = {
          country: (this.cart as any).visitor_country
        };
      }
    } else if ((this.cart as any).visitor_country) {
      // If no customer data at all, still set visitor's detected country for addresses
      this.shippingAddress = { country: (this.cart as any).visitor_country };
      this.billingAddress = { country: (this.cart as any).visitor_country };
    }

    // Check if billing address is same as shipping (might be at cart level)
    const sameAsBilling = (this.cart as any).same_as_billing;
    if (typeof sameAsBilling === 'boolean') {
      this.sameAsBilling = sameAsBilling;
    }

    // Determine if user is guest or registered
    const isGuest = (this.cart as any).is_guest;
    if (typeof isGuest === 'boolean') {
      this.isGuest = isGuest;
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
    // Lazy load checkout components only when needed
    await Promise.all([
      import('./customer-form'),
      import('./address-form')
    ]);
    
    this.isCheckingOut = true;
    this.checkoutStep = 'customer';
    
    // Track checkout started
    this.track(EVENTS.BEGIN_CHECKOUT, this.cart);
  }

  private exitCheckout(): void {
    this.isCheckingOut = false;
    this.checkoutStep = 'customer';
    this.customerErrors = {};
    this.shippingErrors = {};
    this.billingErrors = {};
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
    this.customerData = customer;
    this.customerErrors = {}; // Clear errors on change
    
    // Update cart with customer info when it changes
    this.updateCartWithAddress();
  }

  private handleShippingAddressChange(e: CustomEvent): void {
    const { address } = e.detail;
    this.shippingAddress = address;
    this.shippingErrors = {}; // Clear errors on change
    
    // Update cart totals when address changes (for tax calculation)
    this.updateCartWithAddress();
  }

  private handleBillingAddressChange(e: CustomEvent): void {
    const { address } = e.detail;
    this.billingAddress = address;
    this.billingErrors = {}; // Clear errors on change
    
    // Update cart with billing address when it changes
    this.updateCartWithAddress();
  }

  private handleSameAsBillingChange(e: Event): void {
    const checkbox = e.target as HTMLInputElement;
    this.sameAsBilling = checkbox.checked;
    
    if (this.sameAsBilling) {
      this.shippingAddress = { ...this.billingAddress };
      this.updateCartWithAddress();
    }
  }

  // Debounce customer updates to avoid excessive API calls
  private customerUpdateTimeout?: NodeJS.Timeout;

  private async updateCartWithAddress(): Promise<void> {
    if (!this.sdk || !this.customerData.email) {
      return;
    }

    // Clear any existing timeout
    if (this.customerUpdateTimeout) {
      clearTimeout(this.customerUpdateTimeout);
    }

    // Debounce the API call by 500ms
    this.customerUpdateTimeout = setTimeout(async () => {
      try {
        // Build customer payload with all available data (API now accepts partial)
        const customerPayload: any = {
          email: this.customerData.email,
          first_name: this.customerData.first_name,
          last_name: this.customerData.last_name,
          phone: this.customerData.phone,
          company: this.customerData.company,
          same_as_billing: this.sameAsBilling
        };

        // Always include shipping address (even if partial)
        if (Object.keys(this.shippingAddress).length > 0) {
          customerPayload.shipping_address = this.shippingAddress;
        }

        // Include billing address based on same_as_billing setting
        if (this.sameAsBilling) {
          customerPayload.billing_address = this.shippingAddress;
        } else if (Object.keys(this.billingAddress).length > 0) {
          customerPayload.billing_address = this.billingAddress;
        }

        const updatedCart = await this.sdk.cart.updateCustomer(customerPayload);
        this.cart = updatedCart;
        this.dispatchCartUpdatedEvent();
      } catch (error) {
        console.error('Failed to update cart with address:', error);
      }
    }, 500); // 500ms debounce
  }

  private validateStep(step: string): boolean {
    switch (step) {
      case 'customer':
        this.customerErrors = {};
        if (!this.customerData.email) {
          this.customerErrors.email = 'Email is required';
        }
        if (this.isGuest && !this.customerData.first_name) {
          this.customerErrors.first_name = 'First name is required';
        }
        if (this.isGuest && !this.customerData.last_name) {
          this.customerErrors.last_name = 'Last name is required';
        }
        return Object.keys(this.customerErrors).length === 0;

      case 'shipping':
        this.shippingErrors = {};
        if (!this.shippingAddress.line1) {
          this.shippingErrors.line1 = 'Address is required';
        }
        if (!this.shippingAddress.city) {
          this.shippingErrors.city = 'City is required';
        }
        if (!this.shippingAddress.postal_code) {
          this.shippingErrors.postal_code = 'Postal code is required';
        }
        if (!this.shippingAddress.country) {
          this.shippingErrors.country = 'Country is required';
        }
        return Object.keys(this.shippingErrors).length === 0;

      case 'billing':
        if (this.sameAsBilling) return true;
        
        this.billingErrors = {};
        if (!this.billingAddress.line1) {
          this.billingErrors.line1 = 'Address is required';
        }
        if (!this.billingAddress.city) {
          this.billingErrors.city = 'City is required';
        }
        if (!this.billingAddress.postal_code) {
          this.billingErrors.postal_code = 'Postal code is required';
        }
        if (!this.billingAddress.country) {
          this.billingErrors.country = 'Country is required';
        }
        return Object.keys(this.billingErrors).length === 0;

      default:
        return true;
    }
  }

  private async handleStepNext(): Promise<void> {
    if (!this.validateStep(this.checkoutStep)) {
      return; // Validation failed, don't proceed
    }

    // Save current step data to backend
    await this.updateCartWithAddress();
    
    this.nextCheckoutStep();
  }

  private async handleCheckoutComplete(): Promise<void> {
    if (!this.validateStep(this.checkoutStep)) {
      return;
    }

    this.checkoutLoading = true;
    
    try {
      // Final update to cart with complete customer data
      await this.updateCartWithAddress();
      
      const checkoutResponse = await this.sdk.cart.checkout({
        payment_method_type: 'card', // Default for now
        locale: 'en'
      });

      // Track purchase
      this.track(EVENTS.PURCHASE, { order: checkoutResponse });
      
      // Handle successful checkout
      
      // Reset checkout state
      this.exitCheckout();
      
    } catch (error) {
      console.error('Checkout failed:', error);
      // TODO: Show error message to user
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
          <h2 class="sr-cart-title">Cart</h2>
          <button class="sr-cart-close" @click="${() => this.closeCart()}">
            <svg class="sr-button-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="sr-cart-body ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-items` : ''}">
          ${this.isCheckingOut ? this.renderCheckoutFlow() : this.renderCartItems()}
        </div>
        <div class="sr-cart-footer ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-footer` : ''}">
          ${this.isCheckingOut ? this.renderCheckoutFooter() : this.renderCartFooter()}
        </div>
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
                <span class="sr-cart-item-subtotal ${this.priceChangedItems.has(item.id) ? 'price-changed' : ''}">${this.formatPrice(item.subtotal)}</span>
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
        ?disabled="${!this.cart?.items?.length}"
      >
        Checkout
      </button>
      <p class="sr-cart-powered-by">
        Taxes and shipping calculated at checkout
      </p>
    `;
  }

  private renderCheckoutFlow(): TemplateResult {
    switch (this.checkoutStep) {
      case 'customer':
        return this.renderCustomerStep();
      case 'shipping':
        return this.renderShippingStep();
      case 'billing':
        return this.renderBillingStep();
      case 'payment':
        return this.renderPaymentStep();
      case 'review':
        return this.renderReviewStep();
      default:
        return this.renderCustomerStep();
    }
  }

  private renderCustomerStep(): TemplateResult {
    return html`
      <div class="sr-checkout-step">
        <div class="sr-checkout-step-header">
          <h3 class="sr-checkout-step-title">Contact Information</h3>
          <div class="sr-checkout-progress">Step 1 of 5</div>
        </div>
        
        <shoprocket-customer-form
          .customer="${this.customerData}"
          .errors="${this.customerErrors}"
          .required="${true}"
          .show-guest-option="${true}"
          .is-guest="${this.isGuest}"
          @customer-change="${this.handleCustomerChange}"
          @guest-toggle="${(e: CustomEvent) => { this.isGuest = e.detail.isGuest; }}"
        ></shoprocket-customer-form>
      </div>
    `;
  }

  private renderShippingStep(): TemplateResult {
    return html`
      <div class="sr-checkout-step">
        <div class="sr-checkout-step-header">
          <h3 class="sr-checkout-step-title">Shipping Address</h3>
          <div class="sr-checkout-progress">Step 2 of 5</div>
        </div>
        
        <shoprocket-address-form
          title=""
          .sdk="${this.sdk}"
          .address="${this.shippingAddress}"
          .errors="${this.shippingErrors}"
          .required="${true}"
          .show-name="${true}"
          .show-phone="${true}"
          @address-change="${this.handleShippingAddressChange}"
        ></shoprocket-address-form>

        <div class="sr-same-as-shipping">
          <label class="sr-checkbox-label">
            <input
              type="checkbox"
              .checked="${this.sameAsBilling}"
              @change="${this.handleSameAsBillingChange}"
            >
            <span class="sr-checkbox-text">Use same address for billing</span>
          </label>
        </div>
      </div>
    `;
  }

  private renderBillingStep(): TemplateResult {
    return html`
      <div class="sr-checkout-step">
        <div class="sr-checkout-step-header">
          <h3 class="sr-checkout-step-title">Billing Address</h3>
          <div class="sr-checkout-progress">Step 3 of 5</div>
        </div>
        
        <shoprocket-address-form
          title=""
          .sdk="${this.sdk}"
          .address="${this.billingAddress}"
          .errors="${this.billingErrors}"
          .required="${true}"
          .show-name="${true}"
          @address-change="${this.handleBillingAddressChange}"
        ></shoprocket-address-form>
      </div>
    `;
  }

  private renderPaymentStep(): TemplateResult {
    return html`
      <div class="sr-checkout-step">
        <div class="sr-checkout-step-header">
          <h3 class="sr-checkout-step-title">Payment Method</h3>
          <div class="sr-checkout-progress">Step 4 of 5</div>
        </div>
        
        <div class="sr-payment-placeholder">
          <p>Payment integration coming soon...</p>
          <p>For now, this will proceed with a test order.</p>
        </div>
      </div>
    `;
  }

  private renderReviewStep(): TemplateResult {
    return html`
      <div class="sr-checkout-step">
        <div class="sr-checkout-step-header">
          <h3 class="sr-checkout-step-title">Review Order</h3>
          <div class="sr-checkout-progress">Step 5 of 5</div>
        </div>
        
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
    const canProceed = this.checkoutStep === 'customer' ? 
      this.customerData.email && (!this.isGuest || (this.customerData.first_name && this.customerData.last_name)) :
      true;

    return html`
      <div class="sr-checkout-navigation">
        ${this.checkoutStep !== 'customer' ? html`
          <button 
            class="sr-checkout-button sr-checkout-button-secondary"
            @click="${this.previousCheckoutStep}"
            ?disabled="${this.checkoutLoading}"
          >
            Back
          </button>
        ` : html`
          <button 
            class="sr-checkout-button sr-checkout-button-secondary"
            @click="${this.exitCheckout}"
            ?disabled="${this.checkoutLoading}"
          >
            Back to Cart
          </button>
        `}
        
        ${this.checkoutStep === 'review' ? html`
          <button 
            class="sr-checkout-button sr-checkout-button-primary"
            @click="${this.handleCheckoutComplete}"
            ?disabled="${this.checkoutLoading || !canProceed}"
          >
            ${this.checkoutLoading ? 'Processing...' : 'Complete Order'}
          </button>
        ` : html`
          <button 
            class="sr-checkout-button sr-checkout-button-primary"
            @click="${this.handleStepNext}"
            ?disabled="${this.checkoutLoading || !canProceed}"
          >
            Continue
          </button>
        `}
      </div>
    `;
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
    
    // Update line item subtotal (ensure price.amount exists)
    if (item.price?.amount !== undefined) {
      (item as any).subtotal = item.price.amount * quantity;
    }
    
    // Update cart total (price is Money object with amount property)
    if (this.cart) {
      const newSubtotalAmount = this.cart.items.reduce((sum: number, i: any) => {
        const price = i.price?.amount || 0;
        const qty = i.quantity || 0;
        return sum + (price * qty);
      }, 0);
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
    
    // Dispatch cart updated event
    this.dispatchCartUpdatedEvent();
    
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
    
      // Update cart totals
      const newSubtotalAmount = this.cart.items.reduce((sum: number, i: any) => {
        const price = i.price?.amount || 0;
        const qty = i.quantity || 0;
        return sum + (price * qty);
      }, 0);
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
      
      // Dispatch cart updated event
      this.dispatchCartUpdatedEvent();
      
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