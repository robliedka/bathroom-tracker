const TOKEN_KEY = 'bathroomwatch_token';
const NAME_KEY = 'bathroomwatch_name';
const EMAIL_KEY = 'bathroomwatch_email';

export const authStore = {
  save(token: string, name: string, email: string) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(NAME_KEY, name);
    localStorage.setItem(EMAIL_KEY, email);
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(EMAIL_KEY);
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
};
