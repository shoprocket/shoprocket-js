import { ApiClient } from '../api';
import type { ReviewsResponse, SubmitReviewParams } from '../types';

export type { ReviewsResponse, SubmitReviewParams } from '../types';

export class ReviewsService {
  constructor(private api: ApiClient) {}

  async list(productId: string, page?: number): Promise<ReviewsResponse> {
    const params = page ? `?page=${page}` : '';
    return this.api.get<ReviewsResponse>(`/products/${productId}/reviews${params}`);
  }

  async submit(productId: string, params: SubmitReviewParams): Promise<any> {
    return this.api.post(`/products/${productId}/reviews`, params);
  }
}
