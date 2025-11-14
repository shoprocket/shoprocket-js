import { useState, useEffect } from 'react';
import { useShoprocket } from './useShoprocket';

interface UseProductsOptions {
  page?: number;
  perPage?: number;
  sort?: string;
  filters?: Record<string, any>;
}

export function useProducts(options: UseProductsOptions = {}) {
  const { sdk, initialized } = useShoprocket();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [meta, setMeta] = useState<any>(null);

  useEffect(() => {
    if (!initialized || !sdk) {
      return;
    }

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const response = await sdk.products.list({
          page: options.page || 1,
          perPage: options.perPage || 12,
          sort: options.sort,
          ...options.filters
        });
        
        setProducts(response.data || []);
        setMeta(response.meta || {});
      } catch (err) {
        setError(err as Error);
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [initialized, sdk, options.page, options.perPage, options.sort]);

  return {
    products,
    loading,
    error,
    meta,
    refetch: () => {
      if (sdk) {
        setLoading(true);
        // Trigger re-fetch by updating a dependency
      }
    }
  };
}