import { useEffect, useState } from 'react';
import { priorities, slaLabel, slaStates, statuses, type User } from '../../shared/domain';
import { useLoad } from '../auth';
import { ErrorNote, IncidentRows, humanize } from '../components/ui';
import { api, type IncidentFilters } from '../data/api';

/** Incident queue with 9 filters, applied by the server so results respect the user's role. */
export function IncidentList({ user }: { user: User }) {
  const [filters, setFilters] = useState<IncidentFilters>({});
  const [search, setSearch] = useState('');
  useEffect(() => { const t = setTimeout(() => setFilters(f => ({ ...f, q: search || undefined })), 300); return () => clearTimeout(t); }, [search]);

  const list = useLoad(() => api.incidents(filters), [JSON.stringify(filters)]);
  const services = useLoad(() => api.services(), []);
  const categories = useLoad(() => api.categories(), []);
  const technicians = useLoad(() => user.role === 'Manager' ? api.technicians() : Promise.resolve([]), [user.role]);
  const set = (key: keyof IncidentFilters) => (value: string) => setFilters(f => ({ ...f, [key]: value || undefined }));

  const selects: [string, keyof IncidentFilters, [string, string][]][] = [
    ['Status', 'status', statuses.map(s => [s, humanize(s)])],
    ...(user.role === 'Customer' ? [] : [['Priority', 'priority', priorities.map(p => [p, p])] as [string, keyof IncidentFilters, [string, string][]]]),
    ['Service', 'serviceId', (services.data ?? []).map(s => [String(s.id), s.name])],
    ['Category', 'category', (categories.data ?? []).map(c => [c.code, c.label])],
    ...(user.role === 'Customer' ? [] : [['SLA', 'sla', slaStates.map(s => [s, slaLabel[s]])] as [string, keyof IncidentFilters, [string, string][]]])
  ];
  if (user.role === 'Manager') selects.push(['Technician', 'technicianId', (technicians.data ?? []).map(t => [String(t.id), t.name])]);

  return <>
    <div className="page-heading"><div><div className="eyebrow">SERVICE OPERATIONS / INCIDENTS</div><h1>{user.role === 'Technician' ? 'My assignments' : 'Incident queue'}</h1></div></div>
    <div className="filters">
      <label>Search<input id="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="ID, title or description" /></label>
      {selects.map(([label, key, options]) => <label key={key}>{label}
        <select id={`filter-${key}`} value={filters[key] ?? ''} onChange={e => set(key)(e.target.value)}>
          <option value="">All</option>{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
        </select></label>)}
      <label>From<input id="filter-from" type="date" value={filters.from ?? ''} onChange={e => set('from')(e.target.value)} /></label>
      <label>To<input id="filter-to" type="date" value={filters.to ?? ''} onChange={e => set('to')(e.target.value)} /></label>
    </div>
    <ErrorNote message={list.error} onRetry={list.reload} />
    <p role="status">{list.loading ? 'Loading…' : `${list.data?.length ?? 0} result(s)`}</p>
    {list.data && <IncidentRows items={list.data} showAssignee={user.role !== 'Technician'} customer={user.role === 'Customer'} />}
  </>;
}
