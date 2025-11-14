/**
 * Authentication Service
 */

import { ApiClient } from '../api';
import type { LoginRequest, RegisterRequest, AuthResponse } from '../types';

// Re-export types for backward compatibility
export type { LoginRequest, RegisterRequest, AuthResponse } from '../types';

export class AuthService {
  constructor(private api: ApiClient) {}

  /**
   * Login with email and password
   */
  async login(credentials: LoginRequest): Promise<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/login', credentials);
  }

  /**
   * Register a new user
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/register', data);
  }

  /**
   * Logout (server-side session cleanup)
   */
  async logout(): Promise<void> {
    return this.api.post('/auth/logout');
  }

  /**
   * Get current user
   */
  async me(): Promise<any> {
    return this.api.get('/auth/me');
  }

  /**
   * Refresh token
   */
  async refresh(): Promise<AuthResponse> {
    return this.api.post<AuthResponse>('/auth/refresh');
  }
}