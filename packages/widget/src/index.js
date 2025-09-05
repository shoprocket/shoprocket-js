/**
 * Shoprocket Widget
 * 
 * Copyright (c) 2025 Shoprocket Ltd.
 * 
 * This source code is proprietary and confidential.
 * Unauthorized copying or distribution is strictly prohibited.
 * 
 * @license Proprietary
 */

import { ShoprocketCore } from '@shoprocket/core';
import './styles.css';

class ShoprocketWidget {
  constructor() {
    this.sdk = null;
    this.initialized = false;
    this.containers = new Map();
  }

  /**
   * Initialize the widget with a public key
   */
  async init(publicKey, options = {}) {
    if (this.initialized) {
      console.warn('Shoprocket: Already initialized');
      return;
    }

    try {
      // Initialize SDK
      this.sdk = new ShoprocketCore({
        publicKey,
        ...options
      });

      // Create session
      const session = await this.sdk.session.create();
      this.sdk.setSessionToken(session.session?.session_token || session.session_token);

      // Get store info
      const store = await this.sdk.getStore();
      console.log('Shoprocket: Initialized for store:', store.name);

      this.initialized = true;

      // Auto-render any containers already in DOM
      this.autoRender();
    } catch (error) {
      console.error('Shoprocket: Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Render products in a container
   */
  async renderProducts(containerId, options = {}) {
    if (!this.initialized) {
      throw new Error('Shoprocket: Not initialized. Call init() first.');
    }

    const container = document.getElementById(containerId);
    if (!container) {
      throw new Error(`Shoprocket: Container #${containerId} not found`);
    }

    // Show loading
    container.innerHTML = '<div class="sr-loading">Loading products...</div>';

    try {
      // Fetch products
      const response = await this.sdk.products.list({
        per_page: options.limit || 12,
        ...options.filters
      });

      // Render products
      container.innerHTML = `
        <div class="sr-products">
          ${response.data.map(product => `
            <div class="sr-product" data-product-id="${product.id}">
              ${product.media?.[0] ? `
                <img src="${product.media[0].url}" alt="${product.name}" class="sr-product-image">
              ` : ''}
              <h3 class="sr-product-name">${product.name}</h3>
              <p class="sr-product-price">${this.formatPrice(product.price)}</p>
              <button class="sr-add-to-cart" data-product-id="${product.id}">
                Add to Cart
              </button>
            </div>
          `).join('')}
        </div>
      `;

      // Attach event listeners
      container.querySelectorAll('.sr-add-to-cart').forEach(button => {
        button.addEventListener('click', (e) => {
          const productId = e.target.dataset.productId;
          this.addToCart(productId);
        });
      });

      this.containers.set(containerId, { type: 'products', options });
    } catch (error) {
      container.innerHTML = `<div class="sr-error">Failed to load products</div>`;
      console.error('Shoprocket: Failed to load products:', error);
    }
  }

  /**
   * Add a product to cart
   */
  async addToCart(productId, quantity = 1) {
    if (!this.initialized) {
      throw new Error('Shoprocket: Not initialized');
    }

    try {
      await this.sdk.cart.addItem(productId, quantity);
      
      // Show success message
      this.showToast('Added to cart!');
      
      // Trigger cart update event
      window.dispatchEvent(new CustomEvent('shoprocket:cart:updated'));
    } catch (error) {
      console.error('Shoprocket: Failed to add to cart:', error);
      this.showToast('Failed to add to cart', 'error');
    }
  }

  /**
   * Show a toast notification
   */
  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `sr-toast sr-toast-${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    setTimeout(() => toast.classList.add('sr-toast-show'), 10);

    // Remove after 3 seconds
    setTimeout(() => {
      toast.classList.remove('sr-toast-show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Format price for display
   */
  formatPrice(price) {
    if (typeof price === 'object' && price !== null) {
      // Handle nested price object
      const cents = price.amount || price.amount_cents || 0;
      return `$${(cents / 100).toFixed(2)}`;
    }
    // Direct cents value
    return `$${(price / 100).toFixed(2)}`;
  }

  /**
   * Auto-render containers marked with data attributes
   */
  autoRender() {
    // Find all containers with data-shoprocket attribute
    document.querySelectorAll('[data-shoprocket]').forEach(container => {
      const type = container.dataset.shoprocket;
      const containerId = container.id || `sr-auto-${Math.random().toString(36).substr(2, 9)}`;
      
      if (!container.id) {
        container.id = containerId;
      }

      switch (type) {
        case 'products':
          this.renderProducts(containerId);
          break;
        // Add more types as needed (cart, checkout, etc.)
        default:
          console.warn(`Shoprocket: Unknown container type: ${type}`);
      }
    });
  }
}

// Create global instance
const shoprocket = new ShoprocketWidget();

// Expose to window
window.Shoprocket = shoprocket;

// Auto-initialize if config is provided
if (window.ShoprocketConfig) {
  shoprocket.init(window.ShoprocketConfig.publicKey, window.ShoprocketConfig);
}