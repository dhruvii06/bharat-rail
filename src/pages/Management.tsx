import type { Count } from '../../shared/domain';
import { useLoad } from '../auth';
import { ErrorNote, formatDate, humanize } from '../components/ui';
import { api } from '../data/api';

/** IT manager: technician workload, incident analysis and the simulated email channel. */
export function Management() {
  const overview = useLoad(() => api.overview(), []);
  const outbox = useLoad(() => api.emailOutbox(), []);
  const o = overview.data;

  return <>
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>Management</h1></div></div>
    <ErrorNote message={overview.error || outbox.error} onRetry={() => { overview.reload(); outbox.reload(); }} />

    <h2>Technician workload</h2>
    <div className="table-wrap"><table>
      <thead><tr><th>Technician</th><th>Skill</th><th>Active incidents</th><th>Experience</th><th>Available</th></tr></thead>
      <tbody>{o?.workload.map(t => <tr key={t.id}>
        <td>{t.name}<small>{t.email}</small></td><td>{humanize(t.skill)}</td>
        <td><span className={t.workload >= t.capacity ? 'sla-breach' : ''}>{t.workload} / {t.capacity}</span></td>
        <td>{t.experienceYears} yrs</td><td>{t.available ? 'Yes' : 'No'}</td>
      </tr>)}</tbody>
    </table></div>

    {o && <div className="analysis">
      <Breakdown title="By service" rows={o.byService} />
      <Breakdown title="By priority" rows={o.byPriority} />
      <Breakdown title="By status" rows={o.byStatus.map(c => ({ ...c, label: humanize(c.label) }))} />
    </div>}

    <h2>Email outbox <span className="muted">(simulated email channel)</span></h2>
    {outbox.data && !outbox.data.length && <p className="muted">No emails yet.</p>}
    {outbox.data && outbox.data.length > 0 && <div className="table-wrap"><table>
      <thead><tr><th>To</th><th>Event</th><th>Message</th><th>Sent</th></tr></thead>
      <tbody>{outbox.data.map(m => <tr key={m.id}><td>{m.recipientEmail}</td><td>{humanize(m.type)}</td><td>{m.message}</td><td>{formatDate(m.createdAt)}</td></tr>)}</tbody>
    </table></div>}
  </>;
}

function Breakdown({ title, rows }: { title: string; rows: Count[] }) {
  return <section><h2>{title}</h2>{rows.map(r => <div className="service-row" key={r.label}><span>{r.label}</span><span>{r.count}</span></div>)}{!rows.length && <p className="muted">No incidents.</p>}</section>;
}
