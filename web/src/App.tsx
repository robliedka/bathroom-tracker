import { useEffect, useMemo, useRef, useState } from 'react';
import type { BathroomSummary } from './types';
import { authStore } from './lib/auth';
import { api } from './lib/api';
import { createHubConnection } from './lib/signalr';
import { BathroomTile } from './components/BathroomTile';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

type Mode = 'login' | 'register';

type Toast = {
  id: number;
  text: string;
};

function App() {
  const [mode, setMode] = useState<Mode>('login');
  const [token, setToken] = useState<string | null>(authStore.getToken());
  const [name, setName] = useState(authStore.getName());
  const [bathrooms, setBathrooms] = useState<BathroomSummary[]>([]);
  const [newBathroomName, setNewBathroomName] = useState('');
  const [newBathroomLocation, setNewBathroomLocation] = useState('');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createNameRef = useRef<HTMLInputElement | null>(null);

  const firstFour = useMemo(() => bathrooms.slice(0, 4), [bathrooms]);

  function toast(text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  async function refresh() {
    if (!token) return;
    const list = await api.getBathrooms(token);
    setBathrooms(list);
  }

  async function handleLogin(payload: { email: string; password: string }) {
    const response = await api.login(payload);
    authStore.save(response.accessToken, response.name, response.email);
    setToken(response.accessToken);
    setName(response.name);
  }

  async function handleRegister(payload: { name: string; email: string; password: string }) {
    const response = await api.register(payload);
    authStore.save(response.accessToken, response.name, response.email);
    setToken(response.accessToken);
    setName(response.name);
  }

  async function createBathroom(event: React.FormEvent) {
    event.preventDefault();
    if (!token) return;

    await api.createBathroom(token, {
      name: newBathroomName,
      location: newBathroomLocation,
    });

    setNewBathroomName('');
    setNewBathroomLocation('');
    await refresh();
  }

  async function submitCreateBathroom(event: React.FormEvent) {
    try {
      await createBathroom(event);
      setCreateOpen(false);
    } catch (error) {
      toast((error as Error).message);
    }
  }

  async function report(bathroomId: string, status: 'available' | 'unavailable', notes?: string) {
    if (!token) return;
    await api.report(token, bathroomId, { status, notes });
    await refresh();
  }

  async function toggleSubscription(bathroomId: string, subscribe: boolean) {
    if (!token) return;
    if (subscribe) {
      await api.subscribe(token, bathroomId);
      toast('Subscribed to bathroom alerts.');
    } else {
      await api.unsubscribe(token, bathroomId);
      toast('Unsubscribed from bathroom alerts.');
    }
    await refresh();
  }

  async function deleteBathroom(bathroomId: string) {
    if (!token) return;
    const bathroom = bathrooms.find((b) => b.id === bathroomId);
    const name = bathroom?.name ?? 'this bathroom';
    if (!confirm(`Delete ${name}? This will remove its report history and subscriptions.`)) {
      return;
    }

    try {
      await api.deleteBathroom(token, bathroomId);
      toast('Bathroom deleted.');
    } catch (error) {
      toast((error as Error).message);
      throw error;
    } finally {
      await refresh();
    }
  }

  function enableDesktopNotifications() {
    if (!('Notification' in window)) {
      toast('Desktop notifications are not supported in this browser.');
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        toast('Desktop notifications enabled.');
      } else {
        toast('Notification permission was not granted.');
      }
    });
  }

  function signOut() {
    authStore.clear();
    setToken(null);
    setBathrooms([]);
    setSettingsOpen(false);
  }

  function showDesktopNotification(title: string, body: string) {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  }

  useEffect(() => {
    if (!token) return;
    refresh().catch((error: Error) => toast(error.message));
  }, [token]);

  useEffect(() => {
    if (!token) return;

    const hub = createHubConnection(token);

    hub.on('BathroomUpdated', () => {
      refresh().catch((error: Error) => toast(error.message));
    });

    hub.on('BathroomReportNotification', (payload: { message: string; bathroomName: string }) => {
      toast(payload.message);
      showDesktopNotification('Bathroom Update', payload.message);
    });

    hub.on('BathroomPrediction', (payload: { message: string; bathroomName: string; probabilityUnavailable: number }) => {
      const msg = `${payload.message} (${Math.round(payload.probabilityUnavailable * 100)}% chance)`;
      toast(msg);
      showDesktopNotification('Availability Prediction', msg);
    });

    hub.on('BathroomDeleted', (payload: { bathroomId: string; bathroomName: string }) => {
      toast(`${payload.bathroomName} was deleted.`);
      refresh().catch((error: Error) => toast(error.message));
    });

    hub.start().catch((error: Error) => toast(error.message));

    return () => {
      hub.stop().catch(() => undefined);
    };
  }, [token]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSettingsOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (!createOpen) return;
    createNameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setCreateOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [createOpen]);

  if (!token) {
    return mode === 'login' ? (
      <LoginPage onSubmit={handleLogin} onSwitch={() => setMode('register')} />
    ) : (
      <RegisterPage onSubmit={handleRegister} onSwitch={() => setMode('login')} />
    );
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-head">
        <div className="dashboard-head-main">
          <span className="head-eyebrow">Live Operations</span>
          <h1>Bathroom Watch Dashboard</h1>
          <p>Welcome {name}. Track crowd-sourced bathroom availability in real time.</p>
          <div className="head-meta">
            <span>{bathrooms.length} Bathrooms</span>
            <span>SignalR Live Feed</span>
          </div>
        </div>
        <div className="dashboard-head-actions">
          <button className="header-create-btn" onClick={() => setCreateOpen(true)}>Create bathroom</button>
        </div>
      </header>

      <section className="tile-grid">
        {firstFour.map((bathroom) => (
          <BathroomTile
            key={bathroom.id}
            bathroom={bathroom}
            onReport={report}
            onToggleSubscription={toggleSubscription}
            onDelete={deleteBathroom}
          />
        ))}
      </section>

      {bathrooms.length > 4 && (
        <section className="overflow-note">
          <p>Showing first 4 bathrooms on dashboard. {bathrooms.length - 4} additional bathrooms are in the system.</p>
        </section>
      )}

      <aside className="toasts">
        {toasts.map((item) => (
          <div key={item.id} className="toast">{item.text}</div>
        ))}
      </aside>

      {createOpen && <button className="modal-backdrop" onClick={() => setCreateOpen(false)} aria-label="Close create bathroom dialog" />}
      {createOpen && (
        <div className="modal-panel" role="dialog" aria-label="Create bathroom">
          <div className="modal-title">Create bathroom</div>
          <form onSubmit={submitCreateBathroom} className="modal-form">
            <input
              ref={createNameRef}
              value={newBathroomName}
              onChange={(e) => setNewBathroomName(e.target.value)}
              placeholder="Bathroom name"
              required
            />
            <input
              value={newBathroomLocation}
              onChange={(e) => setNewBathroomLocation(e.target.value)}
              placeholder="Location (optional)"
            />
            <div className="modal-actions">
              <button type="button" className="ghost" onClick={() => setCreateOpen(false)}>Cancel</button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}

      {settingsOpen && <button className="settings-backdrop" onClick={() => setSettingsOpen(false)} aria-label="Close settings" />}

      <div className="settings-fab">
        <button
          className="gear-btn"
          onClick={() => setSettingsOpen((prev) => !prev)}
          aria-haspopup="dialog"
          aria-expanded={settingsOpen}
          aria-label="Settings"
          title="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M19.14,12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.11-.2-.36-.28-.57-.2l-2.39.96c-.5-.38-1.04-.69-1.64-.92l-.36-2.54c-.03-.22-.22-.38-.45-.38h-3.84c-.22,0-.41.16-.45.38l-.36,2.54c-.6.23-1.14.54-1.64.92l-2.39-.96c-.21-.08-.46,0-.57.2l-1.92,3.32c-.11.2-.06.47.12.61l2.03,1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03,1.58c-.18.14-.23.41-.12.61l1.92,3.32c.11.2.36.28.57.2l2.39-.96c.5.38,1.04.69,1.64.92l.36,2.54c.03.22.22.38.45.38h3.84c.22,0,.41-.16.45-.38l.36-2.54c.6-.23,1.14-.54,1.64-.92l2.39.96c.21.08.46,0,.57-.2l1.92-3.32c.11-.2.06-.47-.12-.61l-2.03-1.58ZM12,15.5c-1.93,0-3.5-1.57-3.5-3.5s1.57-3.5,3.5-3.5s3.5,1.57,3.5,3.5s-1.57,3.5-3.5,3.5Z"
            />
          </svg>
        </button>

        {settingsOpen && (
          <div className="settings-panel" role="dialog" aria-label="Settings">
            <div className="settings-title">Settings</div>
            <button
              className="settings-item"
              onClick={() => {
                enableDesktopNotifications();
                setSettingsOpen(false);
              }}
            >
              Enable desktop notifications
            </button>
            <button className="settings-item danger" onClick={signOut}>Sign out</button>
          </div>
        )}
      </div>
    </main>
  );
}

export default App;
