/** JWT-shaped test token (exp far future) for e2e without a running backend. */
export function seedAuthStorage(page: import('@playwright/test').Page) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({ sub: 'admin', exp: 9999999999 }));
  const token = `${header}.${payload}.test-signature`;
  return page.addInitScript(({ accessToken }) => {
    localStorage.setItem('access_token', accessToken);
    localStorage.setItem('refresh_token', 'test-refresh');
    localStorage.setItem('currentUser', JSON.stringify({ username: 'admin', roles: ['ROLE_ADMIN'] }));
  }, { accessToken: token });
}
