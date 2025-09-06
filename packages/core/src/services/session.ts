import { ApiClient } from '../api';

export interface Session {
  id: string;
  session_token: string;
  visitor_id: string;
  locale?: string;
}

export interface CreateSessionData {
  user_agent?: string;
  entry_page?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_term?: string;
  utm_content?: string;
}

export class SessionService {
  constructor(private api: ApiClient) {}

  async create(data?: CreateSessionData): Promise<Session> {
    const sessionData = {
      user_agent: data?.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
      entry_page: data?.entry_page || (typeof window !== 'undefined' ? window.location.pathname : undefined),
      referrer: data?.referrer || (typeof document !== 'undefined' ? document.referrer : undefined),
      ...data
    };

    const response = await this.api.post<any>('/session', sessionData);
    
    // Handle different response structures
    const session = (response as any).session || response.data || response;
    const token = session?.session_token || session?.token || session?.id;
    
    if (!token) {
      throw new Error('No session token in response');
    }

    return {
      id: session.id,
      session_token: token,
      visitor_id: session.visitor_id,
      locale: session.locale
    };
  }
}