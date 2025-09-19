import { ApiClient } from '../api';

export interface Country {
  code: string;
  name: string;
  phone_code?: string;
  currency?: string;
}

export interface State {
  code: string;
  name: string;
}

export interface CountriesResponse {
  success: boolean;
  data: {
    countries: Country[];
    locale: string;
  };
}

export interface StatesResponse {
  success: boolean;
  data: {
    country: {
      code: string;
      name: string;
    };
    states: State[];
  };
}

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