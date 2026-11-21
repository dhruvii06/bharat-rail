import { Link } from 'react-router-dom';
import { slaLabel, type Incident, type SlaState } from '../../shared/domain';

export const formatDate = (value: string | null | undefined) => value ? new Date(value).toLocaleString() : '—';
export const humanize = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());

export function PriorityBadge({ priority }: { priority: string | null }) {
  return <span className={`badge ${priority ?? ''}`}>{priority ?? '—'}</span>;
}

export function StatusTag({ status }: { status: string }) {
  return <span className="status-tag">{status.replaceAll('_', ' ')}</span>;
}

export function SlaTag({ sla }: { sla: SlaState }) {
  const cls = sla === 'BREACHED' ? 'sla-breach' : sla === 'AT_RISK' ? 'sla-risk' : 'sla-normal';
  return <span className={cls}>{slaLabel[sla]}</span>;
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null;
  return <p role="alert" className="error">{message} {onRetry && <button className="link-button" onClick={onRetry}>Retry</button>}</p>;
}

export function IncidentRows({ items, showAssignee = true }: { items: Incident[]; showAssignee?: boolean }) {
  if (!items.length) return <div className="empty-state"><h2>No incidents to display</h2><p>Reported incidents will appear here. Adjust the filters to see other work.</p></div>;
  return <div className="table-wrap"><table>
    <thead><tr><th>Incident</th><th>Service</th><th>Priority</th><th>Status</th>{showAssignee && <th>Assigned to</th>}<th>SLA</th></tr></thead>
    <tbody>{items.map(i => <tr key={i.id}>
      <td><Link to={`/incidents/${i.id}`}>{i.title}</Link><small>{i.id} · {formatDate(i.createdAt)}</small></td>
      <td>{i.serviceName}<small>{humanize(i.category)}</small></td>
      <td><PriorityBadge priority={i.priority} /></td>
      <td><StatusTag status={i.status} /></td>
      {showAssignee && <td>{i.assigneeName ?? <span className="muted">Unassigned</span>}</td>}
      <td><SlaTag sla={i.sla} /></td>
    </tr>)}</tbody>
  </table></div>;
}
