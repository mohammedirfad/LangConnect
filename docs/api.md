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

## Direct calls (Phase 2)

All call routes require a bearer access token and are rate limited. `POST /api/v1/calls` accepts `{ "calleeId": "<user UUID>", "type": "AUDIO" | "VIDEO" }` and creates a `RINGING` call. A caller can read the call ID/status; only the callee can accept it with `POST /api/v1/calls/{callId}/join`. Once accepted, both participants can request their own LiveKit token from that join route. `GET /api/v1/calls/{callId}` is participant-only; `POST /api/v1/calls/{callId}/end` ends the call and asks LiveKit to delete the room.

Tokens are signed on the server, limited to one room and one opaque participant identity, expire in 10 minutes, and cannot publish data tracks. The server never returns the LiveKit API secret. Users who have blocked one another cannot create calls. Phase 2 uses a shared call ID for manual two-device testing; socket invitations, ringing notifications, busy state, rejection, and 30-second missed-call handling belong to Phase 3.

All request bodies, parameters, and query strings will be validated with Zod. Responses use explicit DTOs, and authentication failures and server errors will not expose stack traces or secrets. Email is returned only from authenticated account endpoints; public listing DTOs will omit email and phone.
