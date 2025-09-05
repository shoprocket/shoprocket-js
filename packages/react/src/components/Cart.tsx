import React from 'react';
import { useCart } from '../hooks/useCart';

interface CartProps {
  className?: string;
}

export function Cart({ className = '' }: CartProps) {
  const { cart, loading, updateItem, removeItem } = useCart();

  if (loading) {
    return <div className={className}>Loading cart...</div>;
  }

  if (!cart || !cart.items?.length) {
    return <div className={className}>Your cart is empty</div>;
  }

  return (
    <div className={className}>
      {cart.items.map((item: any) => (
        <div key={item.id}>
          <h4>{item.product_name}</h4>
          <p>Quantity: {item.quantity}</p>
          <p>Price: ${(item.price / 100).toFixed(2)}</p>
          <button onClick={() => updateItem(item.id, item.quantity - 1)}>-</button>
          <button onClick={() => updateItem(item.id, item.quantity + 1)}>+</button>
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      <div>
        <strong>Total: ${((cart.totals?.total || 0) / 100).toFixed(2)}</strong>
      </div>
    </div>
  );
}