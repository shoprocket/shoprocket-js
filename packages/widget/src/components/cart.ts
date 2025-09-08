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
  private updatingItems: Set<string> = new Set();
  
  private overlayClickHandler: (() => void) | null = null;

  override async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await this.loadCart();

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
    
    // Check if cart should be open on initial load
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
  }

  private handleCartUpdate = async (): Promise<void> => {
    await this.loadCart();
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
        this.isOpen = true;
        this.showOverlay(() => this.closeCart());
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
      <div class="sr:fixed sr:z-[9999] ${this.getPositionClasses()}" data-sr>
        <button 
          class="${this.getTriggerClasses()}"
          @click="${() => this.toggleCart()}"
        >
          ${this.renderTriggerContent(totalQuantity)}
        </button>
        
        ${this.renderProductNotification()}
      </div>
      
      <!-- Cart Panel - SEPARATE from toggle button -->
      <div class="sr:fixed sr:bg-white sr:shadow-lg sr:flex sr:flex-col sr:z-[9999] ${this.getPanelPositionClasses()} sr:transition-all sr:duration-300 sr:ease-out ${this.getCartPanelClasses()}">
        <div class="${this.getContentAnimationClasses('header')} sr:p-4 sr:border-b sr:border-gray-200 sr:flex sr:justify-between sr:items-center">
          <h3 class="sr:m-0 sr:text-xl">Your Cart</h3>
          <button class="sr:bg-transparent sr:border-none sr:text-2xl sr:cursor-pointer sr:text-gray-600 sr:p-0 sr:w-8 sr:h-8 sr:flex sr:items-center sr:justify-center sr:hover:bg-gray-100 sr:rounded sr:transition-colors sr:duration-200" @click="${() => this.closeCart()}">×</button>
        </div>
        <div class="${this.getContentAnimationClasses('items')} sr:flex-1 sr:overflow-y-auto sr:p-4">
          ${this.renderCartItems()}
        </div>
        <div class="${this.getContentAnimationClasses('footer')} sr:p-4 sr:border-t sr:border-gray-200">
          <div class="sr:text-lg sr:font-bold sr:mb-4">
            Total: ${this.formatPrice(this.cart?.totals?.total || 0)}
          </div>
          <button class="sr:bg-black sr:text-white sr:border-none sr:py-3 sr:px-6 sr:rounded sr:w-full sr:cursor-pointer sr:text-base sr:font-medium sr:transition-opacity sr:duration-200">
            Checkout
          </button>
        </div>
      </div>
    `;
  }

  private renderCartItems(): TemplateResult {
    if (!this.cart?.items?.length) {
      return html`<p class="sr:text-center sr:text-gray-600 sr:py-8">Your cart is empty</p>`;
    }

    return html`
      ${this.cart.items.map((item: any) => html`
        <div class="sr:flex sr:gap-3 sr:py-3 sr:border-b sr:border-gray-100 last:sr:border-b-0">
          <!-- Product Image -->
          <div class="sr:w-16 sr:h-16 sr:flex-shrink-0 sr:rounded sr:overflow-hidden sr:bg-gray-100">
            <img 
              src="${this.getMediaUrl(item.media?.[0], 'w=128,h=128,fit=cover')}" 
              alt="${item.product_name}"
              class="sr:w-full sr:h-full sr:object-cover"
              @error="${(e: Event) => this.handleImageError(e)}"
            >
          </div>
          
          <!-- Product Details -->
          <div class="sr:flex-1 sr:min-w-0">
            <div class="sr:font-medium sr:text-sm sr:mb-1 sr:truncate">${item.product_name}</div>
            <div class="sr:text-gray-600 sr:text-sm">${this.formatPrice(item.price)}</div>
            ${item.variant_name ? html`
              <div class="sr:text-gray-500 sr:text-xs">${item.variant_name}</div>
            ` : ''}
          </div>
          
          <!-- Quantity Controls -->
          <div class="sr:flex sr:flex-col sr:items-end sr:gap-2">
            <button 
              class="sr:text-gray-400 sr:text-sm sr:p-0 sr:bg-transparent sr:border-none sr:cursor-pointer sr:transition-colors sr:duration-200 sr:hover:text-red-600"
              @click="${() => this.removeItem(item.id)}"
              aria-label="Remove item"
            >✕</button>
            
            <div class="sr:flex sr:items-center sr:gap-1 sr:bg-gray-100 sr:rounded sr:px-1">
              <button 
                class="sr:w-6 sr:h-6 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-gray-600 sr:flex sr:items-center sr:justify-center sr:transition-colors sr:duration-200 sr:hover:text-black ${item.quantity === 1 || this.updatingItems.has(item.id) ? 'sr:opacity-50 sr:cursor-not-allowed' : ''}"
                @click="${() => this.updateQuantity(item.id, item.quantity - 1)}"
                ?disabled="${item.quantity === 1 || this.updatingItems.has(item.id)}"
                aria-label="Decrease quantity"
              >${this.updatingItems.has(item.id) ? loadingSpinner(12) : '−'}</button>
              <span class="sr:text-sm sr:font-medium sr:w-8 sr:text-center">${item.quantity}</span>
              <button 
                class="sr:w-6 sr:h-6 sr:bg-transparent sr:border-none sr:cursor-pointer sr:text-gray-600 sr:flex sr:items-center sr:justify-center sr:transition-colors sr:duration-200 sr:hover:text-black ${this.updatingItems.has(item.id) ? 'sr:opacity-50 sr:cursor-not-allowed' : ''}"
                @click="${() => this.updateQuantity(item.id, item.quantity + 1)}"
                ?disabled="${this.updatingItems.has(item.id)}"
                aria-label="Increase quantity"
              >${this.updatingItems.has(item.id) ? loadingSpinner(12) : '+'}</button>
            </div>
          </div>
        </div>
      `)}
    `;
  }

  private async updateQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity < 1) return;
    
    this.updatingItems.add(itemId);
    this.requestUpdate();
    
    try {
      await this.sdk.cart.updateItem(itemId, quantity);
      await this.loadCart();
    } catch (error) {
      console.error('Failed to update quantity:', error);
      this.showError('Failed to update item quantity');
    } finally {
      this.updatingItems.delete(itemId);
      this.requestUpdate();
    }
  }

  private async removeItem(itemId: string): Promise<void> {
    this.updatingItems.add(itemId);
    this.requestUpdate();
    
    try {
      await this.sdk.cart.removeItem(itemId);
      await this.loadCart();
    } catch (error) {
      console.error('Failed to remove item:', error);
      this.showError('Failed to remove item from cart');
    } finally {
      this.updatingItems.delete(itemId);
      this.requestUpdate();
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
    const width = 'sr:w-[100dvw] sr:md:max-w-[440px]';
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

  private getTriggerClasses(): string {
    const isMiddle = this.position.includes('middle');
    const opacityClass = this.isOpen ? 'sr:opacity-0' : 'sr:opacity-100';
    
    if (isMiddle) {
      const baseClasses = 'sr:bg-white sr:text-black sr:border-none sr:cursor-pointer sr:relative sr:shadow-sm sr:hover:shadow-lg sr:transition-all sr:duration-200 sr:flex sr:items-center sr:justify-center';
      const sizeClasses = 'sr:w-[var(--sr-cart-tab-width)] sr:h-[var(--sr-cart-tab-height)]';
      const roundingClasses = this.position === 'middle-right' 
        ? 'sr:rounded-s sr:rounded-e-none' 
        : 'sr:rounded-e sr:rounded-s-none';
      return `${baseClasses} ${sizeClasses} ${roundingClasses} sr:flex-col sr:py-2 sr:gap-1 ${opacityClass}`;
    }
    
    // Bottom positions - bubble style (mobile first: small size, then larger)
    return `sr:bg-white sr:text-black sr:border-none sr:rounded sr:w-[var(--sr-cart-size-sm)] sr:h-[var(--sr-cart-size-sm)] sr:flex sr:items-center sr:justify-center sr:cursor-pointer sr:relative sr:shadow-md sr:hover:shadow-xl sr:transition-all sr:duration-200 sr:sm:w-[var(--sr-cart-size)] sr:sm:h-[var(--sr-cart-size)] ${opacityClass}`;
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
        <span class="sr:absolute sr:-top-2 sr:-end-2 sr:bg-black sr:text-white sr:rounded-full 
               sr:min-w-[20px] sr:h-5 sr:px-1.5 sr:text-xs sr:font-bold
               sr:flex sr:items-center sr:justify-center sr:transition-all sr:duration-300
               ${this.isOpen && this.widgetStyle === 'bubble' ? 'sr:scale-0 sr:opacity-0' : 'sr:scale-100 sr:opacity-100'}">
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
      <div class="sr:absolute ${notificationClasses} sr:bg-white sr:rounded sr:shadow-md sr:px-3 sr:py-2 sr:min-w-[240px] sr:max-w-[300px] sr:border sr:border-gray-100 ${animationClass} sr:z-[-1] sr:h-[var(--sr-cart-size)] sm:sr:h-[var(--sr-cart-size-sm)] sr:flex sr:items-center">
        <!-- Triangle arrow -->
        ${this.renderNotificationArrow()}
        <div class="sr:flex sr:items-center sr:gap-3 sr:w-full">
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
          <div class="sr:flex-1 sr:min-w-0 sr:space-y-0.5">
            <p class="sr:text-sm sr:font-medium sr:text-gray-900 sr:truncate sr:leading-tight">${product.name}</p>
            <p class="sr:text-xs sr:text-gray-600 sr:leading-tight">${this.formatPrice(product.price)}</p>
            ${product.variantText ? html`
              <p class="sr:text-xs sr:text-gray-500 sr:truncate sr:leading-tight">${product.variantText}</p>
            ` : ''}
          </div>
          <svg class="sr:w-5 sr:h-5 sr:text-green-500 sr:flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
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