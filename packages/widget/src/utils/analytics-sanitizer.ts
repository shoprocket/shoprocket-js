/**
 * Analytics Data Sanitizer
 * Strips data to essential fields for analytics tracking
 * Based on Google Analytics 4 and industry standards
 */

export class AnalyticsSanitizer {
  /**
   * Extract price in cents and currency from Money object
   */
  private static extractPrice(data: any): { price_cents: number; currency?: string } {
    // Money object from API - the ONLY format we support
    if (data?.price?.amount !== undefined) {
      return { 
        price_cents: data.price.amount,
        currency: data.price.currency
      };
    }
    
    return { price_cents: 0 };
  }

  /**
   * Sanitize product data for analytics
   */
  static sanitizeProduct(product: any): any {
    if (!product) return null;
    
    const { price_cents, currency } = this.extractPrice(product);
    
    return {
      item_id: product.id || product.item_id,
      item_name: product.name || product.item_name || product.title,
      price_cents,
      currency,
      category: product.category?.name || product.category || undefined,
      brand: product.brand || undefined,
      variant: product.variant_name || product.variant_id || undefined
    };
  }

  /**
   * Sanitize cart item for analytics
   */
  static sanitizeCartItem(item: any): any {
    if (!item) return null;

    const { price_cents, currency } = this.extractPrice(item);

    return {
      item_id: item.productId || item.id,
      item_name: item.productName || item.name,
      price_cents,
      currency,
      quantity: item.quantity || 1,
      variant: item.variantName || item.variantId || undefined
    };
  }

  /**
   * Extract total value from cart/order objects
   */
  private static extractTotal(data: any): { value_cents: number; currency?: string } {
    // Try various total locations (all Money objects)
    const totalObj = data?.totals?.total || data?.total;
    
    if (totalObj?.amount !== undefined) {
      return {
        value_cents: totalObj.amount,
        currency: totalObj.currency
      };
    }
    
    return { value_cents: 0 };
  }

  /**
   * Sanitize entire cart for analytics
   */
  static sanitizeCart(cart: any): any {
    if (!cart) return null;

    const { value_cents, currency } = this.extractTotal(cart);

    return {
      cart_id: cart.id,
      currency,
      value_cents,
      item_count: cart.itemCount || cart.items?.length || 0
      // Don't include items unless specifically needed
    };
  }

  /**
   * Sanitize view_item_list event
   */
  static sanitizeItemList(items: any[], listName?: string): any {
    if (!items || !Array.isArray(items)) return null;
    
    return {
      item_list_name: listName || 'Product List',
      item_count: items.length,
      // Only include first 5 items with minimal data
      items: items.slice(0, 5).map((item, index) => ({
        item_id: item.id,
        item_name: item.name || item.title,
        price_cents: this.extractPrice(item).price_cents,
        index
      }))
    };
  }

  /**
   * Sanitize order/purchase event
   */
  static sanitizeOrder(order: any): any {
    if (!order) return null;
    
    const { value_cents, currency } = this.extractTotal(order);
    
    // Extract tax and shipping from Money objects
    const tax_cents = order.tax?.amount ?? 0;
    const shipping_cents = order.shipping?.amount ?? 0;
    
    return {
      transaction_id: order.id || order.order_number,
      value_cents,
      tax_cents,
      shipping_cents,
      currency,
      items: order.items?.map((item: any) => this.sanitizeCartItem(item)) || []
    };
  }

  /**
   * Generic event data sanitizer
   */
  static sanitizeEventData(eventName: string, data: any): any {
    switch (eventName) {
      case 'view_item':
      case 'select_item':
        return this.sanitizeProduct(data);
      
      case 'view_item_list':
        return this.sanitizeItemList(data.items, data.item_list_name);
      
      case 'add_to_cart':
      case 'remove_from_cart':
        return this.sanitizeCartItem(data);
      
      case 'view_cart':
      case 'begin_checkout':
      case 'cart_opened':
      case 'cart_closed':
        return this.sanitizeCart(data);
      
      case 'purchase':
      case 'order_completed':
        return this.sanitizeOrder(data);
      
      default:
        // For unknown events, extract what we can
        const total = this.extractTotal(data);
        return {
          value_cents: total.value_cents || undefined,
          currency: total.currency,
          item_id: data?.id || data?.product_id || undefined
        };
    }
  }
}