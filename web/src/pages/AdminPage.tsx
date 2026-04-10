import { useEffect, useMemo, useState } from "react";
import type { AdminUser } from "../types";
import { api } from "../lib/api";

type Props = {
  token: string;
};

export function AdminPage({ token }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => {
    return [...users].sort((a, b) => a.email.localeCompare(b.email));
  }, [users]);

  async function refresh() {
    setError(null);
    const result = await api.adminListUsers(token);
    setUsers(result);
  }

  async function setRole(userId: string, role: "standard" | "admin") {
    setBusyUserId(userId);
    setError(null);
    try {
      await api.adminSetUserRole(token, userId, role);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyUserId(null);
    }
  }

  useEffect(() => {
    refresh().catch((e: Error) => setError(e.message));
  }, [token]);

  return (
    <main className="admin-shell">
      <header className="admin-head">
        <div>
          <h1>Admin</h1>
          <p>Manage roles for existing users.</p>
        </div>
        <button className="ghost" onClick={() => refresh()}>
          Refresh
        </button>
      </header>

      {error && <div className="admin-error">{error}</div>}

      <section className="admin-table">
        <div className="admin-row admin-row-head">
          <div>Email</div>
          <div>Name</div>
          <div>Points</div>
          <div>Role</div>
        </div>
        {sorted.map((user) => {
          const role = (user.roles[0] ?? "standard").toLowerCase() as
            | "standard"
            | "admin";
          const disabled = busyUserId === user.id;
          return (
            <div key={user.id} className="admin-row">
              <div className="admin-email">{user.email}</div>
              <div>{user.name}</div>
              <div>{user.points}</div>
              <div>
                <select
                  className="admin-select"
                  value={role}
                  disabled={disabled}
                  onChange={(e) =>
                    setRole(user.id, e.target.value as "standard" | "admin")
                  }
                >
                  <option value="standard">standard</option>
                  <option value="admin">admin</option>
                </select>
              </div>
            </div>
          );
        })}
      </section>
    </main>
  );
}

