import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ShoprocketCore, ShoprocketConfig } from '@shoprocket/core';

interface ShoprocketContextValue {
  sdk: ShoprocketCore | null;
  initialized: boolean;
  error: Error | null;
}

const ShoprocketContext = createContext<ShoprocketContextValue>({
  sdk: null,
  initialized: false,
  error: null,
});

interface ShoprocketProviderProps extends ShoprocketConfig {
  children: ReactNode;
  onInitialized?: () => void;
  onError?: (error: Error) => void;
}

export function ShoprocketProvider({ 
  children, 
  publicKey,
  apiUrl,
  locale = 'en',
  onInitialized,
  onError,
  ...config 
}: ShoprocketProviderProps) {
  const [sdk, setSdk] = useState<ShoprocketCore | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const initializeSdk = async () => {
      try {
        // Create SDK instance
        const shoprocketSdk = new ShoprocketCore({
          publicKey,
          apiUrl,
          locale,
          ...config
        });

        // Create session
        const session = await shoprocketSdk.session.create();
        shoprocketSdk.setSessionToken(
          session.session?.session_token || session.session_token
        );

        setSdk(shoprocketSdk);
        setInitialized(true);
        onInitialized?.();
      } catch (err) {
        const error = err as Error;
        setError(error);
        onError?.(error);
        console.error('Shoprocket: Initialization failed', error);
      }
    };

    initializeSdk();
  }, [publicKey]); // Only reinitialize if publicKey changes

  return (
    <ShoprocketContext.Provider value={{ sdk, initialized, error }}>
      {children}
    </ShoprocketContext.Provider>
  );
}

export function useShoprocketContext() {
  const context = useContext(ShoprocketContext);
  if (!context) {
    throw new Error('useShoprocketContext must be used within ShoprocketProvider');
  }
  return context;
}