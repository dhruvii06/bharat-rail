import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';

const demoAccounts = [
  ['priya.emp@demo.local', 'Employee · Customer Support'],
  ['ananya.tech@demo.local', 'Technician · Payments'],
  ['vikram.tech@demo.local', 'Technician · Database'],
  ['app.tech@demo.local', 'Technician · Application'],
  ['rajesh.admin@demo.local', 'IT Manager']
];

export function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try { await signIn(email, password); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return <div className="login-page">
    <div className="login-card">
      <div className="eyebrow">BHARAT RAIL · IT SERVICE MANAGEMENT</div>
      <h1>Sign in to the Incident Desk</h1>
      <form onSubmit={submit}>
        {error && <p role="alert" className="error">{error}</p>}
        <label>Work email<input id="email" type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <details className="demo-accounts">
        <summary>Demo accounts</summary>
        <p className="muted">All demo accounts share the development password set in <code>backend/seed/demoUsers.ts</code> (or <code>DEMO_PASSWORD</code>).</p>
        <ul>{demoAccounts.map(([mail, role]) => <li key={mail}><button type="button" className="link-button" onClick={() => setEmail(mail)}>{mail}</button><span>{role}</span></li>)}</ul>
      </details>
    </div>
  </div>;
}
