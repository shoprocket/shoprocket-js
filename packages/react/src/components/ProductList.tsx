import React from 'react';
import { useProducts } from '../hooks/useProducts';

interface ProductListProps {
  perPage?: number;
  className?: string;
  renderProduct?: (product: any) => React.ReactNode;
  onProductClick?: (product: any) => void;
}

export function ProductList({ 
  perPage = 12, 
  className = '',
  renderProduct,
  onProductClick 
}: ProductListProps) {
  const { products, loading, error } = useProducts({ perPage });

  if (loading) {
    return <div className={className}>Loading products...</div>;
  }

  if (error) {
    return <div className={className}>Error loading products: {error.message}</div>;
  }

  if (!products.length) {
    return <div className={className}>No products found</div>;
  }

  return (
    <div className={className}>
      {products.map(product => 
        renderProduct ? (
          renderProduct(product)
        ) : (
          <div 
            key={product.id} 
            onClick={() => onProductClick?.(product)}
            style={{ cursor: onProductClick ? 'pointer' : 'default' }}
          >
            {product.media?.[0] && (
              <img 
                src={product.media[0].url} 
                alt={product.name}
                style={{ width: '100%', height: 'auto' }}
              />
            )}
            <h3>{product.name}</h3>
            <p>${((product.price?.amount || product.price) / 100).toFixed(2)}</p>
          </div>
        )
      )}
    </div>
  );
}