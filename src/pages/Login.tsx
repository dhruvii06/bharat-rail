import { useState, type FormEvent } from 'react';
import { useAuth } from '../auth';
import { api } from '../data/api';
import { BrandLogo } from '../components/BrandLogo';
import { ThemeToggle } from '../components/ThemeToggle';

// Sign-in and customer self-registration (design by Dhruvi). Members of the public register as
// Customers to report problems; employee, technician and manager accounts are created by the IT manager.

const demoAccounts = [
  ['customer@demo.local', 'Customer · member of the public'],
  ['support1@demo.local', 'Employee · Customer Support'],
  ['ops@demo.local', 'Employee · Station Operations'],
  ['tech.payment@demo.local', 'Technician · Payments'],
  ['tech.database@demo.local', 'Technician · Database'],
  ['app.tech@demo.local', 'Technician · Application'],
  ['admin1@demo.local', 'IT Manager']
];

export function Login() {
  const { signIn } = useAuth();
  const [register, setRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (register) {
        await api.register(name, email, password);
        setRegister(false); setPassword('');
        setNotice('Account created. Sign in to report a problem and follow its progress.');
      } else {
        await signIn(email, password);
      }
    } catch (err) {
      const e2 = err as Error & { fieldErrors?: Record<string, string> };
      setError(e2.fieldErrors ? Object.entries(e2.fieldErrors).map(([f, m]) => `${f}: ${m}`).join(' ') : e2.message);
    } finally { setBusy(false); }
  }

  function toggle() { setRegister(r => !r); setError(''); setNotice(''); setPassword(''); }

  return <div className="auth-shell">
    <ThemeToggle className="auth-theme-toggle" />
    <BrandLogo className="auth-brand-logo" />
    <div className="auth-panel">
      <div className="eyebrow">IT SERVICE MANAGEMENT</div>
      <h1>{register ? 'Create a customer account' : 'Sign in'}</h1>
      <p className="muted">{register ? 'For customers who want to report a problem with Bharat Rail’s online services. Staff accounts are created by the IT manager.' : 'Customers and Bharat Rail staff sign in here.'}</p>
      <form onSubmit={submit}>
        {error && <p role="alert" className="error">{error}</p>}
        {notice && <p role="status" className="notice-box">{notice}</p>}
        {register && <label>Full name<input id="name" required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}
        <label>Email address<input id="email" type="email" required maxLength={254} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label>Password<input id="password" type="password" required maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {register && <small>Use at least 8 characters, including letters and a number.</small>}
        <button disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
      </form>
      <button type="button" className="text-button" disabled={busy} onClick={toggle}>{register ? 'Back to sign in' : 'New customer? Create an account'}</button>
      {!register && <details className="demo-accounts">
        <summary>Demo accounts</summary>
        <p className="muted">All demo accounts share the development password set in <code>backend/seed/demoUsers.ts</code> (or <code>DEMO_PASSWORD</code>).</p>
        <ul>{demoAccounts.map(([mail, role]) => <li key={mail}><button type="button" className="link-button" onClick={() => setEmail(mail)}>{mail}</button><span>{role}</span></li>)}</ul>
      </details>}
    </div>
    <p className="auth-footer">Bharat Rail · Service Operations</p>
  </div>;
}
