import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { repeat } from 'lit/directives/repeat.js';
import { ShoprocketElement } from '../core/base-component';
import type { Cart, ApiResponse } from '../types/api';
import { renderErrorNotification } from './error-notification';
import { HashRouter, type HashState } from '../core/hash-router';

// Import SVG as string - Vite will inline it at build time
import shoppingBasketIcon from '../assets/icons/shopping-basket.svg?raw';

/**
 * Cart Widget Component
 */
@customElement('shoprocket-cart')
export class CartWidget extends ShoprocketElement {
  @property({ type: String })
  position = 'bottom-right';

  @property({ type: String, attribute: 'data-style' })
  widgetStyle = 'bubble';

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
  
  // Track pending API calls for debouncing
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  
  @state()
  private priceChangedItems: Set<string> = new Set();
  
  @state()
  private removingItems: Set<string> = new Set();
  
  @state()
  private showEmptyState = false;
  

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Listen for cart updates
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    
    // Listen for add item events (optimistic updates)
    this.handleAddItem = this.handleAddItem.bind(this);
    window.addEventListener('shoprocket:cart:add-item', this.handleAddItem as EventListener);
    
    // Listen for product added events
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    
    
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
    
    // Register global cart toggle function
    if (!(window as any).ShoprocketWidget) {
      (window as any).ShoprocketWidget = {};
    }
    const self = this;
    (window as any).ShoprocketWidget.cart = {
      toggle: this.toggleCart.bind(this),
      open: this.openCart.bind(this),
      close: this.closeCart.bind(this),
      get data(): Cart | null { return self.cart; }
    };
    
    // Load cart data
    await this.loadCart();
    
    // Set initial cart state from hash
    const initialState = this.hashRouter.getCurrentState();
    this.isOpen = initialState.cartOpen;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    window.removeEventListener('shoprocket:cart:add-item', this.handleAddItem as EventListener);
    window.removeEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    this.hashRouter.removeEventListener('state-change', this.handleHashStateChange);
    window.removeEventListener('open-cart', this.handleOpenCart as EventListener);
    window.removeEventListener('close-cart', this.handleCloseCart as EventListener);
    window.removeEventListener('toggle-cart', this.handleToggleCart as EventListener);
    
    // Clean up global references
    if ((window as any).ShoprocketWidget?.cart) {
      delete (window as any).ShoprocketWidget.cart;
    }
  }

  private handleCartUpdate = async (): Promise<void> => {
    await this.loadCart();
  }
  
  private handleAddItem = (event: CustomEvent): void => {
    const { item } = event.detail;
    
    // Initialize cart if needed
    if (!this.cart) {
      this.cart = {
        id: 'temp-' + Date.now(),
        items: [],
        totals: {
          subtotal: 0,
          tax: 0,
          shipping: 0,
          total: 0
        },
        currency: 'USD'
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
    } else {
      // Calculate subtotal for new item
      const price = typeof item.price === 'object' ? item.price.amount : item.price;
      const subtotal = price * item.quantity;
      
      // Add new item with a temporary ID and subtotal
      const newItem = {
        ...item,
        id: 'temp-' + Date.now() + '-' + Math.random(),
        subtotal: subtotal
      };
      this.cart.items.push(newItem);
    }
    
    // Update totals
    const newSubtotal = this.cart.items.reduce((sum: number, cartItem: any) => {
      const price = typeof cartItem.price === 'object' ? cartItem.price.amount : cartItem.price;
      return sum + (price * cartItem.quantity);
    }, 0);
    
    this.cart.totals.subtotal = newSubtotal;
    this.cart.totals.total = newSubtotal; // Simplified - doesn't account for tax/shipping
    
    // Reset empty state
    this.showEmptyState = false;
    
    // Trigger update
    this.requestUpdate();
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

  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    
    // Clear existing timeouts
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
        }, 300); // Match animation duration
      }, 3000);
    });
  }
  
  private handleHashStateChange = (event: Event): void => {
    // HashRouter tells us when cart state changes
    const customEvent = event as CustomEvent<HashState>;
    this.isOpen = customEvent.detail.cartOpen;
  }


  private async loadCart(): Promise<void> {
    await this.withLoading('cart', async () => {
      try {
        const response = await this.sdk.cart.get();
        // Handle both wrapped and unwrapped responses
        if (response && typeof response === 'object') {
          this.cart = 'data' in response ? (response as ApiResponse<Cart>).data : (response as Cart);
          // Reset empty state if cart has items
          if (this.cart?.items?.length > 0) {
            this.showEmptyState = false;
          }
          
          // Dispatch cart data globally
          window.dispatchEvent(new CustomEvent('shoprocket:cart:loaded', {
            detail: { cart: this.cart }
          }));
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
  
  
  private toggleCart = (): void => {
    if (this.isOpen) {
      this.closeCart();
    } else {
      this.openCart();
    }
  }
  
  private openCart(): void {
    this.hashRouter.openCart();
  }
  
  private closeCart(): void {
    this.hashRouter.closeCart();
  }

  protected override render(): TemplateResult {
    // Calculate total quantity across all items
    const totalQuantity = this.cart?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

    return html`
      ${renderErrorNotification(this.errorMessage)}
      <!-- Generic Overlay -->
      <div 
        class="sr-cart-overlay ${this.isOpen ? 'open' : 'closed'}"
        @click="${() => this.isOpen && this.closeCart()}"
      ></div>
      
      <!-- Cart Toggle Button -->
      <div class="sr-cart-toggle-container sr-cart-toggle-${this.position}" data-shoprocket="cart-toggle">
        <button 
          class="sr-cart-toggle-button ${this.isOpen ? 'hidden' : ''}"
          @click="${this.toggleCart}"
        >
          ${this.renderTriggerContent(totalQuantity)}
        </button>
        
        ${this.renderProductNotification()}
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
          ${this.renderCartItems()}
        </div>
        <div class="sr-cart-footer ${this.widgetStyle === 'bubble' ? `sr-cart-animation-${this.isOpen ? 'in' : 'out'}-footer` : ''}">
          <div class="sr-cart-subtotal">
            <span class="sr-cart-subtotal-label">Subtotal</span>
            <span class="sr-cart-subtotal-amount">
              <span class="sr-cart-total-price ${this.priceChangedItems.size > 0 ? 'price-changed' : ''}">${this.formatPrice(this.cart?.totals?.total || 0)}</span>
            </span>
          </div>
          <button class="sr-cart-checkout-button">
            Checkout
          </button>
          <p class="sr-cart-powered-by">
            Taxes and shipping calculated at checkout
          </p>
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
              src="${this.getMediaUrl(item.media?.[0], 'w=128,h=128,fit=cover')}" 
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
                <button 
                  class="sr-cart-quantity-button"
                  @click="${() => this.updateQuantity(item.id, item.quantity + 1)}"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      `
      )}
    `;
  }

  // Track the last requested quantity for each item
  private lastRequestedQuantity: Map<string, number> = new Map();

  private async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    
    const item = this.cart?.items.find((i: any) => i.id === itemId);
    if (!item) return;
    
    // Track what quantity we're requesting
    this.lastRequestedQuantity.set(itemId, quantity);
    
    // Optimistic update - immediately update UI
    item.quantity = quantity;
    
    // Update line item subtotal
    const itemPrice = typeof item.price === 'object' ? item.price.amount : item.price;
    (item as any).subtotal = itemPrice * quantity;
    
    // Update cart total (price is Money object with amount property)
    if (this.cart) {
      const newSubtotal = this.cart.items.reduce((sum: number, i: any) => {
        const price = typeof i.price === 'object' ? i.price.amount : i.price;
        return sum + (price * i.quantity);
      }, 0);
      this.cart.totals.subtotal = newSubtotal;
      this.cart.totals.total = newSubtotal; // Simplified - doesn't account for tax/shipping
    }
    
    // Trigger animations immediately
    this.priceChangedItems.add(itemId);
    this.priceChangedItems.add('cart-total');
    this.requestUpdate();
    
    // Remove animation after it completes
    setTimeout(() => {
      this.priceChangedItems.delete(itemId);
      this.priceChangedItems.delete('cart-total');
      this.requestUpdate();
    }, 600);
    
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
    }, 1000); // Wait 1 second after last click
    
    this.pendingUpdates.set(itemId, timeoutId);
  }

  private async removeItem(itemId: string): Promise<void> {
    const itemIndex = this.cart?.items.findIndex((i: any) => i.id === itemId);
    if (itemIndex === undefined || itemIndex < 0) return;
    
    // Store current open state
    const wasOpen = this.isOpen;
    
    // Mark item as being removed for animation
    this.removingItems.add(itemId);
    this.requestUpdate();
    
    // Wait for animation to complete
    setTimeout(async () => {
      if (!this.cart) return;
      
      // Optimistic update - remove from UI after animation
      this.cart.items.splice(itemIndex, 1);
      
      // Check if cart is now empty
      if (this.cart.items.length === 0) {
        this.showEmptyState = true;
      }
    
      // Update cart totals
      const newSubtotal = this.cart.items.reduce((sum: number, i: any) => {
        const price = typeof i.price === 'object' ? i.price.amount : i.price;
        return sum + (price * i.quantity);
      }, 0);
      this.cart.totals.subtotal = newSubtotal;
      this.cart.totals.total = newSubtotal; // Simplified - doesn't account for tax/shipping
      
      // Trigger animation for cart total
      this.priceChangedItems.add('cart-total');
      this.removingItems.delete(itemId);
      this.requestUpdate();
      
      // Remove animation after it completes (independent of API)
      setTimeout(() => {
        this.priceChangedItems.delete('cart-total');
        this.requestUpdate();
      }, 600);
      
      // Fire and forget - don't await or handle response
      this.sdk.cart.removeItem(itemId).catch(error => {
        console.error('Failed to remove item:', error);
        // Don't rollback UI state - keep the optimistic update
      });
      
      // Force cart to stay open after update
      this.isOpen = wasOpen;
      
      // If cart should be open, ensure URL has cart hash
      if (wasOpen && !window.location.hash.includes('/~/cart')) {
        const currentHash = window.location.hash;
        const newHash = currentHash ? currentHash + '/~/cart' : '#/~/cart';
        window.history.replaceState(null, '', newHash);
      }
    }, 300); // Wait for slide out animation
  }

  private navigateToProduct(item: any): void {
    // Use source URL if available, otherwise fallback to hash navigation
    if (item.source_url) {
      // Navigate to the original page where item was added
      window.location.href = item.source_url;
    } else if (item.product_slug) {
      // Fallback to hash navigation on current page
      this.closeCart();
      window.location.hash = `!/${item.product_slug}`;
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
  
  private renderProductNotification(): TemplateResult {
    if (!this.recentlyAddedProduct) {
      return html``;
    }
    
    const product = this.recentlyAddedProduct;
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