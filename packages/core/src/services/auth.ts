/**
 * Authentication Service
 */

import { ApiClient } from '../api';

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user?: {
    id: string;
    email: string;
    name?: string;
  };
}

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