# LandConnect architecture

LandConnect is a pnpm monorepo with an Expo development-build client in `apps/mobile`, a Fastify API in `apps/api`, and architecture/API notes in `docs/`.

The API will use feature modules with route, controller, service, and repository layers. Prisma is the only database access path. Public DTOs will be explicit allow-lists so account email and phone fields never leak from user records. Socket.IO handshakes and REST routes will authenticate through the same access-token identity. LiveKit room credentials are generated server-side only for authorized call or meeting participants.

## Data model

- `User` stores normalized account identity, an Argon2id password hash, and one of the three marketplace roles.
- `RefreshToken` stores only a hash, expiry, revocation time, and rotation family; the raw credential stays on the device in secure storage.
- `Listing` belongs to one owner and stores price, area, coordinates, and lifecycle status. `ListingImage` stores Cloudinary identifiers and ordering, not image bytes.
- `Conversation` is scoped to a listing. `ConversationParticipant` is the membership/authorization join and keeps a per-user read cursor. `Message` stores content and delivery timestamps.
- `Call` records caller, callee, media type, room name, status, and lifecycle timestamps. LiveKit credentials are ephemeral and never persisted.
- `MeetingRoom` and `MeetingParticipant` represent explicitly invited room members. `UserBlock` stores directed block relationships.

The initial coordinate index is a PostgreSQL B-tree composite index; viewport filtering will use bounding-box ranges. If geographic query volume warrants it, a later migration can add PostGIS without changing the listing API contract.

## Local database

`docker compose up -d postgres` starts PostgreSQL 16 with a named persistent volume. Use `apps/api/.env.example` as the local API configuration template; never commit `.env` files.
