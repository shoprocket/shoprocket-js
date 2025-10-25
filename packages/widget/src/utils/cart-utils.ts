/**
 * Cart utility functions
 * Centralized cart-related logic used across components
 */

/**
 * Check if all available stock for a product/variant is already in cart
 * @param productId - The product ID to check
 * @param variantId - The variant ID to check (optional)
 * @param totalInventory - The total available inventory
 * @returns Object with allInCart flag and quantity in cart
 */
export function isAllStockInCart(
  productId: string,
  variantId?: string,
  totalInventory?: number | null
): { allInCart: boolean; quantityInCart: number } {
  const cart = (window as any).Shoprocket?.cart?.get?.();

  if (!cart || totalInventory === undefined || totalInventory === null) {
    return { allInCart: false, quantityInCart: 0 };
  }

  const cartItem = cart.items?.find((item: any) =>
    item.productId === productId &&
    item.variantId === variantId
  );

  const quantityInCart = cartItem?.quantity || 0;
  return {
    allInCart: quantityInCart >= totalInventory,
    quantityInCart
  };
}

/**
 * Get the current quantity of a product/variant in cart
 * @param productId - The product ID to check
 * @param variantId - The variant ID to check (optional)
 * @returns The quantity in cart, or 0 if not found
 */
export function getQuantityInCart(
  productId: string,
  variantId?: string
): number {
  const cart = (window as any).Shoprocket?.cart?.get?.();
  if (!cart) return 0;
  
  const cartItem = cart.items?.find((item: any) =>
    item.productId === productId &&
    item.variantId === variantId
  );
  
  return cartItem?.quantity || 0;
}