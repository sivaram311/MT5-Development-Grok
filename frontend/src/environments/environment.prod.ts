import { resolveApiUrl } from './api-url';

export const environment = {
  production: true,
  apiUrl: resolveApiUrl(),
  showDemoHint: false,
  autoLogin: false,
  autoLoginCredentials: { username: '', password: '' }
};
