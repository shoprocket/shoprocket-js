/**
 * SDK Context
 * Provides Shoprocket SDK instance to all child components via Lit Context API
 * This eliminates the need to pass .sdk="${this.sdk}" as a prop everywhere
 */
import { createContext } from '@lit/context';
import type { ShoprocketCore } from '@shoprocket/core';

export const sdkContext = createContext<ShoprocketCore>(Symbol('shoprocket-sdk'));