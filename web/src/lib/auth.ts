const TOKEN_KEY = 'bathroomwatch_token';
const NAME_KEY = 'bathroomwatch_name';
const EMAIL_KEY = 'bathroomwatch_email';
const ROLES_KEY = 'bathroomwatch_roles';

export const authStore = {
  save(token: string, name: string, email: string, roles: string[] = []) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(EMAIL_KEY, email);
    localStorage.setItem(ROLES_KEY, JSON.stringify(roles));
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(EMAIL_KEY);
    localStorage.removeItem(ROLES_KEY);
  },
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  getName() {
    return localStorage.getItem(NAME_KEY);
  },
  getEmail() {
    return localStorage.getItem(EMAIL_KEY);
  },
  getRoles(): string[] {
    try {
      const raw = localStorage.getItem(ROLES_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
};
