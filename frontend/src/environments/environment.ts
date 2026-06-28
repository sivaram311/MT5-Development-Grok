export const environment = {
  production: false,
  apiUrl: `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:8081/api`,
  showDemoHint: true,
  /** Dev/testing: sign in automatically when the login page loads. */
  autoLogin: true,
  autoLoginCredentials: { username: 'admin', password: 'admin123' }
};
