import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { type CustomerEffect, type CustomerIncidentInput, type IncidentInput } from '../../shared/domain';
import { previewStaffIncidentPriority } from '../../shared/priorityPreview';
import { useAuth, useLoad } from '../auth';
import { ErrorNote, humanize } from '../components/ui';
import { api } from '../data/api';

const levels = [[1, 'Low'], [2, 'Medium'], [3, 'High']] as const;

export function ReportIncident() {
  const { user } = useAuth();
  return user?.role === 'Customer' ? <CustomerReport /> : <StaffReport />;
}

const effects: [CustomerEffect, string, string][] = [
  ['BLOCKED', 'I could not complete what I was doing', 'e.g. could not book, pay or log in'],
  ['DEGRADED', 'It worked, but with problems', 'e.g. very slow, had to retry, wrong information shown'],
  ['MINOR', 'A minor problem', 'e.g. a typo, layout issue or broken link']
];

/** Customers only describe the problem. Impact, urgency, category and priority are decided by the system. */
function CustomerReport() {
  const navigate = useNavigate();
  const services = useLoad(() => api.services(), []);
  const [input, setInput] = useState<CustomerIncidentInput>({ title: '', description: '', serviceId: 0, effect: 'DEGRADED', moneyTaken: false, stillHappening: true });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof CustomerIncidentInput>(key: K, value: CustomerIncidentInput[K]) => setInput(prev => ({ ...prev, [key]: value }));

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const created = await api.report(input);
      navigate(`/incidents/${created.incident.id}`, { state: { justCreated: true } });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">REPORT A PROBLEM</div><h1>Tell us what went wrong</h1></div><Link to="/incidents">Cancel</Link></div>
    <ErrorNote message={services.error} />
    <form onSubmit={submit}>
      {error && <p role="alert" className="error">{error}</p>}
      <label>What were you using?<select id="service" required value={input.serviceId || ''} onChange={e => set('serviceId', Number(e.target.value))}>
        <option value="">Choose a service</option>{services.data?.map(s => <option key={s.id} value={s.id}>{humanize(s.name)}</option>)}
      </select></label>
      <label>Short summary<input id="title" required minLength={5} maxLength={120} value={input.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Payment taken but no ticket" /></label>
      <label>What happened?<textarea id="description" required minLength={10} maxLength={4000} value={input.description} onChange={e => set('description', e.target.value)} placeholder="What you were trying to do, what you saw, and roughly when" /></label>
      <fieldset className="choice-group">
        <legend>How did it affect you?</legend>
        {effects.map(([value, label, hint]) => <label key={value} className="checkbox">
          <input type="radio" name="effect" checked={input.effect === value} onChange={() => set('effect', value)} />
          <span>{label}<small>{hint}</small></span>
        </label>)}
      </fieldset>
      <label className="checkbox"><input id="money" type="checkbox" checked={input.moneyTaken} onChange={e => set('moneyTaken', e.target.checked)} />Money was taken from me but I did not get the ticket or service</label>
      <label className="checkbox"><input id="ongoing" type="checkbox" checked={input.stillHappening} onChange={e => set('stillHappening', e.target.checked)} />It is still happening</label>
      <button disabled={busy}>{busy ? 'Sending…' : 'Report problem'}</button>
    </form>
  </>;
}

/** Staff report with impact and urgency; the server confirms the priority. */
function StaffReport() {
  const navigate = useNavigate();
  const services = useLoad(() => api.services(), []);
  const categories = useLoad(() => api.categories(), []);
  const [input, setInput] = useState<IncidentInput>({ title: '', description: '', serviceId: 0, category: '', impact: 2, urgency: 2, affectedUsers: 0, tatkalWindow: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof IncidentInput>(key: K, value: IncidentInput[K]) => setInput(prev => ({ ...prev, [key]: value }));

  const [now, setNow] = useState(() => new Date());
  // The server auto-detects peak Tatkal windows at the time the report is received.
  useEffect(() => { const interval = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(interval); }, []);
  const service = services.data?.find(s => s.id === input.serviceId);
  const category = categories.data?.find(c => c.code === input.category);
  const preview = previewStaffIncidentPriority(input, service, category, now);

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const created = await api.report(input);
      navigate(`/incidents/${created.incident.id}`, { state: { duplicates: created.possibleDuplicates, justCreated: true } });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">INCIDENTS / NEW REPORT</div><h1>Report incident</h1></div><Link to="/incidents">Cancel</Link></div>
    <ErrorNote message={services.error || categories.error} />
    <form onSubmit={submit}>
      {error && <p role="alert" className="error">{error}</p>}
      <h2>What happened</h2>
      <label>Title<input id="title" required minLength={5} maxLength={120} value={input.title} onChange={e => set('title', e.target.value)} placeholder="e.g. UPI payment debited but no PNR generated" /></label>
      <label>Description<textarea id="description" required minLength={10} maxLength={4000} value={input.description} onChange={e => set('description', e.target.value)} placeholder="What users see, since when, and any error messages" /></label>
      <div className="filters">
        <label>Affected service<select id="service" required value={input.serviceId || ''} onChange={e => set('serviceId', Number(e.target.value))}>
          <option value="">Choose a service</option>{services.data?.map(s => <option key={s.id} value={s.id}>{s.name} ({humanize(s.criticality)})</option>)}
        </select></label>
        <label>Category<select id="category" required value={input.category} onChange={e => set('category', e.target.value)}>
          <option value="">Choose a category</option>{categories.data?.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select></label>
      </div>
      <h2>Business impact</h2>
      <div className="filters">
        <label>Impact<select id="impact" value={input.impact} onChange={e => set('impact', Number(e.target.value))}>{levels.map(([v, t]) => <option key={v} value={v}>{v} · {t}</option>)}</select></label>
        <label>Urgency<select id="urgency" value={input.urgency} onChange={e => set('urgency', Number(e.target.value))}>{levels.map(([v, t]) => <option key={v} value={v}>{v} · {t}</option>)}</select></label>
        <label>Affected passengers<input id="affected" type="number" min={0} max={100000000} value={input.affectedUsers} onChange={e => set('affectedUsers', Math.max(0, Number(e.target.value) || 0))} /></label>
      </div>
      <label className="checkbox"><input id="tatkal" type="checkbox" checked={input.tatkalWindow} onChange={e => set('tatkalWindow', e.target.checked)} />
        Started during the Tatkal booking window (10:00–10:30 or 11:00–11:30 IST). Detected automatically for reports filed in the window.</label>
      <p>Estimated priority: <strong>{preview?.priority ?? 'choose a service and category'}</strong> · calculated from impact, urgency and service criticality.
        {preview?.securityOverride && ' Security-team incidents receive a P1 override.'}
        {preview?.peakTatkalOverride && ' A high-impact booking-path incident in the Tatkal window receives a P1 override.'}
        {preview?.autoTatkalWindow && service?.tatkalBookingPath && ' The current Tatkal window is detected automatically.'}
        {' '}The Java service confirms the final priority on submission.</p>
      <button disabled={busy}>{busy ? 'Creating…' : 'Create incident'}</button>
    </form>
  </>;
}
