import type { ApiClient } from '../api';

export interface EventData {
  event: string;
  timestamp?: number;
  store_id?: string;
  context?: {
    page_url?: string;
    page_title?: string;
    referrer?: string;
    user_agent?: string;
    screen_resolution?: string;
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_term?: string;
    utm_content?: string;
    affiliate_id?: string;
    session_id?: string;
    widget_version?: string;
  };
  properties?: Record<string, any>;
  ecommerce?: {
    currency?: string;
    value?: number;
    items?: Array<{
      item_id: string;
      item_name: string;
      price?: number;
      quantity?: number;
      item_category?: string;
      item_category2?: string;
      item_category3?: string;
      item_brand?: string;
      item_variant?: string;
      index?: number;
      discount?: number;
    }>;
    transaction_id?: string;
    shipping?: number;
    tax?: number;
    coupon?: string;
  };
}

export interface EventResponse {
  event_id: string;
}

export class EventsService {
  constructor(private api: ApiClient) {}

  /**
   * Track a single event
   */
  async track(eventData: EventData): Promise<EventResponse> {
    // Ensure timestamp is set
    if (!eventData.timestamp) {
      eventData.timestamp = Date.now();
    }

    // Construct URL using publishable key
    const publishableKey = this.api.getPublishableKey();
    const url = `${this.api.getApiUrl()}/public/${publishableKey}/events`;
    navigator.sendBeacon(url, JSON.stringify(eventData));
    
    // Return dummy response (sendBeacon doesn't provide one)
    return { event_id: 'beacon-' + Date.now() };
  }

  /**
   * Track multiple events in a batch
   */
  async trackBatch(events: EventData[]): Promise<EventResponse[]> {
    // Ensure all events have timestamps
    const eventsWithTimestamps = events.map(event => ({
      ...event,
      timestamp: event.timestamp || Date.now()
    }));

    const response = await this.api.post<{ events: EventResponse[] }>('/events/batch', {
      events: eventsWithTimestamps
    });
    
    return response.events;
  }
}