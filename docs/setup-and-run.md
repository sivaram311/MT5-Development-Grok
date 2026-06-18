# Setup & Run Instructions

## Prerequisites

### 1. Java Development Kit (JDK 21) - REQUIRED
- Download: https://adoptium.net/temurin/releases/?version=21 (recommended)
- Or Oracle: https://www.oracle.com/java/technologies/downloads/#java21
- **Important**: After installing, **restart your PowerShell** or PC.
- Verify:
  ```powershell
  java -version
  ```

### 2. Apache Maven
- Option A (Easiest): Use Maven Wrapper (already supported).
- Option B: Download from https://maven.apache.org/download.cgi and add to PATH.
- Verify:
  ```powershell
  mvn -version
  ```

### 3. Node.js + npm (REQUIRED for Angular)
- Download LTS: https://nodejs.org/
- This installs both `node` and `npm`.
- After install, **restart PowerShell**.
- Verify:
  ```powershell
  node --version
  npm --version
  ```

### 4. Angular CLI
```powershell
npm install -g @angular/cli
ng version
```

### 5. PostgreSQL
- Download: https://www.postgresql.org/download/windows/
- Remember the password you set for user `postgres`.
- The app will automatically create the `grok_dev` schema.

## Quick Verification
Run these commands in PowerShell to check if everything is ready:

```powershell
java -version
mvn -version
node --version
npm --version
ng version
```

If any command says "not recognized", that tool is missing or not added to PATH. Restart PowerShell after installing.

## 1. Database
```bash
psql -U postgres
CREATE DATABASE postgres;
# Schema + tables created automatically on app start
```

## 2. Backend
```bash
cd backend
mvn clean install
mvn spring-boot:run
```
API available at http://localhost:8081

## 3. Frontend
```bash
cd frontend
npm install
ng serve
```
Open http://localhost:4200

## Login
- **admin / admin123**

**Important**: The admin user is **automatically created and its password re-hashed** every time the application starts by `DataSeeder.java`.

This is done in `src/main/java/com/grokdev/grokdev/config/DataSeeder.java` using the live `PasswordEncoder` bean.

If you ever see validation/credential errors for admin, delete the user(s) from the database and restart the app:

```sql
DELETE FROM grok_dev.users WHERE username IN ('admin', 'user1');
```

The `DataSeeder` will recreate them with fresh, correctly encoded passwords on the next startup.

On startup look for this log line (confirms table + BCrypt):
```
>>> Admin credentials ensured: admin / admin123 (verified=true, hashPrefix=$2a$10$...)
```
If verified=false, the passwordEncoder did not match what was stored — check for old compiled classes or restart clean.

## First Login Flow
1. Enter credentials → both `accessToken` + `refreshToken` returned
2. Tokens stored in localStorage
3. Redirect to `/welcome`
4. `ensureValidSession()` runs (proactive refresh if needed)
5. Interceptor attaches access token
6. `/api/welcome` and `/api/projects` called
7. UI shows **live countdown** for token expiration + "Refresh Token" button
8. Role-based content appears (Admin panel visible only for admin user)

## Refresh Token Behavior
- Access token: ~24h
- Refresh token: ~7 days (stored server-side)
- Automatic refresh on 401 or on app start if access token expired
- Logout revokes refresh token server-side

## Running Both Apps Easily (Minimal Script)
Use the provided minimal launcher:

```powershell
cd E:\Source\grok_dev
.\run-dev.ps1
```

The script:
- Finds the first available port starting from 8081 for the backend and passes `--server.port=XXXX` to Maven.
- Opens two tabs in the same Windows Terminal window (if installed):
  - Tab 1: Spring Boot backend (`mvn spring-boot:run`)
  - Tab 2: Angular frontend (`npm run start`)

**Tip:** Install **Windows Terminal** from the Microsoft Store for the cleanest tab experience. If not installed, it will open two separate PowerShell windows.

The script auto-selects a free port for the backend (starting at 8081) and passes it as `--server.port`. The Angular environment defaults to 8081 — update `src/environments/environment.ts` if needed.

**Note on port:** The script auto-detects the next free port starting from 8081 and passes it to the backend.

Angular frontend defaults to calling `http://localhost:8081/api` (see `src/environments/environment.ts`).

If the script picks a different port (rare), manually update `environment.ts` (apiUrl) and restart `ng serve`.

## Troubleshooting the run-dev.ps1 Script

This is a **minimal** script modeled after working CIM-style launchers.

### Verify your tools
```powershell
java -version
mvn -version
node --version
npm --version
ng version
```

### Common Problems
- **"Unexpected token" or quoting errors** → The script file has bad characters or old quoting. Replace `run-dev.ps1` with the clean minimal version.
- **"The system cannot find the file specified"** when using tabs → Install **Windows Terminal** from the Microsoft Store.
- Tools not found → Restart PowerShell after installing.

**Recommended fix**: Use the current minimal `run-dev.ps1` (shown in this doc or re-created from the latest version in the project).

### Backend Startup Error: "For input string: \"604800000#7days\""
This error occurs when Spring tries to parse `jwt.refresh-expiration-ms`.

**Cause**: Inline comment (`# comment`) after the value in `.properties` file is included in the value.

**Fix**: Keep the value clean (no inline comments):

```properties
jwt.refresh-expiration-ms=604800000
```

(Comments must be on their own line starting with `#`.)

### Login validation failure for admin / admin123
- The credentials are seeded at runtime by `DataSeeder.java` (see `backend/src/main/java/.../config/DataSeeder.java`).
- This guarantees a fresh BCrypt hash matching the `PasswordEncoder` bean.
- If login fails:
  1. Check backend logs for messages like `>>> Admin user created successfully`.
  2. Manually delete the user from DB: `DELETE FROM grok_dev.users WHERE username='admin';`
  3. Restart the backend application.

**Never** hardcode BCrypt hashes in `data.sql` – they can mismatch the encoder strength or version.

### Manual Launch (always works)
Open two PowerShell tabs:

**Tab 1 – Backend**
```powershell
cd E:\Source\grok_dev\backend
mvn spring-boot:run
```

**Tab 2 – Frontend**
```powershell
cd E:\Source\grok_dev\frontend
npm install
ng serve
```
