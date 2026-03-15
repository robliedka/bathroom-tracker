import { useState } from 'react';

type Props = {
  onSubmit: (payload: { name: string; email: string; password: string }) => Promise<void>;
  onSwitch: () => void;
};

export function RegisterPage({ onSubmit, onSwitch }: Props) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await onSubmit({ name, email, password });
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <form className="auth-card" onSubmit={submit}>
        <h1>Create Account</h1>
        <p>Get notifications and subscribe to bathroom status updates.</p>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" required />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" required />
        <button disabled={busy} type="submit">Create Account</button>
        <button type="button" className="ghost" onClick={onSwitch}>Already have an account?</button>
      </form>
    </main>
  );
}
