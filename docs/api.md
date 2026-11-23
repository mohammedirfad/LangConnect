# API outline

The API listens on port 4000 by default. `GET /health` is the initial liveness endpoint. Feature route contracts will be documented here as the corresponding phases are implemented.

All request bodies, parameters, and query strings will be validated with Zod. Responses use explicit DTOs, and authentication failures and server errors will not expose stack traces or secrets.
