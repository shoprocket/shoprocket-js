import { ApiClient } from '../api';
import type { Session, CreateSessionData } from '../types';

// Re-export types for backward compatibility
export type { Session, CreateSessionData } from '../types';

export class SessionService {
  constructor(private api: ApiClient) {}

  async create(data?: CreateSessionData): Promise<Session> {
    const sessionData = {
      userAgent: data?.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      entryPage: data?.entryPage || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      referrer: data?.referrer || (typeof document !== 'undefined' ? document.referrer : undefined),
      ...data
    };

    const response = await this.api.post<any>('/session', sessionData);

    // Handle different response structures
    const session = (response as any).session || response.data || response;
    const token = session?.sessionToken || session?.token || session?.id;

    if (!token) {
      throw new Error('No session token in response');
    }

    return {
      id: session.id,
      sessionToken: token,
      visitorId: session.visitorId,
      locale: session.locale
    };
  }
}