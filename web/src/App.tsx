import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import { authStore } from './lib/auth';
import { DashboardPage } from './pages/DashboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function useAuthState() {
  const [token, setToken] = useState<string | null>(authStore.getToken());
  const [name, setName] = useState<string | null>(authStore.getName());

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (!event.key) return;
      if (event.key.includes('bathroomwatch_')) {
        setToken(authStore.getToken());
        setName(authStore.getName());
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return useMemo(
    () => ({
      token,
      name,
      setAuthed(nextToken: string, nextName: string, nextEmail: string) {
        authStore.save(nextToken, nextName, nextEmail);
        setToken(nextToken);
        setName(nextName);
      },
      signOut() {
        authStore.clear();
        setToken(null);
        setName(null);
      },
    }),
    [token, name],
  );
}

function RequireAuth({ token, children }: { token: string | null; children: React.ReactNode }) {
  const location = useLocation();
  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function RedirectIfAuthed({ token, children }: { token: string | null; children: React.ReactNode }) {
  if (token) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

function LoginRoute({ token, setAuthed }: { token: string | null; setAuthed: (t: string, n: string, e: string) => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <RedirectIfAuthed token={token}>
      <LoginPage
        onSubmit={async ({ email, password }) => {
          const response = await api.login({ email, password });
          setAuthed(response.accessToken, response.name, response.email);
          const from = (location.state as { from?: string } | null)?.from;
          navigate(from || '/', { replace: true });
        }}
        onSwitch={() => navigate('/register')}
      />
    </RedirectIfAuthed>
  );
}

function RegisterRoute({ token, setAuthed }: { token: string | null; setAuthed: (t: string, n: string, e: string) => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <RedirectIfAuthed token={token}>
      <RegisterPage
        onSubmit={async ({ name, email, password }) => {
          const response = await api.register({ name, email, password });
          setAuthed(response.accessToken, response.name, response.email);
          const from = (location.state as { from?: string } | null)?.from;
          navigate(from || '/', { replace: true });
        }}
        onSwitch={() => navigate('/login')}
      />
    </RedirectIfAuthed>
  );
}

export default function App() {
  const auth = useAuthState();
  const navigate = useNavigate();

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute token={auth.token} setAuthed={auth.setAuthed} />} />
      <Route path="/register" element={<RegisterRoute token={auth.token} setAuthed={auth.setAuthed} />} />

      <Route
        path="/"
        element={
          <RequireAuth token={auth.token}>
            <DashboardPage
              token={auth.token!}
              name={auth.name}
              onSignOut={() => {
                auth.signOut();
                navigate('/login', { replace: true });
              }}
            />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

