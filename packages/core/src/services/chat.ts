import { ApiClient } from '../api';

export interface Conversation {
  id: string;
  status: 'open' | 'pending' | 'closed';
  unread_count: number;
}

export interface CurrentConversationResult {
  teamOnline: boolean;
  conversation: Conversation | null;
}

export interface ApiChatMessageSender {
  name: string;
  avatar_url: string | null;
}

export interface ApiChatMessage {
  id: string;
  sender_type: 'customer' | 'seller';
  sender: ApiChatMessageSender | null;
  original: { content: string; locale: string };
  translation: { content: string; locale: string } | null;
  is_read: boolean;
  created_at: string;
}

export interface GetMessagesResult {
  messages: ApiChatMessage[];
  status: 'open' | 'pending' | 'closed';
  teamOnline: boolean;
  hasMore: boolean;
}

export interface CreateConversationOptions {
  locale?: string;
  email?: string;
  subject?: string;
}

export class ChatService {
  constructor(private api: ApiClient) {}

  async getCurrent(): Promise<CurrentConversationResult> {
    const response = await this.api.get<any>('/conversations/current');
    const data = response.data ?? null;
    const teamOnline = data?.team_online ?? false;
    const conv = data?.conversation ?? null;
    const conversation = conv ? {
      id: conv.conversation_id ?? conv.id,
      status: conv.status ?? 'open',
      unread_count: conv.unread_count ?? 0,
    } : null;
    return { teamOnline, conversation };
  }

  async getMessages(conversationId: string, beforeId?: string): Promise<GetMessagesResult> {
    const endpoint = beforeId
      ? `/conversations/${conversationId}/messages?before=${encodeURIComponent(beforeId)}`
      : `/conversations/${conversationId}/messages`;
    const response = await this.api.get<any>(endpoint);
    const data = response.data ?? {};
    return {
      messages: data.messages ?? [],
      status: data.status ?? 'open',
      teamOnline: data.team_online ?? false,
      hasMore: data.has_more ?? false,
    };
  }

  async create(content: string, options: CreateConversationOptions = {}): Promise<{ conversationId: string; message: ApiChatMessage }> {
    const body: any = { message: content };
    if (options.locale) body.locale = options.locale;
    if (options.email) body.email = options.email;
    if (options.subject) body.subject = options.subject;

    const response = await this.api.post<any>('/conversations', body);
    const data = response.data || response;
    const id = data.conversation_id ?? data.conversation?.id ?? data.id;
    if (!id) throw new Error('No conversation_id in response');
    return { conversationId: id, message: data.message };
  }

  async sendMessage(conversationId: string, content: string): Promise<ApiChatMessage> {
    const response = await this.api.post<any>(`/conversations/${conversationId}/messages`, { message: content });
    return response.data?.message || response.data || response;
  }

  async sendTyping(conversationId: string): Promise<void> {
    await this.api.post(`/conversations/${conversationId}/typing`);
  }

  async updateEmail(conversationId: string, email: string): Promise<void> {
    await this.api.post(`/conversations/${conversationId}/email`, { email });
  }
}
