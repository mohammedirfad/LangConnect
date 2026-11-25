import { apiClient } from '../api/client';

export type CallType = 'AUDIO' | 'VIDEO';
export type CallStatus = 'RINGING' | 'ACCEPTED' | 'REJECTED' | 'MISSED' | 'ENDED';

export interface CallDto {
  id: string;
  callerId: string;
  calleeId: string;
  roomName: string;
  type: CallType;
  status: CallStatus;
  startedAt: string;
  acceptedAt: string | null;
  endedAt: string | null;
}

export interface CallJoinResponse {
  call: CallDto;
  livekit: { url: string; token: string; expiresInSeconds: number };
}

export const callsApi = {
  async create(input: { calleeId: string; type: CallType }): Promise<{ call: CallDto }> {
    const response = await apiClient.post<{ call: CallDto }>('/calls', input);
    return response.data;
  },
  async status(callId: string): Promise<{ call: CallDto }> {
    const response = await apiClient.get<{ call: CallDto }>(`/calls/${callId}`);
    return response.data;
  },
  async join(callId: string): Promise<CallJoinResponse> {
    const response = await apiClient.post<CallJoinResponse>(`/calls/${callId}/join`);
    return response.data;
  },
  async end(callId: string): Promise<void> {
    await apiClient.post(`/calls/${callId}/end`);
  },
};
