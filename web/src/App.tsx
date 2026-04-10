import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api } from './lib/api';
import { authStore } from './lib/auth';
import { AdminPage } from './pages/AdminPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

function useAuthState() {
  const [token, setToken] = useState<string | null>(authStore.getToken());
  const [name, setName] = useState<string | null>(authStore.getName());
  const [roles, setRoles] = useState<string[]>(authStore.getRoles());

  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (!event.key) return;
      if (event.key.includes('bathroomwatch_')) {
        setToken(authStore.getToken());
        setName(authStore.getName());
        setRoles(authStore.getRoles());
      }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return useMemo(
    () => ({
      token,
      name,
      roles,
      isAdmin: roles.map(r => r.toLowerCase()).includes('admin'),
      setAuthed(nextToken: string, nextName: string, nextEmail: string, nextRoles: string[]) {
        authStore.save(nextToken, nextName, nextEmail, nextRoles);
        setToken(nextToken);
        setName(nextName);
        setRoles(nextRoles);
      },
      signOut() {
        authStore.clear();
        setToken(null);
        setName(null);
        setRoles([]);
      },
    }),
    [token, name, roles],
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

function LoginRoute({ token, setAuthed }: { token: string | null; setAuthed: (t: string, n: string, e: string, roles: string[]) => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <RedirectIfAuthed token={token}>
      <LoginPage
        onSubmit={async ({ email, password }) => {
          const response = await api.login({ email, password });
          setAuthed(response.accessToken, response.name, response.email, response.roles);
          const from = (location.state as { from?: string } | null)?.from;
          navigate(from || '/', { replace: true });
        }}
        onSwitch={() => navigate('/register')}
      />
    </RedirectIfAuthed>
  );
}

function RegisterRoute({ token, setAuthed }: { token: string | null; setAuthed: (t: string, n: string, e: string, roles: string[]) => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <RedirectIfAuthed token={token}>
      <RegisterPage
        onSubmit={async ({ name, email, password }) => {
          const response = await api.register({ name, email, password });
          setAuthed(response.accessToken, response.name, response.email, response.roles);
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

      <Route
        path="/admin"
        element={
          <RequireAuth token={auth.token}>
            {auth.isAdmin ? <AdminPage token={auth.token!} /> : <Navigate to="/" replace />}
          </RequireAuth>
        }
      />

      <Route
        path="/leaderboard"
        element={
          <RequireAuth token={auth.token}>
            <LeaderboardPage token={auth.token!} />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
