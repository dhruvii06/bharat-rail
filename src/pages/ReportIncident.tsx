import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { calculatePriority, type IncidentInput } from '../../shared/domain';
import { useLoad } from '../auth';
import { ErrorNote, humanize } from '../components/ui';
import { api } from '../data/api';

const levels = [[1, 'Low'], [2, 'Medium'], [3, 'High']] as const;

export function ReportIncident() {
  const navigate = useNavigate();
  const services = useLoad(() => api.services(), []);
  const categories = useLoad(() => api.categories(), []);
  const [input, setInput] = useState<IncidentInput>({ title: '', description: '', serviceId: 0, category: '', impact: 2, urgency: 2, affectedUsers: 0, tatkalWindow: false });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof IncidentInput>(key: K, value: IncidentInput[K]) => setInput(prev => ({ ...prev, [key]: value }));

  const service = services.data?.find(s => s.id === input.serviceId);
  const preview = service ? calculatePriority({ impact: input.impact, urgency: input.urgency, criticality: service.criticalityScore,
    securityIncident: input.category === 'SECURITY', tatkalWindow: input.tatkalWindow }) : null;

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
      <p>Expected priority: <strong>{preview ?? 'choose a service'}</strong> · business criticality comes from the service; security incidents and high-impact Tatkal incidents are P1. The server confirms it on submit.</p>
      <button disabled={busy}>{busy ? 'Creating…' : 'Create incident'}</button>
    </form>
  </>;
}
