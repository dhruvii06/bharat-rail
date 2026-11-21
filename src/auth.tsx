import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Role } from '../shared/domain';

export interface AuthUser { id: string; name: string; email: string; role: Role }
const tokenKey = 'br.session';
export async function authRequest(path: string, body?: unknown) {
  let response: Response;
  try {
    response = await fetch(`/api/v1/auth/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem(tokenKey) ?? ''}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch { throw new Error('Unable to reach the sign-in service. Please try again.'); }
  if (response.status === 204) return null;
  const data = await response.json().catch(() => null);
  if (!response.ok) { const error = new Error((data?.error?.fieldErrors ? Object.values(data.error.fieldErrors).join(' ') : data?.error?.message) || 'Sign-in service unavailable. Please try again.') as Error & { status: number }; error.status = response.status; throw error; }
  return data;
}
export function AuthGate({ children }: { children: (user: AuthUser, logout: () => Promise<void>) => ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  async function check() {
    if (!sessionStorage.getItem(tokenKey)) { setChecking(false); return; }
    try { const result = await authRequest('me'); setUser(result.user); setError(''); }
    catch (e) { const err = e as Error & { status?: number }; setUser(null); setError(err.message); if (err.status === 401) sessionStorage.removeItem(tokenKey); }
    finally { setChecking(false); }
  }
  useEffect(() => { void check(); const timer = setInterval(() => void check(), 60000); return () => clearInterval(timer); }, []);
  async function logout() {
    setError('');
    try { await authRequest('logout', {}); sessionStorage.removeItem(tokenKey); setUser(null); }
    catch (e) { if ((e as Error & { status?: number }).status === 401) { sessionStorage.removeItem(tokenKey); setUser(null); } else setError((e as Error).message); }
  }
  if (checking) return <div className="auth-shell"><p role="status">Checking your session…</p></div>;
  if (user) return <>{error && <div className="auth-alert" role="alert">{error}</div>}{children(user, logout)}</>;
  return <Login message={error} onLogin={(data) => { sessionStorage.setItem(tokenKey, data.token); setUser(data.user); setError(''); }} />;
}
function Login({ message, onLogin }: { message: string; onLogin: (data: { token: string; user: AuthUser }) => void }) {
  const [register, setRegister] = useState(false); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      if (register) { await authRequest('register', { name, email, password }); setRegister(false); setPassword(''); setNotice('Account created. Sign in with your employee account.'); }
      else onLogin(await authRequest('login', { email, password }));
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="auth-shell"><div className="auth-brand">BR <span>Bharat Rail</span></div><div className="auth-panel"><div className="eyebrow">IT SERVICE MANAGEMENT</div><h1>{register ? 'Create employee account' : 'Sign in'}</h1><p className="muted">{register ? 'Technician and administrator accounts are assigned by your IT administrator.' : 'Use your Bharat Rail service account to continue.'}</p><form onSubmit={submit}>{(error || message) && <p role="alert" className="error">{error || message}</p>}{notice && <p role="status">{notice}</p>}{register && <label>Full name<input required minLength={2} maxLength={80} autoComplete="name" value={name} onChange={e => setName(e.target.value)} /></label>}<label>Email address<input type="email" required maxLength={254} autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} /></label><label>Password<input type="password" required maxLength={128} autoComplete={register ? 'new-password' : 'current-password'} value={password} onChange={e => setPassword(e.target.value)} /></label>{register && <small>Use at least 8 characters, including letters and a number.</small>}<button disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button></form><button className="text-button" disabled={busy} onClick={() => { setRegister(!register); setError(''); setNotice(''); setPassword(''); }}>{register ? 'Back to sign in' : 'Create an employee account'}</button></div><p className="auth-footer">Bharat Rail · Service Operations</p></div>;
}

