import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { reporterRoles, teams, type Action, type Colleague, type Incident, type SimilarIncident, type User } from '../../shared/domain';
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

    {incident.handover && (has('ACCEPT_HANDOVER')
      ? <div className="notice-box handover-box" role="status">
          <strong>{incident.handover.fromName} asks you to take over this incident.</strong>
          <p className="preserve">{incident.handover.reason}</p>
          <small>Asked {formatDate(incident.handover.requestedAt)} · if you accept, it moves to you and you acknowledge it. The SLA deadlines stay the same.</small>
          <HandoverAnswer busy={busy} onAccept={() => run(() => api.acceptHandover(incident.id))} onDecline={async reason => {
            setBusy(true); setActionError('');
            try { await api.declineHandover(incident.id, reason); navigate('/incidents', { replace: true }); }
            catch (e) { setActionError((e as Error).message); setBusy(false); }
          }} />
        </div>
      : <div className="notice-box handover-box" role="status">
          <strong>Waiting for {incident.handover.toName} to accept the hand-over.</strong>
          <p className="preserve">{incident.handover.reason}</p>
          <small>Asked {formatDate(incident.handover.requestedAt)}{has('WITHDRAW_HANDOVER') ? ' · you keep the incident until they accept' : ''}</small>
          {has('WITHDRAW_HANDOVER') && <div className="handover-answer"><button className="secondary" disabled={busy} onClick={() => run(() => api.withdrawHandover(incident.id))}>Withdraw request</button></div>}
        </div>)}

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
          {incident.contributors.length > 0 && <Fact label="Worked on by">{incident.contributors.map(c =>
            <span key={`${c.id}-${c.at}`} className="contributor">{c.name} <small>{passedOnLabel[c.passedOn]} {formatDate(c.at)}{c.note ? ` · ${c.note}` : ''}</small></span>)}</Fact>}
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
        {has('EDIT') && <EditForm incident={incident} manager={user.role === 'Manager'} busy={busy} onSave={patch => run(() => api.edit(incident.id, patch))} />}
        {has('CHANGE_PRIORITY') && <PriorityForm current={incident.priority} busy={busy} onChange={(p, reason) => run(() => api.changePriority(incident.id, p, reason))} />}
        {has('ACKNOWLEDGE') && <button disabled={busy} onClick={() => run(() => api.transition(incident.id, 'ACKNOWLEDGE'))}>Acknowledge</button>}
        {has('START') && <button disabled={busy} onClick={() => run(() => api.transition(incident.id, 'START'))}>Start investigation</button>}
        {has('REQUEST_INFO') && <TextAction id="question" label="Ask the reporter for information" button="Send question" min={5} max={1000}
          placeholder="e.g. Which UPI app was used, and what is the transaction ID?" busy={busy} onSubmit={q => run(() => api.requestInfo(incident.id, q))} />}
        {has('PROVIDE_INFO') && <TextAction id="answer" label="Your answer" button="Send answer" min={2} max={2000}
          placeholder="Answer the technician's question" busy={busy} onSubmit={a => run(() => api.provideInfo(incident.id, a))} />}
        {has('HANDOFF') && <HandoffForm busy={busy} onHandoff={(target, done) => run(() => api.handoff(incident.id, target, done))} />}
        {has('HANDOVER') && <HandoverForm incidentId={incident.id} busy={busy} onHandover={(to, reason) => run(() => api.handover(incident.id, to, reason))} />}
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

/** Correct the report. Reporters can fix text until a technician acknowledges it; the IT manager can also change the category. */
function EditForm({ incident, manager, busy, onSave }: { incident: Incident; manager: boolean; busy: boolean; onSave: (patch: { title?: string; description?: string; category?: string }) => void }) {
  const [title, setTitle] = useState(incident.title);
  const [description, setDescription] = useState(incident.description);
  const [category, setCategory] = useState(incident.category);
  const categories = useLoad(() => (manager ? api.categories() : Promise.resolve([])), [manager]);
  useEffect(() => { setTitle(incident.title); setDescription(incident.description); setCategory(incident.category); }, [incident.title, incident.description, incident.category]);
  const patch = {
    ...(title.trim() !== incident.title ? { title: title.trim() } : {}),
    ...(description.trim() !== incident.description ? { description: description.trim() } : {}),
    ...(manager && category !== incident.category ? { category } : {})
  };
  const changed = Object.keys(patch).length > 0;
  return <details className="action-form edit-form">
    <summary>{manager ? 'Edit incident' : 'Edit your report'} <small>{manager ? 'Changing the category can change the priority.' : 'You can correct it until a technician starts on it.'}</small></summary>
    <label>Title<input id="edit-title" maxLength={120} value={title} onChange={e => setTitle(e.target.value)} /></label>
    <label>Description<textarea id="edit-description" maxLength={4000} value={description} onChange={e => setDescription(e.target.value)} /></label>
    {manager && <label>Category<select id="edit-category" value={category} onChange={e => setCategory(e.target.value)}>
      {categories.data?.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
      {!categories.data?.some(c => c.code === incident.category) && <option value={incident.category}>{humanize(incident.category)}</option>}
    </select></label>}
    <button disabled={busy || !changed || title.trim().length < 5 || description.trim().length < 10} onClick={() => onSave(patch)}>Save changes</button>
  </details>;
}

const passedOnLabel: Record<string, string> = { HANDED_OVER: 'handed over', HANDED_OFF: 'did their part and handed off', HANDED_BACK: 'handed back' };

/** "I can't take this": ask a colleague to take over, or return the incident to the IT manager. */
function HandoverForm({ incidentId, busy, onHandover }: { incidentId: string; busy: boolean; onHandover: (technicianId: number | null, reason: string) => void }) {
  const [open, setOpen] = useState(false);
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [error, setError] = useState('');
  const [to, setTo] = useState('');
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open || colleagues) return;
    api.colleagues(incidentId).then(setColleagues).catch(e => setError((e as Error).message));
  }, [open, colleagues, incidentId]);
  const teamLabel = (code: string) => teams.find(t => t.code === code)?.label ?? humanize(code);
  return <details className="action-form" onToggle={e => setOpen((e.target as HTMLDetailsElement).open)}>
    <summary>Hand over <small>Ask a colleague to take it, or return it to the IT manager.</small></summary>
    {error && <p className="error">{error}</p>}
    <label>Hand over to<select id="handover-to" value={to} onChange={e => setTo(e.target.value)}>
      <option value="">Choose a colleague…</option>
      {colleagues?.map(c => <option key={c.id} value={c.id} disabled={!c.available}>
        {c.name} · {teamLabel(c.team)} · {c.workload}/{c.capacity}{c.available ? '' : ' (unavailable)'}</option>)}
      <option value="manager">Back to the IT manager to reassign</option>
    </select></label>
    <label>Reason<textarea id="handover-reason" className="short" maxLength={500} value={reason} onChange={e => setReason(e.target.value)}
      placeholder="e.g. On leave from tomorrow; this needs someone who knows the refund system" /></label>
    <button disabled={busy || !to || reason.trim().length < 5} onClick={() => { onHandover(to === 'manager' ? null : Number(to), reason.trim()); setReason(''); setTo(''); }}>
      {to === 'manager' ? 'Hand back' : 'Send request'}</button>
  </details>;
}

/** Work that needs two teams: record your part and pass the rest to another team. */
function HandoffForm({ busy, onHandoff }: { busy: boolean; onHandoff: (target: { team: string }, workDone: string) => void }) {
  const [team, setTeam] = useState('');
  const [done, setDone] = useState('');
  return <details className="action-form">
    <summary>Hand off to another team <small>For incidents that need two teams. The next technician continues; deadlines stay the same.</small></summary>
    <label>Team<select id="handoff-team" value={team} onChange={e => setTeam(e.target.value)}>
      <option value="">Choose a team…</option>{teams.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
    </select></label>
    <label>What you have done<textarea id="handoff-done" className="short" maxLength={2000} value={done} onChange={e => setDone(e.target.value)}
      placeholder="e.g. Payment callbacks replayed; the ledger mismatch in the booking database remains" /></label>
    <button disabled={busy || !team || done.trim().length < 10} onClick={() => { onHandoff({ team }, done.trim()); setDone(''); setTeam(''); }}>Hand off</button>
  </details>;
}

function HandoverAnswer({ busy, onAccept, onDecline }: { busy: boolean; onAccept: () => void; onDecline: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return <div className="handover-answer">
    <button disabled={busy} onClick={onAccept}>Accept and take over</button>
    <input className="inline-input" aria-label="Reason for declining" placeholder="Reason for declining (optional)" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} />
    <button className="secondary" disabled={busy} onClick={() => onDecline(reason.trim())}>Decline</button>
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
