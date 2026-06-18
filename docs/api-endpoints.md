# API Endpoints

Base URL: `http://localhost:8081` (port may vary if auto-selected by run script)

## Authentication (JWT + Refresh Tokens)

### POST `/api/auth/login`
**Request:**
```json
{
  "username": "admin",
  "password": "admin123"

Note: The admin user is automatically created on first startup by DataSeeder.java if it does not exist.
}
```

**Response (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "uuid-refresh-token-here",
  "tokenType": "Bearer",
  "username": "admin",
  "message": "Login successful"
}
```

### POST `/api/auth/refresh`
Refresh the access token using refresh token.

**Request:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**Response:**
```json
{
  "accessToken": "new-access-jwt",
  "tokenType": "Bearer"
}
```

### GET `/api/auth/me`
Requires Bearer access token.

**Response:**
```json
{
  "username": "admin",
  "authenticated": true
}
```

### POST `/api/auth/logout`
Revokes the user's refresh token.

## Welcome & Content

### GET `/api/welcome`
**Response:**
```json
{
  "message": "Welcome to Grok Dev!",
  "description": "...",
  "status": "success"
}
```

### GET `/api/projects`
Returns list of demo projects.

### GET `/api/projects/active`

## Protected Routes
All non-auth endpoints require valid JWT in header:
```
Authorization: Bearer <token>
```

## Error Responses
- `401 Unauthorized`: Invalid or missing token
- `400 Bad Request`: Validation errors

## Frontend Integration
Angular uses `AuthInterceptor` to automatically attach the token to all outgoing requests after login.