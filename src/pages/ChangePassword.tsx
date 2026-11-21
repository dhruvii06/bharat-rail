import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

/**
 * Change password. Shown on its own (no menu) when the IT manager created the account with a
 * temporary password; otherwise reachable from the header.
 */
export function ChangePassword({ forced = false }: { forced?: boolean }) {
  const { user, changePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault(); setError(''); setDone('');
    if (next !== confirm) { setError('The new passwords do not match.'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      setCurrent(''); setNext(''); setConfirm('');
      if (forced) navigate('/'); else setDone('Your password has been changed.');
    } catch (err) {
      const e2 = err as Error & { fieldErrors?: Record<string, string> };
      setError(e2.fieldErrors ? Object.values(e2.fieldErrors).join(' ') : e2.message);
    } finally { setBusy(false); }
  }

  const form = <form onSubmit={submit}>
    {error && <p role="alert" className="error">{error}</p>}
    {done && <p role="status" className="notice-box">{done}</p>}
    <label>{forced ? 'Temporary password' : 'Current password'}<input id="current-password" type="password" required autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} /></label>
    <label>New password<input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={next} onChange={e => setNext(e.target.value)} /></label>
    <label>Confirm new password<input id="confirm-password" type="password" required autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
    <small>Use at least 8 characters, including letters and a number.</small>
    <button disabled={busy}>{busy ? 'Saving…' : 'Change password'}</button>
  </form>;

  if (!forced) return <>
    <div className="page-heading"><div><div className="eyebrow">ACCOUNT</div><h1>Change password</h1></div></div>
    <div style={{ maxWidth: 420 }}>{form}</div>
  </>;

  return <div className="auth-shell">
    <div className="auth-brand">BR <span>Bharat Rail</span></div>
    <div className="auth-panel">
      <div className="eyebrow">FIRST SIGN-IN</div>
      <h1>Choose your password</h1>
      <p className="muted">Welcome, {user?.name}. Your account was created by the IT manager with a temporary password. Choose your own to continue.</p>
      {form}
      <button type="button" className="text-button" onClick={() => void signOut()}>Sign out</button>
    </div>
    <p className="auth-footer">Bharat Rail · Service Operations</p>
  </div>;
}
