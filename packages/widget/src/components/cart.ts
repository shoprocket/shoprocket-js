import { html, type TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { ShoprocketElement } from '../core/base-component';
import type { Cart, ApiResponse } from '../types/api';
import { renderErrorNotification } from './error-notification';
import { loadingSpinner } from './loading-spinner';

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

  @state()
  private cart: Cart | null = null;
  
  @state()
  private overlayVisible = false;
  
  @state()
  private recentlyAddedProduct: any = null;
  
  @state()
  private notificationSliding: 'in' | 'out' | null = null;
  
  @state()
  private updatingItems: Map<string, 'increase' | 'decrease'> = new Map();
  
  // Track pending API calls for debouncing
  private pendingUpdates: Map<string, NodeJS.Timeout> = new Map();
  
  @state()
  private priceChangedItems: Set<string> = new Set();
  
  @state()
  private removingItems: Set<string> = new Set();
  
  @state()
  private showEmptyState = false;
  
  private overlayClickHandler: (() => void) | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    
    // Listen for cart updates
    this.handleCartUpdate = this.handleCartUpdate.bind(this);
    window.addEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    
    // Listen for product added events
    this.handleProductAdded = this.handleProductAdded.bind(this);
    window.addEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    
    // Listen for clicks outside cart
    this.handleClickOutside = this.handleClickOutside.bind(this);
    window.addEventListener('click', this.handleClickOutside);
    
    // Handle browser back/forward navigation
    this.handlePopState = this.handlePopState.bind(this);
    window.addEventListener('popstate', this.handlePopState);
    
    // Handle cart control events
    this.handleOpenCart = this.handleOpenCart.bind(this);
    this.handleCloseCart = this.handleCloseCart.bind(this);
    this.handleToggleCart = this.handleToggleCart.bind(this);
    window.addEventListener('open-cart', this.handleOpenCart as EventListener);
    window.addEventListener('close-cart', this.handleCloseCart as EventListener);
    window.addEventListener('toggle-cart', this.handleToggleCart as EventListener);
    
    // Note: We use popstate instead of hashchange to avoid double-handling
    
    // Register global cart toggle function
    if (!(window as any).ShoprocketWidget) {
      (window as any).ShoprocketWidget = {};
    }
    (window as any).ShoprocketWidget.cart = {
      toggle: this.toggleCart.bind(this),
      open: this.openCart.bind(this),
      close: this.closeCart.bind(this)
    };
    
    
    // Load cart data
    await this.loadCart();
    
    // Check if cart should be open on initial load AFTER loading cart
    if (window.location.hash.includes('/~/cart')) {
      this.openCart();
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('shoprocket:cart:updated', this.handleCartUpdate);
    window.removeEventListener('shoprocket:product:added', this.handleProductAdded as EventListener);
    window.removeEventListener('click', this.handleClickOutside);
    window.removeEventListener('popstate', this.handlePopState);
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
  
  private handleOpenCart = (): void => {
    this.openCart();
  }
  
  private handleCloseCart = (): void => {
    this.closeCart();
  }
  
  private handleToggleCart = (): void => {
    this.toggleCart();
  }
  
  
  private handleProductAdded = (event: CustomEvent): void => {
    const { product } = event.detail;
    this.recentlyAddedProduct = product;
    this.notificationSliding = 'in';
    
    // Start slide out after 2.7 seconds
    setTimeout(() => {
      this.notificationSliding = 'out';
      
      // Remove completely after slide animation completes
      setTimeout(() => {
        this.recentlyAddedProduct = null;
        this.notificationSliding = null;
      }, 300); // Match animation duration
    }, 2700);
  }
  
  private handlePopState = (): void => {
    // Update cart state based on URL hash
    if (window.location.hash.includes('/~/cart')) {
      if (!this.isOpen) {
        this.openCart();
      }
    } else {
      if (this.isOpen) {
        this.isOpen = false;
        this.hideOverlay();
      }
    }
  }

  private handleClickOutside = (event: MouseEvent): void => {
    if (!this.isOpen) return;
    
    // Check if click was inside the cart widget
    const target = event.target as HTMLElement;
    if (this.contains(target)) return;
    
    // Close cart if clicked outside
    this.closeCart();
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
  
  private showOverlay(clickHandler?: () => void): void {
    this.overlayVisible = true;
    this.overlayClickHandler = clickHandler || null;
  }
  
  private hideOverlay(): void {
    this.overlayVisible = false;
    this.overlayClickHandler = null;
  }
  
  private toggleCart(): void {
    if (this.isOpen) {
      this.closeCart();
    } else {
      this.openCart();
    }
  }
  
  private openCart(): void {
    this.isOpen = true;
    this.requestUpdate(); // Force re-render
    this.showOverlay(() => this.closeCart());
    // Add cart to URL hash, preserving any existing path
    const currentHash = window.location.hash;
    if (!currentHash.includes('/~/cart')) {
      let newHash: string;
      if (currentHash && currentHash !== '#' && currentHash !== '#/') {
        // If there's an existing path (like a product), append cart to it
        newHash = currentHash + '/~/cart';
      } else {
        // If no existing path, use the cart-only format
        newHash = '#/~/cart';
      }
      window.history.pushState(null, '', newHash);
    }
  }
  
  private closeCart(): void {
    this.isOpen = false;
    this.hideOverlay();
    // Remove cart from URL hash
    const currentHash = window.location.hash;
    if (currentHash.includes('/~/cart')) {
      // Remove the /~/cart part, preserving the rest of the path
      const newHash = currentHash.replace('/~/cart', '');
      window.location.hash = newHash;
    }
  }

  protected override render(): TemplateResult {
    // Calculate total quantity across all items
    const totalQuantity = this.cart?.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;

    return html`
      ${renderErrorNotification(this.errorMessage)}
      <!-- Generic Overlay -->
      <div 
        class="sr:fixed sr:inset-0 sr:bg-black/50 sr:z-[9998] sr:transition-opacity ${this.overlayVisible ? 'sr:duration-200 sr:opacity-100 sr:pointer-events-auto' : 'sr:duration-150 sr:opacity-0 sr:pointer-events-none'}"
        @click="${() => this.overlayClickHandler?.()}"
      ></div>
      
      <!-- Cart Toggle Button -->
      <div class="sr:fixed sr:z-[9999] ${this.getPositionClasses()}" data-shoprocket="cart-toggle">
        <button 
          class="sr:bg-white sr:text-black sr:border-none sr:rounded-sm sr:w-16 sr:h-16 sr:flex sr:items-center sr:justify-center sr:cursor-pointer sr:relative sr:shadow-lg sr:hover:shadow-xl sr:transition-all sr:duration-200 sr:transform sr:hover:scale-105 ${this.isOpen ? 'sr:opacity-0 sr:pointer-events-none' : 'sr:opacity-100'}"
          @click="${() => this.toggleCart()}"
        >
          ${this.renderTriggerContent(totalQuantity)}
        </button>
        
        ${this.renderProductNotification()}
      </div>
      
      <!-- Cart Panel - SEPARATE from toggle button -->
      <div class="sr:fixed sr:bg-white sr:shadow-2xl sr:flex sr:flex-col sr:z-[9999] ${this.getPanelPositionClasses()} sr:transition-all sr:duration-300 sr:ease-out ${this.getCartPanelClasses()}">
        <div class="${this.getContentAnimationClasses('header')} sr:px-6 sr:py-5 sr:border-b sr:border-gray-100 sr:flex sr:justify-between sr:items-center">
          <h2 class="sr:m-0 sr:text-base sr:font-semibold sr:text-gray-900">Cart</h2>
          <button class="sr:bg-transparent sr:border-none sr:text-gray-400 sr:hover:text-gray-600 sr:p-0 sr:w-8 sr:h-8 sr:flex sr:items-center sr:justify-center sr:rounded-full sr:hover:bg-gray-100 sr:transition-all sr:duration-200 sr:cursor-pointer" @click="${() => this.closeCart()}">
            <svg class="sr:w-4 sr:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </button>
        </div>
        <div class="${this.getContentAnimationClasses('items')} sr:flex-1 sr:overflow-y-auto sr:px-6 sr:py-4 sr:transition-all sr:duration-300">
          ${this.renderCartItems()}
        </div>
        <div class="${this.getContentAnimationClasses('footer')} sr:px-6 sr:py-5 sr:border-t sr:border-gray-100 sr:space-y-4">
          <div class="sr:flex sr:justify-between sr:items-center">
            <span class="sr:text-sm sr:text-gray-600">Subtotal</span>
            <span class="sr:text-base sr:font-medium sr:text-gray-900">
              <span class="sr:inline-block sr:px-1 sr:-mx-1 sr:rounded ${this.priceChangedItems.size > 0 ? 'sr:animate-[priceFlash_600ms_ease-out]' : ''}">${this.formatPrice(this.cart?.totals?.total || 0)}</span>
            </span>
          </div>
          <button class="sr:bg-gray-900 sr:hover:bg-black sr:text-white sr:border-none sr:py-3 sr:px-6 sr:rounded-sm sr:w-full sr:cursor-pointer sr:text-sm sr:font-medium sr:transition-all sr:duration-200 sr:transform sr:hover:scale-[1.01] sr:active:scale-[0.99]">
            Checkout
          </button>
          <p class="sr:text-xs sr:text-center sr:text-gray-500 sr:m-0">
            Taxes and shipping calculated at checkout
          </p>
        </div>
      </div>
    `;
  }

  private renderCartItems(): TemplateResult {
    if (!this.cart?.items?.length || this.showEmptyState) {
      return html`
        <div class="sr:flex sr:flex-col sr:items-center sr:justify-center sr:h-full sr:py-12 sr:text-center sr:animate-[fadeInScale_300ms_ease-out]">
          <svg class="sr:w-16 sr:h-16 sr:text-gray-300 sr:mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
          </svg>
          <p class="sr:text-gray-600 sr:text-base sr:mb-6">Your cart is empty</p>
          <button 
            class="sr:text-sm sr:text-gray-900 sr:underline sr:underline-offset-2 sr:bg-transparent sr:border-none sr:cursor-pointer sr:hover:text-black sr:transition-colors"
            @click="${() => this.closeCart()}"
          >
            Continue shopping
          </button>
        </div>
      `;
    }

    return html`
      ${this.cart.items.map((item: any) => html`
        <div class="sr:overflow-hidden ${this.removingItems.has(item.id) ? 'sr:animate-[slideOutRight_300ms_ease-in_forwards]' : ''}">
          <div class="sr:flex sr:gap-4 sr:py-4 sr:border-b sr:border-gray-100 last:sr:border-b-0">
          <!-- Product Image -->
          <div class="sr:w-16 sr:h-16 sr:flex-shrink-0 sr:rounded sr:overflow-hidden sr:bg-gray-50 sr:cursor-pointer"
               @click="${() => this.navigateToProduct(item)}">
            <img 
              src="${this.getMediaUrl(item.media?.[0], 'w=128,h=128,fit=cover')}" 
              alt="${item.product_name}"
              class="sr:w-full sr:h-full sr:object-cover"
              @error="${(e: Event) => this.handleImageError(e)}"
            >
          </div>
          
          <!-- Product Details -->
          <div class="sr:flex-1 sr:min-w-0">
            <div class="sr:flex sr:items-start sr:justify-between sr:gap-2">
              <div class="sr:flex-1">
                <h4 class="sr:font-medium sr:text-sm sr:text-gray-900 sr:mb-0.5 sr:leading-tight sr:cursor-pointer sr:hover:text-gray-600 sr:transition-colors"
                    @click="${() => this.navigateToProduct(item)}">${item.product_name}</h4>
                ${item.variant_name ? html`
                  <div class="sr:text-gray-500 sr:text-xs sr:mb-0">${item.variant_name}</div>
                ` : ''}
              </div>
            </div>
            
            <div class="sr:flex sr:items-center sr:justify-between sr:mt-1">
              <div class="sr:text-sm sr:font-medium sr:text-gray-900 sr:relative">
                <span class="sr:inline-block sr:px-1 sr:-mx-1 sr:rounded ${this.priceChangedItems.has(item.id) ? 'sr:animate-[priceFlash_600ms_ease-out]' : ''}">${this.formatPrice(item.subtotal)}</span>
              </div>
              
              <!-- Quantity Controls with Remove Button -->
              <div class="sr:flex sr:items-center sr:gap-2">
                <div class="sr:flex sr:items-center sr:gap-0 sr:border sr:border-gray-200 sr:rounded-sm">
                <button 
                  class="sr:w-8 sr:h-8 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-gray-600 sr:flex sr:items-center sr:justify-center sr:transition-colors sr:duration-200 sr:hover:bg-gray-50 ${item.quantity === 1 ? 'sr:opacity-50 sr:cursor-not-allowed' : ''}"
                  @click="${() => this.updateQuantity(item.id, item.quantity - 1, 'decrease')}"
                  ?disabled="${item.quantity === 1}"
                  aria-label="Decrease quantity"
                >
                  −
                </button>
                <span class="sr:text-sm sr:font-medium sr:w-8 sr:text-center sr:border-x sr:border-gray-200">${item.quantity}</span>
                <button 
                  class="sr:w-8 sr:h-8 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-gray-600 sr:flex sr:items-center sr:justify-center sr:transition-colors sr:duration-200 sr:hover:bg-gray-50"
                  @click="${() => this.updateQuantity(item.id, item.quantity + 1, 'increase')}"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
              <!-- Remove Button -->
              <button 
                class="sr:text-gray-400 sr:hover:text-red-500 sr:p-2 sr:bg-transparent sr:border-none sr:cursor-pointer sr:transition-colors sr:duration-200"
                @click="${() => this.removeItem(item.id)}"
                aria-label="Remove item"
                title="Remove item"
              >
                <svg class="sr:w-4 sr:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
      `)}
    `;
  }

  private async updateQuantity(itemId: string, quantity: number, action: 'increase' | 'decrease'): Promise<void> {
    if (quantity < 1) return;
    
    // Store original state for rollback
    const originalCart = JSON.parse(JSON.stringify(this.cart));
    const item = this.cart?.items.find((i: any) => i.id === itemId);
    if (!item) return;
    
    // Optimistic update - immediately update UI
    item.quantity = quantity;
    item.subtotal = item.price * quantity;
    
    // Update cart total
    if (this.cart) {
      const newSubtotal = this.cart.items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
      this.cart.totals.subtotal = newSubtotal;
      this.cart.totals.total = newSubtotal; // Simplified - doesn't account for tax/shipping
    }
    
    // Trigger animations immediately
    this.priceChangedItems.add(itemId);
    this.requestUpdate();
    
    // Cancel any pending update for this item
    if (this.pendingUpdates.has(itemId)) {
      clearTimeout(this.pendingUpdates.get(itemId));
    }
    
    // Debounce the API call - wait 300ms after last click
    const timeoutId = setTimeout(async () => {
      try {
        // Make API call with final quantity
        const updatedCart = await this.sdk.cart.updateItem(itemId, quantity);
        
        // Use the response directly
        if (updatedCart && typeof updatedCart === 'object') {
          this.cart = 'data' in updatedCart ? updatedCart.data : updatedCart;
        }
        
        // Remove animation class after animation completes
        setTimeout(() => {
          this.priceChangedItems.delete(itemId);
          this.requestUpdate();
        }, 600);
      } catch (error) {
        console.error('Failed to update quantity:', error);
        // Rollback on error
        this.cart = originalCart;
        this.showError('Failed to update item quantity');
      } finally {
        // Clean up
        this.pendingUpdates.delete(itemId);
      }
    }, 300); // Wait 300ms after last click
    
    this.pendingUpdates.set(itemId, timeoutId);
  }

  private async removeItem(itemId: string): Promise<void> {
    // Store original state for rollback
    const originalCart = JSON.parse(JSON.stringify(this.cart));
    const itemIndex = this.cart?.items.findIndex((i: any) => i.id === itemId);
    if (itemIndex === undefined || itemIndex < 0) return;
    
    // Store current open state
    const wasOpen = this.isOpen;
    
    // Mark item as being removed for animation
    this.removingItems.add(itemId);
    this.requestUpdate();
    
    // Wait for animation to complete
    setTimeout(async () => {
      // Optimistic update - remove from UI after animation
      const removedItem = this.cart.items[itemIndex];
      this.cart.items.splice(itemIndex, 1);
      
      // Check if cart is now empty
      if (this.cart.items.length === 0) {
        this.showEmptyState = true;
      }
    
      // Update cart totals
      if (this.cart) {
        const newSubtotal = this.cart.items.reduce((sum: number, i: any) => sum + (i.price * i.quantity), 0);
        this.cart.totals.subtotal = newSubtotal;
        this.cart.totals.total = newSubtotal; // Simplified - doesn't account for tax/shipping
        this.cart.item_count = this.cart.items.reduce((sum: number, i: any) => sum + i.quantity, 0);
      }
      
      // Trigger animation for cart total
      this.priceChangedItems.add('cart-total');
      this.removingItems.delete(itemId);
      this.requestUpdate();
      
      try {
        // Make API call asynchronously
        const updatedCart = await this.sdk.cart.removeItem(itemId);
        
        // Update with the response
        if (updatedCart && typeof updatedCart === 'object') {
          const newCart = 'data' in updatedCart ? updatedCart.data : updatedCart;
          if (newCart) {
            this.cart = newCart;
          }
        }
        
        // Force cart to stay open after update
        this.isOpen = wasOpen;
        
        // If cart should be open, ensure URL has cart hash
        if (wasOpen && !window.location.hash.includes('/~/cart')) {
          const currentHash = window.location.hash;
          const newHash = currentHash ? currentHash + '/~/cart' : '#/~/cart';
          window.history.replaceState(null, '', newHash);
        }
        
        // Remove animation class after animation completes
        setTimeout(() => {
          this.priceChangedItems.delete('cart-total');
          this.requestUpdate();
        }, 600);
      } catch (error) {
        console.error('Failed to remove item:', error);
        // Rollback on error
        this.cart = originalCart;
        this.showError('Failed to remove item from cart');
        // Force cart to stay open
        this.isOpen = wasOpen;
        this.requestUpdate();
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

  private getPositionClasses(): string {
    switch (this.position) {
      case 'bottom-left':
        return 'sr:bottom-5 sr:start-5';
      case 'top-left':
        return 'sr:top-5 sr:start-5';
      case 'top-right':
        return 'sr:top-5 sr:end-5';
      case 'middle-right':
        return 'sr:top-1/2 sr:end-0 sr:-translate-y-1/2';
      case 'middle-left':
        return 'sr:top-1/2 sr:start-0 sr:-translate-y-1/2';
      default: // bottom-right
        return 'sr:bottom-5 sr:end-5';
    }
  }

  private getPanelPositionClasses(): string {
    // For sidebar/drawer style, always position at screen edge
    if (this.widgetStyle === 'sidebar' || this.widgetStyle === 'drawer') {
      return this.getSidebarPanelPosition();
    }
    
    // For bubble style, position relative to bubble button (but only for valid positions)
    if (this.widgetStyle === 'bubble') {
      // Middle positions should not use bubble style - force sidebar behavior
      if (this.position.includes('middle')) {
        return this.getSidebarPanelPosition();
      }
      
      // Mobile: edge positioned like sidebar, Desktop: positioned near button
      switch (this.position) {
        case 'bottom-left':
          return 'sr:top-0 sr:start-0 sr:md:top-auto sr:md:bottom-5 sr:md:start-5';
        case 'top-left':
          return 'sr:top-0 sr:start-0 sr:md:top-5 sr:md:start-5';
        case 'top-right':
          return 'sr:top-0 sr:end-0 sr:md:top-5 sr:md:end-5';
        default: // bottom-right
          return 'sr:top-0 sr:end-0 sr:md:top-auto sr:md:bottom-5 sr:md:end-5';
      }
    }
    
    // For tab style, position at edge with offset for tab button
    switch (this.position) {
      case 'bottom-left':
        return 'sr:bottom-[100px] sr:start-0';
      case 'top-left':
        return 'sr:top-[100px] sr:start-0';
      case 'top-right':
        return 'sr:top-[100px] sr:end-0';
      case 'middle-right':
        return 'sr:top-1/2 sr:end-0 sr:-translate-y-1/2';
      case 'middle-left':
        return 'sr:top-1/2 sr:start-0 sr:-translate-y-1/2';
      default: // bottom-right
        return 'sr:bottom-[100px] sr:end-0';
    }
  }
  
  private getSidebarPanelPosition(): string {
    // Sidebar/drawer panels always stick to screen edges
    switch (this.position) {
      case 'bottom-left':
      case 'top-left':
      case 'middle-left':
        return 'sr:top-0 sr:start-0';
      case 'bottom-right':
      case 'top-right': 
      case 'middle-right':
      default: // right positions
        return 'sr:top-0 sr:end-0';
    }
  }
  
  private getCartPanelClasses(): string {
    // Force sidebar style for middle positions
    if (this.position.includes('middle')) {
      return this.getSidebarSlideClasses();
    }
    
    switch (this.widgetStyle) {
      case 'bubble':
        // Use sidebar behavior on mobile, bubble on desktop
        return this.getResponsiveBubbleClasses();
      case 'sidebar':
      case 'drawer': // Allow both names
        return this.getSidebarSlideClasses();
      case 'tab':
        return this.getTabSlideClasses();
      default:
        return this.getResponsiveBubbleClasses();
    }
  }

  
  private getResponsiveBubbleClasses(): string {
    // Mobile: sidebar behavior, Desktop: bubble behavior
    const mobileWidth = 'sr:w-[100dvw]';
    const mobileHeight = 'sr:h-[100dvh]';
    const mobileRounded = 'sr:rounded-none';
    
    // Get transform origin for desktop bubble
    let transformOrigin = '';
    let maxHeightCalc = '';
    switch (this.position) {
      case 'bottom-left':
        transformOrigin = 'sr:origin-bottom-left';
        maxHeightCalc = 'sr:max-h-[calc(100vh-40px)]'; // 20px top + 20px bottom spacing
        break;
      case 'bottom-right':
        transformOrigin = 'sr:origin-bottom-right';
        maxHeightCalc = 'sr:max-h-[calc(100vh-40px)]'; // 20px top + 20px bottom spacing
        break;
      case 'top-left':
        transformOrigin = 'sr:origin-top-left';
        maxHeightCalc = 'sr:max-h-[calc(100vh-40px)]'; // 20px top + 20px bottom spacing
        break;
      case 'top-right':
        transformOrigin = 'sr:origin-top-right';
        maxHeightCalc = 'sr:max-h-[calc(100vh-40px)]'; // 20px top + 20px bottom spacing
        break;
      case 'middle-left':
        transformOrigin = 'sr:origin-left';
        maxHeightCalc = 'sr:max-h-[calc(100vh-40px)]';
        break;
      case 'middle-right':
        transformOrigin = 'sr:origin-right';
        maxHeightCalc = 'sr:max-h-[calc(100vh-40px)]';
        break;
    }
    
    if (this.isOpen) {
      // Mobile: full sidebar, Desktop: scaled bubble
      const mobileTranslate = 'sr:translate-x-0 sr:translate-y-0 sr:opacity-100';
      const desktopSize = `sr:md:w-[440px] sr:md:max-w-[calc(100vw-40px)] sr:md:h-[625px] ${maxHeightCalc.replace('sr:', 'sr:md:')}`;
      const desktopTransform = 'sr:md:scale-100 sr:md:opacity-100';
      // Add slight translate adjustment to keep edge aligned during scale
      const alignmentAdjust = (this.position === 'bottom-right' || this.position === 'top-right' || this.position === 'bottom-left' || this.position === 'top-left') ? 'sr:md:translate-x-0 sr:md:translate-y-0' : '';
      return `${mobileWidth} ${mobileHeight} ${mobileRounded} ${mobileTranslate} ${desktopSize} ${desktopTransform} ${alignmentAdjust} sr:md:rounded ${transformOrigin}`;
    }
    
    // Closed state
    // Mobile: slide out with opacity, Desktop: scale down to bubble
    let mobileTranslate = '';
    switch (this.position) {
      case 'bottom-left':
      case 'top-left':
      case 'middle-left':
        mobileTranslate = 'sr:-translate-x-full sr:opacity-0';
        break;
      default: // right positions
        mobileTranslate = 'sr:translate-x-full sr:opacity-0';
    }
    
    const desktopSize = 'sr:md:w-[var(--sr-cart-size)] sr:md:h-[var(--sr-cart-size)]';
    const desktopTransform = 'sr:md:translate-x-0 sr:md:translate-y-0 sr:md:scale-0 sr:md:opacity-0';
    return `${mobileWidth} ${mobileHeight} ${mobileTranslate} ${desktopSize} ${desktopTransform} ${transformOrigin}`;
  }

  private getSidebarSlideClasses(): string {
    // Sidebar style - full height, slides from the side based on position
    const width = 'sr:w-[100dvw] sr:md:w-[400px] sr:md:max-w-[calc(100vw-40px)]';
    const height = 'sr:h-[100dvh]';
    const rounded = 'sr:rounded-none';
    
    if (this.isOpen) {
      return `${width} ${height} ${rounded} sr:translate-x-0`;
    }
    
    // Slide out based on position
    switch (this.position) {
      case 'bottom-left':
      case 'top-left':
      case 'middle-left':
        return `${width} ${height} ${rounded} sr:-translate-x-full`;
      default: // right positions
        return `${width} ${height} ${rounded} sr:translate-x-full`;
    }
  }
  
  private getTabSlideClasses(): string {
    if (this.isOpen) {
      // Mobile first: fullscreen slide in from bottom on mobile, side slide on desktop
      return 'sr:w-full sr:h-[70vh] sr:translate-y-0 sr:md:w-[440px] sr:md:max-w-[calc(100vw-40px)] sr:md:h-[625px] sr:md:max-h-[calc(100vh-40px)] sr:md:translate-x-0';
    }
    // Slide out
    return 'sr:w-full sr:h-[70vh] sr:translate-y-full sr:md:w-[440px] sr:md:max-w-[calc(100vw-40px)] sr:md:h-[625px] sr:md:max-h-[calc(100vh-40px)] sr:md:translate-x-full';
  }


  private renderTriggerContent(itemCount: number): TemplateResult {
    const isMiddle = this.position.includes('middle');
    
    if (isMiddle) {
      return html`
        <div class="sr:flex sr:flex-col sr:items-center sr:justify-center sr:gap-1">
          ${itemCount > 0 ? html`
            <span class="sr:text-sm sr:font-bold">${itemCount}</span>
          ` : ''}
          <span class="sr:w-6 sr:h-6 sr-icon sr:flex" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
        </div>
      `;
    }
    
    // Bottom positions - standard layout
    return html`
      <span class="sr:w-6 sr:h-6 sr-icon sr:flex sr:items-center sr:justify-center" aria-hidden="true">${unsafeHTML(shoppingBasketIcon)}</span>
      ${itemCount > 0 ? html`
        <span class="sr:absolute sr:-top-2 sr:-right-2 sr:bg-black sr:text-white sr:rounded-full 
               sr:min-w-[20px] sr:h-5 sr:px-1.5 sr:text-xs sr:font-bold
               sr:flex sr:items-center sr:justify-center sr:transition-all sr:duration-300">
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
    const notificationClasses = this.getNotificationPositionClasses();
    
    let animationClass = '';
    if (this.notificationSliding === 'in') {
      animationClass = this.position.includes('left') ? 'sr:animate-[slideInCartLeft_0.3s_ease-out]' : 'sr:animate-[slideInCartRight_0.3s_ease-out]';
    } else if (this.notificationSliding === 'out') {
      animationClass = this.position.includes('left') ? 'sr:animate-[slideOutCartLeft_0.3s_ease-out]' : 'sr:animate-[slideOutCartRight_0.3s_ease-out]';
    }
    
    return html`
      <div class="sr:absolute ${notificationClasses} sr:bg-white sr:rounded-sm sr:shadow-md sr:px-3 sr:py-3 sr:min-w-[260px] sr:max-w-[320px] sr:border sr:border-gray-100 ${animationClass} sr:z-[-1]">
        <!-- Triangle arrow -->
        ${this.renderNotificationArrow()}
        <div class="sr:flex sr:items-start sr:gap-3 sr:w-full">
          ${product.media ? html`
            <div class="sr:w-10 sr:h-10 sr:flex-shrink-0 sr:rounded sr:overflow-hidden sr:bg-gray-100">
              <img 
                src="${this.getMediaUrl(product.media, 'w=80,h=80,fit=cover')}" 
                alt="${product.name}"
                class="sr:w-full sr:h-full sr:object-cover"
                @error="${(e: Event) => this.handleImageError(e)}"
              >
            </div>
          ` : ''}
          <div class="sr:flex-1 sr:min-w-0">
            <p class="sr:text-sm sr:font-medium sr:text-gray-900 sr:leading-tight sr:mb-0.5 sr:truncate">${product.name}</p>
            <div class="sr:flex sr:items-center sr:gap-2">
              <span class="sr:text-xs sr:text-gray-700 sr:flex-shrink-0">${this.formatPrice(product.price)}</span>
              ${product.variantText ? html`
                <span class="sr:text-xs sr:text-gray-500 sr:truncate">• ${product.variantText}</span>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  private getNotificationPositionClasses(): string {
    // Position the notification to the side of the cart button
    switch (this.position) {
      case 'bottom-left':
        return 'sr:bottom-0 sr:left-full sr:ml-2';
      case 'top-left':
        return 'sr:top-0 sr:left-full sr:ml-2';
      case 'top-right':
        return 'sr:top-0 sr:right-full sr:mr-2';
      case 'middle-right':
        return 'sr:right-full sr:top-0 sr:mr-2';
      case 'middle-left':
        return 'sr:left-full sr:top-0 sr:ml-2';
      default: // bottom-right - show to the left
        return 'sr:bottom-0 sr:right-full sr:mr-2';
    }
  }
  
  private getContentAnimationClasses(section: 'header' | 'items' | 'footer'): string {
    // Only apply animation on desktop bubble style
    if (this.widgetStyle !== 'bubble') {
      return '';
    }
    
    // Special handling for the footer/checkout section
    if (section === 'footer') {
      if (this.isOpen) {
        // Delay fade in significantly for footer
        return 'sr:md:opacity-0 sr:md:animate-[fadeIn_200ms_ease-out_300ms_forwards]';
      } else {
        // Fade out immediately
        return 'sr:md:opacity-0 sr:md:animate-[fadeOut_50ms_ease-out_forwards]';
      }
    }
    
    // Regular animations for other sections
    const animations = {
      header: this.isOpen ? 'sr:md:animate-[fadeIn_200ms_ease-out_100ms_forwards]' : 'sr:md:animate-[fadeOut_100ms_ease-out_forwards]',
      items: this.isOpen ? 'sr:md:animate-[fadeIn_200ms_ease-out_150ms_forwards]' : 'sr:md:animate-[fadeOut_100ms_ease-out_forwards]',
      footer: '' // handled above
    };
    
    // Start with opacity-0 on desktop for bubble style
    return `sr:md:opacity-0 ${animations[section]}`;
  }

  private renderNotificationArrow(): TemplateResult {
    // Arrow styles based on cart position
    let arrowClasses = '';
    
    switch (this.position) {
      case 'bottom-left':
        // Arrow pointing left to cart
        arrowClasses = 'sr:absolute sr:left-0 sr:top-1/2 sr:-translate-y-1/2 sr:-translate-x-full';
        break;
      case 'middle-left':
        // Arrow pointing left
        arrowClasses = 'sr:absolute sr:left-0 sr:top-1/2 sr:-translate-y-1/2 sr:-translate-x-full';
        break;
      case 'middle-right':
        // Arrow pointing right
        arrowClasses = 'sr:absolute sr:right-0 sr:top-1/2 sr:-translate-y-1/2 sr:translate-x-full sr:rotate-180';
        break;
      default: // bottom-right
        // Arrow pointing right to cart
        arrowClasses = 'sr:absolute sr:right-0 sr:top-1/2 sr:-translate-y-1/2 sr:translate-x-full sr:rotate-180';
        break;
    }
    
    return html`
      <div class="${arrowClasses}">
        <div class="sr:w-0 sr:h-0 
          sr:border-t-[5px] sr:border-t-transparent
          sr:border-b-[5px] sr:border-b-transparent
          sr:border-r-[6px] sr:border-r-white">
        </div>
      </div>
    `;
  }
}