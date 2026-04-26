/**
 * 로컬에서 UI만 볼 때 `true`로 하면 루트가 데모 모드로 대시보드에 진입.(운영은 `false`)
 */
export const AUTH_TEMP_DISABLED = false;

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function removeToken() {
  localStorage.removeItem('token');
}

export function getUser() {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  return raw ? JSON.parse(raw) : null;
}

export function setUser(user: any) {
  localStorage.setItem('user', JSON.stringify(user));
}

/** API 없이 레이아웃만 볼 때 (로컬 플래그 + 고정 토큰) */
const UI_DEMO_FLAG = 'ui_demo';
export const UI_DEMO_TOKEN = '__ui_demo__';

export function isUiDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(UI_DEMO_FLAG) === '1' && getToken() === UI_DEMO_TOKEN;
}

export function enterUiDemoMode(opts?: { username?: string; age?: number }) {
  if (typeof window === 'undefined') return;
  const u = (opts?.username && opts.username.trim()) || 'guest';
  const age = typeof opts?.age === 'number' && !Number.isNaN(opts.age) ? opts.age : 30;
  localStorage.setItem(UI_DEMO_FLAG, '1');
  setToken(UI_DEMO_TOKEN);
  setUser({ id: 0, username: u, age });
}

export function logout() {
  if (AUTH_TEMP_DISABLED) {
    localStorage.setItem(UI_DEMO_FLAG, '1');
    setToken(UI_DEMO_TOKEN);
    setUser({ id: 0, username: 'guest', age: 30 });
    window.location.href = '/dashboard';
    return;
  }
  localStorage.removeItem(UI_DEMO_FLAG);
  removeToken();
  localStorage.removeItem('user');
  window.location.href = '/login';
}
