const sessionContent = {
  'application/json': { schema: { $ref: '#/components/schemas/AuthSession' } },
};

const errorContent = {
  'application/json': { schema: { $ref: '#/components/schemas/ApiError' } },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'LandConnect API',
    version: '0.1.0',
    description:
      'Development API reference. Register or log in to get an access token, then use Authorize to test protected endpoints.',
  },
  servers: [{ url: '/', description: 'This LandConnect API server' }],
  tags: [{ name: 'Health' }, { name: 'Authentication' }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Check that the API is running',
        responses: {
          '200': {
            description: 'API is healthy',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/Health' } } },
          },
        },
      },
    },
    '/ready': {
      get: {
        tags: ['Health'],
        summary: 'Check API and database readiness',
        responses: {
          '200': {
            description: 'API can connect to PostgreSQL',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'database'],
                  properties: {
                    status: { type: 'string', enum: ['ready'] },
                    database: { type: 'string', enum: ['connected'] },
                  },
                },
              },
            },
          },
          '503': { description: 'Database unavailable', content: errorContent },
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Authentication'],
        summary: 'Create an account',
        description:
          'Passwords must be 12–128 characters. Registration is limited to 5 requests per minute.',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RegisterInput' } },
          },
        },
        responses: {
          '201': { description: 'Account created', content: sessionContent },
          '400': { description: 'Invalid request body', content: errorContent },
          '409': { description: 'Email already registered', content: errorContent },
          '429': { description: 'Rate limit reached', content: errorContent },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'Sign in',
        description: 'Login is limited to 8 requests per minute.',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/LoginInput' } } },
        },
        responses: {
          '200': { description: 'Signed in', content: sessionContent },
          '400': { description: 'Invalid request body', content: errorContent },
          '401': { description: 'Email or password is incorrect', content: errorContent },
          '429': { description: 'Rate limit reached', content: errorContent },
        },
      },
    },
    '/api/v1/auth/refresh': {
      post: {
        tags: ['Authentication'],
        summary: 'Rotate the refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RefreshInput' } },
          },
        },
        responses: {
          '200': { description: 'Session tokens rotated', content: sessionContent },
          '401': {
            description: 'Refresh token is invalid, expired, or already used',
            content: errorContent,
          },
          '429': { description: 'Rate limit reached', content: errorContent },
        },
      },
    },
    '/api/v1/auth/logout': {
      post: {
        tags: ['Authentication'],
        summary: 'Revoke a refresh token',
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/RefreshInput' } },
          },
        },
        responses: {
          '204': { description: 'Refresh token revoked' },
          '400': { description: 'Invalid request body', content: errorContent },
          '429': { description: 'Rate limit reached', content: errorContent },
        },
      },
    },
    '/api/v1/auth/me': {
      get: {
        tags: ['Authentication'],
        summary: 'Get the signed-in account',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Account details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['user'],
                  properties: { user: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
          '401': { description: 'Missing or invalid access token', content: errorContent },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Health: {
        type: 'object',
        required: ['status'],
        properties: { status: { type: 'string', enum: ['ok'] } },
      },
      RegisterInput: {
        type: 'object',
        additionalProperties: false,
        required: ['displayName', 'email', 'password', 'role'],
        properties: {
          displayName: { type: 'string', minLength: 2, maxLength: 80, example: 'Asha Kumar' },
          email: { type: 'string', format: 'email', maxLength: 254, example: 'asha@example.com' },
          password: { type: 'string', format: 'password', minLength: 12, maxLength: 128 },
          role: { type: 'string', enum: ['BUYER', 'SELLER', 'BROKER'] },
        },
      },
      LoginInput: {
        type: 'object',
        additionalProperties: false,
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email', maxLength: 254, example: 'asha@example.com' },
          password: { type: 'string', format: 'password', maxLength: 128 },
        },
      },
      RefreshInput: {
        type: 'object',
        additionalProperties: false,
        required: ['refreshToken'],
        properties: { refreshToken: { type: 'string', minLength: 43, maxLength: 128 } },
      },
      User: {
        type: 'object',
        required: ['id', 'email', 'displayName', 'role', 'createdAt'],
        properties: {
          id: { type: 'string', format: 'uuid' },
          email: { type: 'string', format: 'email' },
          displayName: { type: 'string' },
          role: { type: 'string', enum: ['BUYER', 'SELLER', 'BROKER'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AuthSession: {
        type: 'object',
        required: ['user', 'accessToken', 'refreshToken'],
        properties: {
          user: { $ref: '#/components/schemas/User' },
          accessToken: { type: 'string' },
          refreshToken: { type: 'string' },
        },
      },
      ApiError: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      },
    },
  },
} as const;

export function swaggerUiHtml(nonce: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>LandConnect API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
    <style>body { margin: 0; background: #f5f7f4; } .topbar { display: none; }</style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
    <script nonce="${nonce}">
      window.onload = () => SwaggerUIBundle({
        url: '/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
        presets: [SwaggerUIBundle.presets.apis],
        layout: 'BaseLayout'
      });
    </script>
  </body>
</html>`;
}
