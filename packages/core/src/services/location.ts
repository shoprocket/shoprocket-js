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
   * @param locale - Language code for country name translations
   * @param shippable - When true, only returns countries the store ships to
   */
  async getCountries(locale = 'en', shippable = false): Promise<CountriesResponse> {
    const params = new URLSearchParams({ locale });
    if (shippable) params.set('shippable', '1');
    return this.api.get<CountriesResponse>(`/countries?${params.toString()}`);
  }

  /**
   * Get list of states/provinces for a specific country
   */
  async getStates(countryCode: string): Promise<StatesResponse> {
    return this.api.get<StatesResponse>(`/countries/${countryCode}/states`);
  }
}