# Security & JWT Implementation

## JWT Strategy
- **Stateless**: No server-side sessions (`SessionCreationPolicy.STATELESS`)
- **Algorithm**: HS256 (symmetric)
- **Access Token Expiration**: 24 hours (86400000 ms)
- **Refresh Token Expiration**: 7 days
- **Secret**: Configurable via `jwt.secret`

## Refresh Token Flow
1. On successful login:
   - Issue short-lived **access token** (JWT)
   - Issue long-lived **refresh token** (stored in DB as opaque UUID in `refresh_tokens` table)
2. Client uses access token for API calls (Authorization: Bearer).
3. When access token expires (401):
   - Angular interceptor auto-calls `/api/auth/refresh`.
   - Backend validates refresh token (not expired + not revoked).
   - Returns new access token.
4. Logout: revokes refresh token server-side + clears client storage.

## Key Classes
- `JwtUtil`: Generates both access and refresh JWTs
- `JwtAuthenticationFilter`: Validates access tokens on requests
- `RefreshTokenService`: Handles creation, verification, revocation (SOLID: SRP)
- `RefreshToken` entity + repository

## Best Practices
- Refresh tokens are server-side for revocation.
- Short-lived access tokens + long refresh = good security balance.
- BCrypt for passwords.
- Tokens not logged.

## Breaking Circular Dependencies
The `PasswordEncoder` bean was moved to a dedicated `PasswordEncoderConfig` class.

This broke the cycle:
`JwtAuthenticationFilter → UserService → PasswordEncoder ← SecurityConfig → UserService`

`@Lazy` annotations are used defensively on `UserService` (SecurityConfig) and `UserDetailsService` (JwtFilter).

## Angular Side
- `AuthService`: Stores access + refresh tokens.
- `AuthInterceptor`: Adds Bearer token + handles 401 refresh transparently.
- Failed refresh clears storage.

## Updated API (see api-endpoints.md)
- `/login` now returns `accessToken` + `refreshToken`
- New: `POST /api/auth/refresh`
- Logout now revokes refresh token

See architecture.md for full flow.

## Sequence Diagram (Mermaid)

```mermaid
sequenceDiagram
    participant A as Angular App
    participant B as Backend
    participant DB as Postgres (refresh_tokens)

    A->>B: POST /login (username, password)
    B->>B: Authenticate + BCrypt
    B->>B: Generate access JWT (short)
    B->>DB: Create & store refresh token
    B-->>A: {accessToken, refreshToken}

    Note over A: Store both tokens

    A->>B: API call with accessToken
    B->>B: JwtFilter validates
    B-->>A: Success

    Note over A: Later, access token expires

    A->>B: API call → 401
    A->>A: Interceptor detects 401
    A->>B: POST /refresh {refreshToken}
    B->>DB: Validate refresh token (expiry + not revoked)
    B->>B: Generate new access JWT
    B-->>A: {accessToken}
    A->>A: Retry original request with new token

    Note over A: On app startup
    A->>A: ensureValidSession()
    alt Access token expired
        A->>B: /refresh
    end

## Proactive Refresh & Live UI Features (Latest)

- **Proactive refresh**: Before every HTTP request, the interceptor checks if the token expires in less than 5 minutes and refreshes it first.
- **Live countdown**: The Welcome screen displays a live timer (`Access token expires in Xm Ys`) that updates every 10 seconds.
- **Role-based UI**: Admin-only sections (e.g. "Admin Panel") are shown only when the user has `ROLE_ADMIN`.
- These features were added to improve developer experience and security.

See `frontend-guidelines.md` for more details.
```

## New Enhancements (Startup Refresh + UI Feedback)
- `AuthService.ensureValidSession()` is called on app startup and in route guards. It checks if the access token is expired using `getTokenExpiration()` and automatically calls refresh if a valid refresh token exists.
- Welcome screen displays remaining access token lifetime ("Access token expires in ~XX minutes").
- Manual "Refresh Token" button available for demo/testing.
- These features greatly improve user experience by reducing unnecessary re-logins.