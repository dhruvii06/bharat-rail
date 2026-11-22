import { Link } from 'react-router-dom';
import { finished, reporterRoles, type Count, type User } from '../../shared/domain';
import { useLoad } from '../auth';
import { ErrorNote, IncidentRows } from '../components/ui';
import { api } from '../data/api';

export function Overview({ user }: { user: User }) {
  const manager = user.role === 'Manager';
  const incidents = useLoad(() => api.incidents(), []);
  const technician = user.role === 'Technician';
  const report = useLoad(() => manager ? api.overview() : Promise.resolve(undefined), [manager]);
  const workload = useLoad(() => technician ? api.myWorkload() : Promise.resolve(undefined), [technician]);
  const all = incidents.data ?? [];
  // A technician's list also holds hand-overs waiting for them and incidents they worked on earlier;
  // their own figures count only what is assigned to them now.
  const items = technician ? all.filter(i => String(i.assigneeId) === String(user.id)) : all;
  const active = items.filter(i => !finished.includes(i.status));

  const metrics: [string, string | number][] = manager && report.data
    ? [['Total incidents', report.data.total], ['Open incidents', report.data.open], ['Critical (P1) open', report.data.critical], ['SLA violations', report.data.slaViolations]]
    : user.role === 'Customer'
    ? [['My reports', items.length], ['Open', items.filter(i => !finished.includes(i.status)).length],
       ['Waiting for my answer', items.filter(i => i.informationRequest).length], ['Resolved', items.filter(i => finished.includes(i.status)).length]]
    : technician
    ? [['Current workload', workload.data ? `${workload.data.workload} / ${workload.data.capacity}` : active.length],
       ['Waiting to acknowledge', active.filter(i => i.status === 'ASSIGNED').length],
       ['Critical (P1) open', active.filter(i => i.priority === 'P1').length], ['SLA breaches open', active.filter(i => i.sla === 'BREACHED').length]]
    : [['My incidents', items.length], ['Active', active.length],
       ['Critical (P1)', items.filter(i => i.priority === 'P1' && i.status !== 'CLOSED').length], ['SLA breaches', items.filter(i => i.sla === 'BREACHED').length]];

  const byService: Count[] = manager && report.data ? report.data.byService
    : Object.entries(items.reduce<Record<string, number>>((m, i) => ({ ...m, [i.serviceName]: (m[i.serviceName] ?? 0) + 1 }), {})).map(([label, count]) => ({ label, count }));

  const title = manager ? 'Operations overview' : user.role === 'Technician' ? 'My work overview' : 'My incident overview';
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">SERVICE OPERATIONS / OVERVIEW</div><h1>{title}</h1></div>
      {reporterRoles.includes(user.role) && <Link className="button-link" to="/incidents/new">Report incident</Link>}
    </div>
    <ErrorNote message={incidents.error || report.error} onRetry={() => { incidents.reload(); report.reload(); }} />
    <div className="metrics">{metrics.map(([label, value]) => <section key={label}><span>{label}</span><strong>{value}</strong></section>)}</div>
    {technician && workload.data && <p className="muted">
      Team: <strong>{workload.data.skill.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase())}</strong> ·
      {' '}{workload.data.available && workload.data.workload < workload.data.capacity
        ? <>Available for new incidents (<strong>{workload.data.capacity - workload.data.workload}</strong> more before capacity)</>
        : <strong>Not taking new incidents{workload.data.workload >= workload.data.capacity ? ' (at capacity)' : ' (marked unavailable)'}</strong>}
    </p>}
    {manager && report.data && <p className="muted">SLA compliance on finished incidents: <strong>{report.data.slaCompliancePercent ?? '—'}{report.data.slaCompliancePercent !== null && '%'}</strong>
      {report.data.averageResolutionMinutes !== null && <> · Average time to resolve: <strong>{Math.round(report.data.averageResolutionMinutes)} min</strong></>}</p>}
    <div className="section-heading"><h2>Recent incidents</h2><Link to="/incidents">View all incidents</Link></div>
    {incidents.loading && !incidents.data ? <p role="status">Loading incidents…</p> : <IncidentRows items={(technician ? active : items).slice(0, 5)} showAssignee={user.role !== 'Technician'} customer={user.role === 'Customer'} />}
    <div className="overview-bottom">
      <section><h2>Incidents by service</h2>
        {byService.map(s => <div className="service-row" key={s.label}><span>{s.label}</span><span>{s.count}</span></div>)}
        {!byService.length && <p>No service incidents to display.</p>}
      </section>
      <section><h2>Resolution workflow</h2>
        <ol className="workflow"><li>Report: priority and SLA calculated automatically</li><li>Assign: skill- or load-based strategy</li><li>Acknowledge, investigate, resolve</li><li>Reporter verifies, manager closes</li></ol>
        <p className="muted">You see the actions your role is allowed to take on each incident.</p>
      </section>
    </div>
  </>;
}
