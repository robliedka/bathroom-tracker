import { useState } from 'react';

type Props = {
  onSubmit: (payload: { email: string; password: string }) => Promise<void>;
  onSwitch: () => void;
};

export function LoginPage({ onSubmit, onSwitch }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ email, password });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Bathroom Watch</h1>
        <p>Sign in to report bathroom availability in real time.</p>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        <button disabled={busy} type="submit">Sign In</button>
        <button type="button" className="ghost" onClick={onSwitch}>Need an account?</button>
      </form>
    </main>
  );
}
