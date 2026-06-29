/**
 * Resolve API base URL for dev server vs nginx reverse proxy (port 80/443).
 * Behind nginx at delena.buzz, /api is proxied to Spring Boot — same origin, no CORS.
 */
export function resolveApiUrl(): string {
  if (typeof window === 'undefined') {
    return 'http://localhost:8081/api';
  }
  const { protocol, hostname, port } = window.location;
  // Direct dev server — backend on :8081
  if (port === '4200') {
    return `http://${hostname}:8081/api`;
  }
  // Public domain via nginx (port 80/443 or default)
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${hostname}/api`;
  }
  return `http://${hostname}:8081/api`;
}
