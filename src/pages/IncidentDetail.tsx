import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { reporterRoles, type Action, type Incident, type SimilarIncident, type User } from '../../shared/domain';
import { useLoad } from '../auth';
import { ErrorNote, PriorityBadge, SlaTag, StatusTag, formatDate, humanize } from '../components/ui';
import { api } from '../data/api';

const levelName = ['', 'Low', 'Medium', 'High'];

export function IncidentDetail({ user }: { user: User }) {
  const { id = '' } = useParams();
  const location = useLocation() as { pathname: string; state?: { duplicates?: SimilarIncident[]; justCreated?: boolean } | null };
  const navigate = useNavigate();
  // The "just created" banner shows once; clear it from history so reloads and other users don't see it.
  const [flash] = useState(() => location.state ?? {});
  useEffect(() => { if (location.state) navigate(location.pathname, { replace: true, state: null }); }, [location.state, location.pathname, navigate]);
  const { data: incident, error, loading, reload, setData } = useLoad(() => api.incident(id), [id]);
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(work: () => Promise<Incident>) {
    setBusy(true); setActionError('');
    try { setData(await work()); } catch (e) { setActionError((e as Error).message); } finally { setBusy(false); }
  }

  if (!incident) return <><Link to="/incidents">← Incident queue</Link>{loading ? <p role="status">Loading incident…</p> : <ErrorNote message={error} onRetry={reload} />}</>;
  const actions = incident.allowedActions ?? [];
  const has = (a: Action) => actions.includes(a);
  const duplicates = flash.duplicates ?? [];
  const customer = user.role === 'Customer';
  const conversation = (incident.history ?? []).filter(h => ['MESSAGE', 'INFO_REQUESTED', 'INFO_PROVIDED'].includes(h.action));

  return <>
    <Link to="/incidents">← Incident queue</Link>
    <div className="detail-head">
      <h1>{incident.title}</h1>
      <p className="muted">{incident.id} · reported by {incident.reporterName} · {formatDate(incident.createdAt)}</p>
      <div className="tags">{!customer && <PriorityBadge priority={incident.priority} />}<StatusTag status={incident.status} />{!customer && <SlaTag sla={incident.sla} />}{!customer && incident.tatkalWindow && <span className="status-tag">TATKAL WINDOW</span>}</div>
    </div>

    {flash.justCreated && (customer
      ? <p className="notice-box" role="status">Thank you, we have received your report. Our IT team will look into it, and you can message them below.</p>
      : <p className="notice-box" role="status">Incident created and classified as <strong>{incident.priority}</strong>. The IT manager has been notified.</p>)}
    {duplicates.length > 0 && <div className="warning-box"><strong>Possible duplicates.</strong> These open incidents look similar: {duplicates.map((d, n) => <span key={d.id}>{n > 0 && ', '}<Link to={`/incidents/${d.id}`}>{d.id}</Link> ({d.title})</span>)}.</div>}

    {incident.informationRequest && <div className="warning-box" role="status">
      <strong>{reporterRoles.includes(user.role) ? 'The technician needs more information from you.' : 'Waiting for the reporter to answer.'}</strong>
      <p className="preserve">{incident.informationRequest}</p>
      <small>Asked {formatDate(incident.informationRequestedAt)}{user.role === 'Technician' && ' · you can resolve once the reporter answers'}</small>
    </div>}

    <div className="detail-grid">
      <section className="facts">
        <h2>Details</h2>
        <p className="preserve">{incident.description}</p>
        {customer ? <dl>
          <Fact label="Service">{humanize(incident.serviceName)}</Fact>
          <Fact label="Reported">{formatDate(incident.createdAt)}</Fact>
          <Fact label="Handled by">{incident.assigneeName ?? 'Our IT team will assign someone shortly'}</Fact>
          {incident.resolvedAt && <Fact label="Resolved">{formatDate(incident.resolvedAt)}</Fact>}
        </dl> : <dl>
          <Fact label="Service">{incident.serviceName} · criticality {incident.criticality}/3</Fact>
          <Fact label="Category">{humanize(incident.category)}</Fact>
          <Fact label="Impact / urgency">{levelName[incident.impact]} / {levelName[incident.urgency]}</Fact>
          <Fact label="Affected passengers">{incident.affectedUsers.toLocaleString()}</Fact>
          <Fact label="Why this priority">{incident.priorityReason ?? '—'}</Fact>
          <Fact label="Assigned to">{incident.assigneeName ?? 'Awaiting assignment'}</Fact>
          <Fact label="Response due">{formatDate(incident.responseDueAt)}{incident.acknowledgedAt && <small>Acknowledged {formatDate(incident.acknowledgedAt)}</small>}</Fact>
          <Fact label="Resolution due">{formatDate(incident.resolutionDueAt)}{incident.resolvedAt && <small>Resolved {formatDate(incident.resolvedAt)}</small>}</Fact>
        </dl>}
        {incident.resolution && <>
          <h2>Resolution</h2>
          <dl>
            <Fact label="Fix">{incident.resolution.summary}</Fact>
            {!customer && <Fact label="Root cause">{incident.resolution.rootCause}</Fact>}
            <Fact label="Resolved by">{incident.resolution.technicianName ?? '—'}</Fact>
            <Fact label="Reporter rating">{incident.resolution.feedback ? `${incident.resolution.feedback} / 5` : 'Not rated yet'}</Fact>
          </dl>
        </>}
      </section>

      <section className="actions-panel">
        <h2>Actions</h2>
        <ErrorNote message={actionError} />
        {actions.filter(a => a !== 'NOTE' && a !== 'MESSAGE').length === 0 && <p className="muted">{customer ? 'Nothing is needed from you right now. We will notify you about any updates.' : 'No actions for you at this stage.'}</p>}
        {has('ASSIGN') && <AssignForm busy={busy} onAssign={choice => run(() => api.assign(incident.id, choice))} />}
        {has('CHANGE_PRIORITY') && <PriorityForm current={incident.priority} busy={busy} onChange={(p, reason) => run(() => api.changePriority(incident.id, p, reason))} />}
        {has('ACKNOWLEDGE') && <button disabled={busy} onClick={() => run(() => api.transition(incident.id, 'ACKNOWLEDGE'))}>Acknowledge</button>}
        {has('START') && <button disabled={busy} onClick={() => run(() => api.transition(incident.id, 'START'))}>Start investigation</button>}
        {has('REQUEST_INFO') && <TextAction id="question" label="Ask the reporter for information" button="Send question" min={5} max={1000}
          placeholder="e.g. Which UPI app was used, and what is the transaction ID?" busy={busy} onSubmit={q => run(() => api.requestInfo(incident.id, q))} />}
        {has('PROVIDE_INFO') && <TextAction id="answer" label="Your answer" button="Send answer" min={2} max={2000}
          placeholder="Answer the technician's question" busy={busy} onSubmit={a => run(() => api.provideInfo(incident.id, a))} />}
        {has('RESOLVE') && <ResolveForm busy={busy} onResolve={(summary, rootCause) => run(() => api.transition(incident.id, 'RESOLVE', { summary, rootCause }))} />}
        {has('VERIFY') && <button disabled={busy} onClick={() => run(() => api.transition(incident.id, 'VERIFY'))}>Confirm the fix works</button>}
        {has('FEEDBACK') && <FeedbackForm busy={busy} onRate={rating => run(() => api.feedback(incident.id, rating))} />}
        {has('CLOSE') && <button disabled={busy} onClick={() => run(() => api.transition(incident.id, 'CLOSE'))}>Close incident</button>}
        {has('NOTE') && <NoteForm busy={busy} onNote={text => run(() => api.note(incident.id, text))} />}
        {!reporterRoles.includes(user.role) && incident.similar && incident.similar.length > 0 && <>
          <h2>Similar open incidents</h2>
          <ul className="similar">{incident.similar.map(s => <li key={s.id}><Link to={`/incidents/${s.id}`}>{s.id}</Link> {s.title} <StatusTag status={s.status} /></li>)}</ul>
        </>}
      </section>
    </div>

    <section className="conversation">
      <h2>{customer || user.role === 'Employee' ? 'Messages with the IT team' : 'Messages with the reporter'}</h2>
      {!conversation.length && <p className="muted">{customer ? 'No messages yet. Ask a question or add details below, and the person handling your report will reply here.' : 'No messages yet.'}</p>}
      <ol className="messages">{conversation.map((m, n) => <li key={n} className={m.actorId !== null && String(m.actorId) === user.id ? 'mine' : ''}>
        <div className="bubble">
          {m.action === 'INFO_REQUESTED' && <span className="kind">Question</span>}
          {m.action === 'INFO_PROVIDED' && <span className="kind">Answer</span>}
          <p className="preserve">{m.description}</p>
          <small>{m.actorName} · {formatDate(m.at)}</small>
        </div>
      </li>)}</ol>
      {has('MESSAGE') && <TextAction id="message" label={customer ? 'Message the IT team' : 'Send a message to the reporter'} button="Send message" min={1} max={2000}
        placeholder={customer ? 'Ask a question or add details' : 'Visible to the reporter'} busy={busy} onSubmit={t => run(() => api.message(incident.id, t))} />}
    </section>

    <h2>{customer ? 'Progress' : 'Incident history'}</h2>
    <ol className="history">{(incident.history ?? []).map((h, n) => <li key={n}>
      <strong>{humanize(h.action)}{h.fromStatus !== h.toStatus && h.toStatus && <span className="transition"> {h.fromStatus ?? '—'} → {h.toStatus}</span>}{h.description && <span className="desc">{h.description}</span>}</strong>
      <small>{formatDate(h.at)} · {h.actorName}</small>
    </li>)}</ol>
  </>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return <div className="fact"><dt>{label}</dt><dd>{children}</dd></div>;
}

function AssignForm({ busy, onAssign }: { busy: boolean; onAssign: (choice: { strategy?: string; technicianId?: number }) => void }) {
  const technicians = useLoad(() => api.technicians(), []);
  const [mode, setMode] = useState('skill');
  return <div className="action-form">
    <label>Assign using<select id="assign-mode" value={mode} onChange={e => setMode(e.target.value)}>
      <option value="skill">Skill-based strategy</option>
      <option value="load">Load-based strategy</option>
      <optgroup label="Choose a technician">{technicians.data?.map(t => <option key={t.id} value={`tech:${t.id}`}>{t.name} · {humanize(t.skill)} · {t.workload}/{t.capacity}</option>)}</optgroup>
    </select></label>
    <button disabled={busy} onClick={() => onAssign(mode.startsWith('tech:') ? { technicianId: Number(mode.slice(5)) } : { strategy: mode })}>Assign</button>
  </div>;
}

function ResolveForm({ busy, onResolve }: { busy: boolean; onResolve: (summary: string, rootCause: string) => void }) {
  const [summary, setSummary] = useState('');
  const [rootCause, setRootCause] = useState('');
  return <div className="action-form">
    <label>What fixed it<textarea id="resolution-summary" minLength={10} maxLength={4000} value={summary} onChange={e => setSummary(e.target.value)} /></label>
    <label>Root cause<input id="root-cause" maxLength={2000} value={rootCause} onChange={e => setRootCause(e.target.value)} /></label>
    <button disabled={busy} onClick={() => onResolve(summary, rootCause)}>Resolve incident</button>
  </div>;
}

function FeedbackForm({ busy, onRate }: { busy: boolean; onRate: (rating: number) => void }) {
  const [rating, setRating] = useState(5);
  return <div className="action-form inline">
    <label>Rate the resolution<select id="rating" value={rating} onChange={e => setRating(Number(e.target.value))}>{[5, 4, 3, 2, 1].map(r => <option key={r} value={r}>{r} / 5</option>)}</select></label>
    <button disabled={busy} onClick={() => onRate(rating)}>Send feedback</button>
  </div>;
}

function PriorityForm({ current, busy, onChange }: { current: string | null; busy: boolean; onChange: (priority: string, reason: string) => void }) {
  const options = ['P1', 'P2', 'P3', 'P4'].filter(p => p !== current);
  const [priority, setPriority] = useState(options[0]);
  // After a change the current priority moves; never leave it selected as the "new" one.
  useEffect(() => { setPriority(p => (p === current ? options[0] : p)); }, [current]); // eslint-disable-line react-hooks/exhaustive-deps
  const [reason, setReason] = useState('');
  return <details className="action-form priority-form">
    <summary>Change priority <small>Currently {current}. The technician is notified; the reporter is not.</small></summary>
    <label>New priority<select id="new-priority" value={priority} onChange={e => setPriority(e.target.value)}>{options.map(p => <option key={p} value={p}>{p}</option>)}</select></label>
    <label>Reason<textarea id="priority-reason" className="short" maxLength={500} value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Affects all Tatkal bookings, not a single user" /></label>
    <button disabled={busy || reason.trim().length < 5} onClick={() => { onChange(priority, reason); setReason(''); }}>Change priority</button>
  </details>;
}

function TextAction({ id, label, button, min, max, placeholder, busy, onSubmit }: {
  id: string; label: string; button: string; min: number; max: number; placeholder: string; busy: boolean; onSubmit: (text: string) => void
}) {
  const [text, setText] = useState('');
  return <div className="action-form">
    <label>{label}<textarea id={id} className="short" maxLength={max} value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} /></label>
    <button disabled={busy || text.trim().length < min} onClick={() => { onSubmit(text); setText(''); }}>{button}</button>
  </div>;
}

function NoteForm({ busy, onNote }: { busy: boolean; onNote: (text: string) => void }) {
  const [text, setText] = useState('');
  return <div className="action-form">
    <label>Internal note (not shown to customers)<textarea id="note" className="short" maxLength={2000} value={text} onChange={e => setText(e.target.value)} placeholder="Investigation notes, extra information, questions" /></label>
    <button className="secondary" disabled={busy || text.trim().length < 2} onClick={() => { onNote(text); setText(''); }}>Add note</button>
  </div>;
}
