import { useState, useEffect, useCallback } from 'react';
import { useShoprocket } from './useShoprocket';
import type { Cart } from '@shoprocket/core';

export function useCart() {
  const { sdk, initialized } = useShoprocket();
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [updating, setUpdating] = useState(false);

  // Fetch cart
  const fetchCart = useCallback(async () => {
    if (!sdk) return;
    
    try {
      setLoading(true);
      const response = await sdk.cart.get();
      setCart(response);
    } catch (err) {
      setError(err as Error);
      console.error('Failed to fetch cart:', err);
    } finally {
      setLoading(false);
    }
  }, [sdk]);

  // Initial load
  useEffect(() => {
    if (initialized && sdk) {
      fetchCart();
    }
  }, [initialized, sdk, fetchCart]);

  // Add item to cart
  const addItem = useCallback(async (
    productId: string, 
    quantity: number = 1, 
    variantId?: string
  ) => {
    if (!sdk) return;
    
    try {
      setUpdating(true);
      await sdk.cart.addItem({ productId, quantity, variantId });
      await fetchCart(); // Refresh cart
      
      // Dispatch custom event for other components
      window.dispatchEvent(new CustomEvent('shoprocket:cart:updated'));
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [sdk, fetchCart]);

  // Update item quantity
  const updateItem = useCallback(async (itemId: string, quantity: number) => {
    if (!sdk) return;
    
    try {
      setUpdating(true);
      await sdk.cart.updateItem(itemId, quantity);
      await fetchCart();
      
      window.dispatchEvent(new CustomEvent('shoprocket:cart:updated'));
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [sdk, fetchCart]);

  // Remove item from cart
  const removeItem = useCallback(async (itemId: string) => {
    if (!sdk) return;
    
    try {
      setUpdating(true);
      await sdk.cart.removeItem(itemId);
      await fetchCart();
      
      window.dispatchEvent(new CustomEvent('shoprocket:cart:updated'));
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, [sdk, fetchCart]);

  // Listen for cart updates from other components
  useEffect(() => {
    const handleCartUpdate = () => {
      fetchCart();
    };
    
    window.addEventListener('shoprocket:cart:updated', handleCartUpdate);
    return () => {
      window.removeEventListener('shoprocket:cart:updated', handleCartUpdate);
    };
  }, [fetchCart]);

  return {
    cart,
    loading,
    error,
    updating,
    addItem,
    updateItem,
    removeItem,
    refetch: fetchCart
  };
}