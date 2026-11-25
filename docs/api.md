# API outline

The API listens on port 4000 by default. `GET /health` is the liveness endpoint. Auth endpoints are prefixed with `/api/v1/auth`.

## Interactive API docs

With the API running, open `http://localhost:4000/docs` for Swagger UI or `http://localhost:4000/openapi.json` for the OpenAPI document. Swagger UI assets load from the pinned Swagger UI CDN release, so the interactive page needs internet access; the OpenAPI JSON endpoint is served locally and can be imported into Postman or another API client. Use a local development account for requests that create data. Registration and login return an access token; use the Swagger **Authorize** button to try `GET /api/v1/auth/me`.

`GET /ready` checks both the API and the PostgreSQL connection. It returns `503` with a safe error message if Postgres cannot be reached. `GET /health` only confirms the API process is alive.

## Authentication

All authentication request bodies are validated with Zod. Registration normalizes email to lowercase, accepts `BUYER`, `SELLER`, or `BROKER`, and requires a 12–128 character password. Responses are explicit auth DTOs and never include a password hash or phone number.

| Method | Route                   | Auth                | Purpose                                                         |
| ------ | ----------------------- | ------------------- | --------------------------------------------------------------- |
| POST   | `/api/v1/auth/register` | No                  | Create an account and return the initial session.               |
| POST   | `/api/v1/auth/login`    | No                  | Verify credentials and create a refresh-token family.           |
| POST   | `/api/v1/auth/refresh`  | No                  | Rotate a refresh token and return a new 15-minute access token. |
| POST   | `/api/v1/auth/logout`   | No                  | Revoke the submitted refresh token.                             |
| GET    | `/api/v1/auth/me`       | Bearer access token | Return the authenticated user's private profile DTO.            |

Login and registration use per-IP rate limits. Refresh and logout have separate limits. Refresh tokens are opaque, high-entropy values; only SHA-256 hashes are stored in PostgreSQL. Reuse of a revoked token revokes its active token family. Access tokens are signed with HS256 and checked for issuer, audience, expiry, and role claims.

The reusable `authenticate` pre-handler validates access-token identity. `requireRole('SELLER', 'BROKER')` is available for seller/broker-only operations. Ownership checks will be added with listing endpoints.

## Direct calls (Phases 2–3)

The REST call routes remain available for status checks and recovery. `POST /api/v1/calls` accepts `{ "calleeId": "<user UUID>", "type": "AUDIO" | "VIDEO" }`; `GET /api/v1/calls/{callId}` is participant-only; `POST /api/v1/calls/{callId}/join` issues a participant-scoped LiveKit token after acceptance; and `POST /api/v1/calls/{callId}/end` ends the call. Every route requires a bearer access token and has a route-specific rate limit.

`GET /api/v1/calls/active` returns only the authenticated user's current `RINGING` or `ACCEPTED` call, or `{ "call": null }`. Mobile clients use it after reconnecting so a brief network drop does not lose an incoming ring or accepted call.

Socket.IO is attached to the API origin. Authenticate the handshake with `auth: { token: "<15-minute access token>" }`. The server validates the JWT signature, issuer, audience, expiry, and role, then joins that socket to a server-chosen per-user room. Clients must not choose room names or user IDs for event routing. Call event input is Zod-validated, payload size is bounded, and call actions are limited per user.

| Client event  | Payload              | Acknowledgement / effect                                                                                                                 |
| ------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `call:invite` | `{ calleeId, type }` | Creates a `RINGING` record, acknowledges `{ ok: true, data: { call } }`, and sends `call:incoming` to the callee.                        |
| `call:accept` | `{ callId }`         | Only the callee can accept. Acknowledges the callee's LiveKit session and sends `call:accepted` with the caller's session to the caller. |
| `call:reject` | `{ callId }`         | Only the callee can reject a ringing call; emits `call:rejected` to the caller and stores `REJECTED`.                                    |
| `call:end`    | `{ callId }`         | Either participant may end a live/ringing call; emits `call:ended` to the other participant and stores `ENDED`.                          |

Server events `call:incoming`, `call:accepted`, `call:rejected`, `call:missed`, and `call:ended` contain only the call DTO and, on acceptance, the relevant participant's LiveKit token. Errors use `{ ok: false, error: { code, message } }`; `CALL_BUSY` means either participant already has a `RINGING` or `ACCEPTED` call. Repeated or unauthorized state transitions fail without issuing room tokens.

Ringing calls transition to `MISSED` after 30 seconds. A background sweep also expires overdue calls after an API restart. The transition is conditional on the persisted `RINGING` status so acceptance, rejection, ending, and timeout cannot all win. PostgreSQL advisory transaction locks serialize invitations involving the same accounts. Blocked users cannot call one another.

Tokens are signed on the server, limited to one room and one opaque participant identity, expire in 10 minutes, and cannot publish data tracks. The server never returns the LiveKit API secret. Socket authorization uses only the access token and is disconnected when that token expires; the mobile client obtains a refreshed access token and reconnects. No phone or email is included in call signaling.

This gateway stores live socket presence and timers in the API process. Run one API instance for this prototype; horizontal deployment needs a shared Socket.IO adapter and a distributed timer/lock strategy. Incoming rings currently require the app to have a live Socket.IO connection; push/background ringing is not included in this phase.

All request bodies, parameters, and query strings will be validated with Zod. Responses use explicit DTOs, and authentication failures and server errors will not expose stack traces or secrets. Email is returned only from authenticated account endpoints; public listing DTOs will omit email and phone.
