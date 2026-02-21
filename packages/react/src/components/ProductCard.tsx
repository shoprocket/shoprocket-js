interface ProductCardProps {
  product: any;
  onAddToCart?: (product: any) => void;
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  return (
    <div>
      {/* TODO: Implement ProductCard */}
      <h3>{product.name}</h3>
      <button onClick={() => onAddToCart?.(product)}>Add to Cart</button>
    </div>
  );
}