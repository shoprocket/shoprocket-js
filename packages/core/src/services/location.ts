import { ApiClient } from '../api';
import type { Country, State, CountriesResponse, StatesResponse } from '../types';

// Re-export types for backward compatibility
export type { Country, State, CountriesResponse, StatesResponse } from '../types';

/**
 * Location Service
 * Handles countries and states/provinces data
 */
export class LocationService {
  constructor(private api: ApiClient) {}

  /**
   * Get list of countries with optional locale for translations
   */
  async getCountries(locale = 'en'): Promise<CountriesResponse> {
    const endpoint = `/countries?locale=${encodeURIComponent(locale)}`;
    return this.api.get<CountriesResponse>(endpoint);
  }

  /**
   * Get list of states/provinces for a specific country
   */
  async getStates(countryCode: string): Promise<StatesResponse> {
    return this.api.get<StatesResponse>(`/countries/${countryCode}/states`);
  }
}