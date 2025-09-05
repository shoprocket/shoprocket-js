import React from 'react';
import { useCart } from '../hooks/useCart';

interface AddToCartButtonProps {
  productId: string;
  variantId?: string;
  quantity?: number;
  className?: string;
  children?: React.ReactNode;
}

export function AddToCartButton({ 
  productId, 
  variantId,
  quantity = 1,
  className = '',
  children = 'Add to Cart'
}: AddToCartButtonProps) {
  const { addItem, updating } = useCart();

  const handleClick = async () => {
    try {
      await addItem(productId, quantity, variantId);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  return (
    <button 
      onClick={handleClick} 
      disabled={updating}
      className={className}
    >
      {updating ? 'Adding...' : children}
    </button>
  );
}