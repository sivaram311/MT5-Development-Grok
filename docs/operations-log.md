# Operations Log

Running record of **production/runtime incidents** and **code changes** (why we changed something).

Format for each entry:

- **Date** — short title
- **Symptom** — what the user or logs showed
- **Root cause** — confirmed diagnosis
- **Changes** — files/behavior updated
- **Verification** — how we confirmed the fix

---

## 2026-06-28 — Login returns 401 for admin / admin123

### Symptom

Signing in with demo credentials `admin` / `admin123` showed **Unauthorized** / invalid credentials in the UI.

Stack Pilot backend log (`E:\Source\stack-pilot\logs\backend.log`, read bottom-up):

```
2026-06-28T05:35:50 ERROR ... AuthController : !!! LOGIN FAILED for username='admin'
  - BadCredentialsException: Bad credentials
2026-06-28T05:35:50 INFO  ... AuthController : passwordLength=7, passwordPreview='adm***'
```

Earlier successful logins the same day used `passwordLength=8` (correct for `admin123`).

### Root cause

**Not a broken backend auth stack.** The failing request reached `/api/auth/login` but carried a **7-character password** (e.g. `admin12`), not `admin123` (8 characters). Spring Security correctly rejected it at BCrypt verification (`BadCredentialsException`).

Contributing factors:

1. **Browser autofill / manual typo** — easy to omit the trailing `3`.
2. **Stale JWT on login POST** — `AuthInterceptor` attached an expired Bearer token to login requests, causing noisy JWT filter activity before auth (did not alter the password body).
3. **CORS origin mismatch for LAN access** — frontend served at `http://103.118.183.185:4200` was not in the old explicit CORS allow-list (`localhost` / `127.0.0.1` only). This did not cause the logged failure (request reached the controller) but would block API calls after login from the network URL.

`DataSeeder` confirmed `admin123` hash on every dev startup (`verified=true`).

### Changes

| Area | Change | Why |
|------|--------|-----|
| `AuthController.java` | Trim username/password; reject empty after trim; log `passwordLength` on failure | Normalize input; clearer diagnostics |
| `JwtAuthenticationFilter.java` | Skip filter for `/api/auth/login`, `/refresh`, `/logout` | Avoid stale-token noise on auth endpoints |
| `auth.interceptor.ts` | Do not attach Bearer token to login/refresh | Same as above |
| `login.component.ts` | Trim on submit; **Use demo credentials** button | Prevent typos; one-click correct password |
| `SecurityConfig.java` + `application.properties` | CORS `allowed-origin-patterns` incl. `http://*:4200` | Allow LAN IP frontend (e.g. `103.118.183.185:4200`) |
| `GlobalExceptionHandler.java` | Map malformed JSON body → 400 | Avoid misleading 500 on bad client payloads |

### Verification

- `Invoke-RestMethod POST /api/auth/login` with `admin` / `admin123` → **200**, tokens returned.
- Failed log attempt had `passwordLength=7`; successful attempts had `passwordLength=8`.
- `mvn test` — 12 tests passed.
- `npm run build` — succeeded.

---

## Template (copy for future entries)

```markdown
## YYYY-MM-DD — Title

### Symptom
...

### Root cause
...

### Changes
| Area | Change | Why |
|------|--------|-----|

### Verification
...
```
