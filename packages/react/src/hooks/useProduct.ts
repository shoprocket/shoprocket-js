import { useState, useEffect } from 'react';
import { useShoprocket } from './useShoprocket';

export function useProduct(productId: string) {
  const { sdk, initialized } = useShoprocket();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!initialized || !sdk || !productId) {
      return;
    }

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await sdk.products.get(productId);
        setProduct(response.data || response);
      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [initialized, sdk, productId]);

  return {
    product,
    loading,
    error
  };
}