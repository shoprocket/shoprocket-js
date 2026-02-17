import { ApiClient } from '../api';

export interface PlacePrediction {
  placeId: string;
  mainText: string;
  secondaryText: string;
}

export interface PlaceDetails {
  line1: string;
  line2: string;
  city: string;
  stateCode: string;
  countryCode: string;
  postalCode: string;
}

interface AutocompleteResponse {
  data: {
    predictions: PlacePrediction[];
  };
}

interface DetailsResponse {
  data: PlaceDetails;
}

/**
 * Places Service
 * Handles Google Places address autocomplete via server proxy
 */
export class PlacesService {
  constructor(private api: ApiClient) {}

  /**
   * Search for address suggestions
   */
  async autocomplete(
    query: string,
    sessionToken: string,
    country?: string,
    options?: { signal?: AbortSignal }
  ): Promise<PlacePrediction[]> {
    let endpoint = `/places/autocomplete?query=${encodeURIComponent(query)}&sessionToken=${encodeURIComponent(sessionToken)}`;
    if (country) {
      endpoint += `&country=${encodeURIComponent(country)}`;
    }
    const response = await this.api.get<AutocompleteResponse>(endpoint, options);
    return response.data.predictions;
  }

  /**
   * Get full parsed address for a place
   */
  async details(placeId: string, sessionToken: string): Promise<PlaceDetails> {
    const endpoint = `/places/details?placeId=${encodeURIComponent(placeId)}&sessionToken=${encodeURIComponent(sessionToken)}`;
    const response = await this.api.get<DetailsResponse>(endpoint);
    return response.data;
  }
}
