import { useEffect, useMemo, useRef, useState } from "react";
import type { BathroomReport, BathroomSummary, GamificationMe } from "../types";
import { api } from "../lib/api";
import { authStore } from "../lib/auth";
import { createHubConnection } from "../lib/signalr";
import { BathroomTile } from "../components/BathroomTile";
import { Link } from "react-router-dom";

type Toast = {
  id: number;
  text: string;
};

type DeleteTarget = {
  id: string;
  name: string;
} | null;

type Props = {
  token: string;
  name: string | null;
  onSignOut: () => void;
};

export function DashboardPage({ token, name, onSignOut }: Props) {
  const [bathrooms, setBathrooms] = useState<BathroomSummary[]>([]);
  const [gamification, setGamification] = useState<GamificationMe | null>(null);
  const [newBathroomName, setNewBathroomName] = useState("");
  const [newBathroomLocation, setNewBathroomLocation] = useState("");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const createNameRef = useRef<HTMLInputElement | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const deleteConfirmRef = useRef<HTMLButtonElement | null>(null);
  const reportsCacheRef = useRef<Record<string, BathroomReport[]>>({});
  const reportsInFlightRef = useRef<Map<string, Promise<BathroomReport[]>>>(
    new Map(),
  );

  const firstName = useMemo(() => {
    const raw = (name ?? authStore.getName() ?? "").trim();
    if (!raw) return null;
    return raw.split(/\s+/)[0] ?? null;
  }, [name]);
  const isAdmin = authStore
    .getRoles()
    .map((r) => r.toLowerCase())
    .includes("admin");

  useEffect(() => {
    if (!isAdmin && createOpen) {
      setCreateOpen(false);
    }
  }, [isAdmin, createOpen]);

  function toast(text: string) {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }

  async function refresh() {
    const list = await api.getBathrooms(token);
    setBathrooms(list);
  }

  async function refreshGamification() {
    const me = await api.gamificationMe(token);
    setGamification(me);
  }

  async function createBathroom(event: React.FormEvent) {
    event.preventDefault();

    await api.createBathroom(token, {
      name: newBathroomName,
      location: newBathroomLocation,
    });

    setNewBathroomName("");
    setNewBathroomLocation("");
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

  async function report(
    bathroomId: string,
    status: "available" | "unavailable",
    notes?: string,
  ) {
    await api.report(token, bathroomId, { status, notes });
    delete reportsCacheRef.current[bathroomId];
    await refresh();
    await refreshGamification();
  }

  async function toggleSubscription(bathroomId: string, subscribe: boolean) {
    if (subscribe) {
      await api.subscribe(token, bathroomId);
      toast("Subscribed to bathroom alerts.");
    } else {
      await api.unsubscribe(token, bathroomId);
      toast("Unsubscribed from bathroom alerts.");
    }
    await refresh();
  }

  async function requestDeleteBathroom(bathroomId: string) {
    const bathroom = bathrooms.find((b) => b.id === bathroomId);
    setDeleteTarget({
      id: bathroomId,
      name: bathroom?.name ?? "this bathroom",
    });
    setDeleteOpen(true);
  }

  async function confirmDeleteBathroom() {
    if (!deleteTarget) return;
    setDeleteBusy(true);
    try {
      await api.deleteBathroom(token, deleteTarget.id);
      toast("Bathroom deleted.");
      delete reportsCacheRef.current[deleteTarget.id];
      setDeleteOpen(false);
      setDeleteTarget(null);
    } catch (error) {
      toast((error as Error).message);
      throw error;
    } finally {
      setDeleteBusy(false);
      await refresh();
    }
  }

  async function getRecentReports(bathroomId: string) {
    const cached = reportsCacheRef.current[bathroomId];
    if (cached) return cached;

    const inFlight = reportsInFlightRef.current.get(bathroomId);
    if (inFlight) return inFlight;

    const promise = api
      .getReports(token, bathroomId, 168)
      .then((reports) => reports.slice(0, 5))
      .finally(() => {
        reportsInFlightRef.current.delete(bathroomId);
      });

    reportsInFlightRef.current.set(bathroomId, promise);
    const resolved = await promise;
    reportsCacheRef.current[bathroomId] = resolved;
    return resolved;
  }

  function enableDesktopNotifications() {
    if (!("Notification" in window)) {
      toast("Desktop notifications are not supported in this browser.");
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        toast("Desktop notifications enabled.");
      } else {
        toast("Notification permission was not granted.");
      }
    });
  }

  function showDesktopNotification(title: string, body: string) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }

  useEffect(() => {
    refresh().catch((error: Error) => toast(error.message));
    refreshGamification().catch((error: Error) => toast(error.message));
  }, [token]);

  useEffect(() => {
    const hub = createHubConnection(token);

    hub.on("BathroomUpdated", () => {
      reportsCacheRef.current = {};
      refresh().catch((error: Error) => toast(error.message));
    });

    hub.on(
      "BathroomReportNotification",
      (payload: { message: string; bathroomName: string }) => {
        toast(payload.message);
        showDesktopNotification("Bathroom Update", payload.message);
      },
    );

    hub.on(
      "BathroomPrediction",
      (payload: {
        message: string;
        bathroomName: string;
        probabilityUnavailable: number;
      }) => {
        const msg = `${payload.message} (${Math.round(payload.probabilityUnavailable * 100)}% chance)`;
        toast(msg);
        showDesktopNotification("Availability Prediction", msg);
      },
    );

    hub.on(
      "BathroomDeleted",
      (payload: { bathroomId: string; bathroomName: string }) => {
        delete reportsCacheRef.current[payload.bathroomId];
        toast(`${payload.bathroomName} was deleted.`);
        refresh().catch((error: Error) => toast(error.message));
      },
    );

    hub.start().catch((error: Error) => toast(error.message));

    return () => {
      hub.stop().catch(() => undefined);
    };
  }, [token]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSettingsOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [settingsOpen]);

  useEffect(() => {
    if (!createOpen) return;
    createNameRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setCreateOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createOpen]);

  useEffect(() => {
    if (!deleteOpen) return;
    deleteConfirmRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDeleteOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [deleteOpen]);

  return (
    <main className="dashboard-shell">
      <header className="dashboard-head">
        <div className="dashboard-head-main">
          <span className="head-eyebrow">Live Operations</span>
          <h1>Bathroom Reports</h1>
          <p>Welcome {firstName ?? "friend"}.</p>
          <div className="head-meta">
            <span>{bathrooms.length} Bathrooms</span>
            <span>SignalR Live Feed</span>
            {gamification && (
              <span>
                Level {gamification.level} {gamification.levelName}
              </span>
            )}
            {gamification && <span>Rank #{gamification.rank}</span>}
          </div>
        </div>
        <div className="dashboard-head-actions">
          {isAdmin && (
            <button
              className="header-create-btn"
              onClick={() => setCreateOpen(true)}
            >
              Create Bathroom
            </button>
          )}
        </div>
      </header>

      <section className="tile-grid">
        {bathrooms.map((bathroom) => (
          <BathroomTile
            key={bathroom.id}
            bathroom={bathroom}
            onReport={report}
            onToggleSubscription={toggleSubscription}
            onViewReports={getRecentReports}
            onDelete={requestDeleteBathroom}
            canManage={isAdmin}
          />
        ))}
      </section>

      <aside className="toasts">
        {toasts.map((item) => (
          <div key={item.id} className="toast">
            {item.text}
          </div>
        ))}
      </aside>

      {createOpen && (
        <button
          className="modal-backdrop"
          onClick={() => setCreateOpen(false)}
          aria-label="Close create bathroom dialog"
        />
      )}
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
              <button
                type="button"
                className="ghost"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}

      {deleteOpen && (
        <button
          className="modal-backdrop"
          onClick={() => setDeleteOpen(false)}
          aria-label="Close delete bathroom dialog"
        />
      )}
      {deleteOpen && (
        <div className="modal-panel" role="dialog" aria-label="Delete bathroom">
          <div className="modal-title">Delete bathroom</div>
          <div className="modal-body">
            <p>
              Delete <strong>{deleteTarget?.name ?? "this bathroom"}</strong>?
            </p>
            <p className="modal-muted">
              This will remove its report history and subscriptions.
            </p>
          </div>
          <div className="modal-actions">
            <button
              type="button"
              className="ghost"
              onClick={() => setDeleteOpen(false)}
              disabled={deleteBusy}
            >
              Cancel
            </button>
            <button
              ref={deleteConfirmRef}
              type="button"
              className="modal-danger-btn"
              onClick={confirmDeleteBathroom}
              disabled={deleteBusy}
            >
              Delete
            </button>
          </div>
        </div>
      )}

      {settingsOpen && (
        <button
          className="settings-backdrop"
          onClick={() => setSettingsOpen(false)}
          aria-label="Close settings"
        />
      )}

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
            <Link className="settings-item" to="/leaderboard" onClick={() => setSettingsOpen(false)}>
              Leaderboard
            </Link>
            {isAdmin && (
              <Link className="settings-item" to="/admin" onClick={() => setSettingsOpen(false)}>
                Admin console
              </Link>
            )}
            <button
              className="settings-item"
              onClick={() => {
                enableDesktopNotifications();
                setSettingsOpen(false);
              }}
            >
              Enable desktop notifications
            </button>
            <button
              className="settings-item danger"
              onClick={() => {
                setSettingsOpen(false);
                onSignOut();
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
