import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TokenVerifier } from 'livekit-server-sdk';
import { LiveKitTokenService, LIVEKIT_TOKEN_TTL_SECONDS } from './livekit-token.service.js';

test('LiveKit token is signed, short-lived, opaque and limited to one call room', async () => {
  const apiKey = 'test-livekit-api-key';
  const apiSecret = 'test-livekit-secret-that-is-long-enough-for-signing';
  const service = new LiveKitTokenService({
    url: 'wss://example.livekit.cloud',
    apiKey,
    apiSecret,
  });
  const issued = await service.createParticipantToken({
    callId: 'call-private-id',
    roomName: 'landconnect-call-private-id',
    userId: 'user-private-id',
  });
  const claims = await new TokenVerifier(apiKey, apiSecret).verify(issued.token);

  assert.equal(issued.url, 'wss://example.livekit.cloud');
  assert.equal(issued.expiresInSeconds, LIVEKIT_TOKEN_TTL_SECONDS);
  assert.equal(claims.video?.roomJoin, true);
  assert.equal(claims.video?.room, 'landconnect-call-private-id');
  assert.equal(claims.video?.canPublish, true);
  assert.equal(claims.video?.canSubscribe, true);
  assert.equal(claims.video?.canPublishData, false);
  assert.notEqual(claims.sub, 'user-private-id');
});
