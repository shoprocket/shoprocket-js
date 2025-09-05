import { useShoprocketContext } from '../contexts/ShoprocketContext';

/**
 * Hook to access the Shoprocket SDK instance
 */
export function useShoprocket() {
  const { sdk, initialized, error } = useShoprocketContext();
  
  if (!initialized || !sdk) {
    return {
      sdk: null,
      initialized: false,
      error: error || new Error('Shoprocket not initialized')
    };
  }
  
  return {
    sdk,
    initialized: true,
    error: null
  };
}