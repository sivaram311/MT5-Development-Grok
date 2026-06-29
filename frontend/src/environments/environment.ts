import { resolveApiUrl } from './api-url';

export const environment = {
  production: false,
  apiUrl: resolveApiUrl(),
  showDemoHint: true,
  /** Dev/testing: sign in automatically when the login page loads. */
  autoLogin: true,
  autoLoginCredentials: { username: 'admin', password: 'admin123' }
};
