import { createHash } from 'node:crypto';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { AppError } from '../../lib/app-error.js';

export const LIVEKIT_TOKEN_TTL_SECONDS = 10 * 60;

export interface LiveKitTokenConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
}

export interface CallTokenServicePort {
  createParticipantToken(input: {
    callId: string;
    roomName: string;
    userId: string;
  }): Promise<{ url: string; token: string; expiresInSeconds: number }>;
  deleteRoom(roomName: string): Promise<void>;
}

export class LiveKitTokenService implements CallTokenServicePort {
  constructor(private readonly config: LiveKitTokenConfig) {}

  async createParticipantToken(input: {
    callId: string;
    roomName: string;
    userId: string;
  }): Promise<{ url: string; token: string; expiresInSeconds: number }> {
    if (!this.config.apiKey || !this.config.apiSecret || !this.config.url) {
      throw new AppError(503, 'CALLS_UNAVAILABLE', 'Calling is temporarily unavailable.');
    }

    const identity = createHash('sha256')
      .update(`landconnect-call:${input.callId}:${input.userId}`)
      .digest('hex')
      .slice(0, 32);
    const token = new AccessToken(this.config.apiKey, this.config.apiSecret, {
      identity,
      ttl: LIVEKIT_TOKEN_TTL_SECONDS,
    });
    token.addGrant({
      roomJoin: true,
      room: input.roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: false,
    });

    return {
      url: this.config.url,
      token: await token.toJwt(),
      expiresInSeconds: LIVEKIT_TOKEN_TTL_SECONDS,
    };
  }

  async deleteRoom(roomName: string): Promise<void> {
    const apiUrl = this.config.url.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    await new RoomServiceClient(apiUrl, this.config.apiKey, this.config.apiSecret).deleteRoom(
      roomName,
    );
  }
}
