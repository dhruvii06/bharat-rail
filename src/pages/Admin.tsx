import { useState, type FormEvent, type ReactNode } from 'react';
import { criticalities, teams, type AuditSearchEntry, type Category, type Criticality, type Role, type SlaPolicy } from '../../shared/domain';
import { useLoad } from '../auth';
import { Link } from 'react-router-dom';
import { ErrorNote, formatDate, humanize } from '../components/ui';
import { api } from '../data/api';

// IT manager settings: accounts, technicians, service catalogue, SLA policies, categories and the
// default assignment strategy. Every change goes through the API, which checks the role again.

type Tab = 'users' | 'technicians' | 'services' | 'sla' | 'categories' | 'assignment' | 'audit';
const tabs: [Tab, string][] = [['users', 'Users'], ['technicians', 'Technicians'], ['services', 'Services'], ['sla', 'SLA policies'], ['categories', 'Categories'], ['assignment', 'Assignment'], ['audit', 'Audit log']];

export function Admin() {
  const [tab, setTab] = useState<Tab>('users');
  return <>
    <div className="page-heading"><div><div className="eyebrow">ADMINISTRATION</div><h1>Settings</h1></div></div>
    <div className="admin-tabs" role="tablist">{tabs.map(([key, label]) =>
      <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>{label}</button>)}</div>
    {tab === 'users' && <Users />}
    {tab === 'technicians' && <Technicians />}
    {tab === 'services' && <Services />}
    {tab === 'sla' && <SlaPolicies />}
    {tab === 'categories' && <Categories />}
    {tab === 'assignment' && <Assignment />}
    {tab === 'audit' && <AuditLog />}
  </>;
}

/** Runs one change at a time and shows its error or a short confirmation. */
function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function run(work: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setDone('');
    try { await work(); setDone(message); return true; }
    catch (e) {
      const err = e as Error & { fieldErrors?: Record<string, string> };
      setError(err.fieldErrors ? Object.entries(err.fieldErrors).map(([f, m]) => `${humanize(f)}: ${m}`).join(' ') : err.message);
      return false;
    } finally { setBusy(false); }
  }
  const status: ReactNode = <>{error && <p role="alert" className="error">{error}</p>}{done && <p role="status" className="saved">{done}</p>}</>;
  return { busy, run, status };
}

function Users() {
  const users = useLoad(() => api.admin.users(), []);
  const { busy, run, status } = useAction();
  const blank = { name: '', email: '', password: '', role: 'Employee' as Role, department: '', skill: '', experienceYears: 1 };
  const [form, setForm] = useState(blank);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setForm(f => ({ ...f, [k]: v }));

  async function create(e: FormEvent) {
    e.preventDefault();
    const ok = await run(async () => {
      const r = await api.admin.createUser({ ...form, department: form.department || undefined, skill: form.role === 'Technician' ? form.skill : undefined });
      if (r.warning) throw new Error(r.warning);
    }, `Account created for ${form.email}.`);
    if (ok) { setForm(blank); users.reload(); }
  }

  return <>
    <h2>Add an account</h2>
    <form className="admin-form" onSubmit={create}>
      <label>Full name<input id="new-name" required minLength={2} value={form.name} onChange={e => set('name', e.target.value)} /></label>
      <label>Email<input id="new-email" type="email" required value={form.email} onChange={e => set('email', e.target.value)} /></label>
      <label>Temporary password<input id="new-password" type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={e => set('password', e.target.value)} /></label>
      <label>Role<select id="new-role" value={form.role} onChange={e => set('role', e.target.value as Role)}>
        <option value="Employee">Employee</option><option value="Technician">Technician</option><option value="Manager">IT Manager</option><option value="Customer">Customer</option>
      </select></label>
      <label>Department<input id="new-department" value={form.department} onChange={e => set('department', e.target.value)} /></label>
      {form.role === 'Technician' && <>
        <label>Team<select id="new-skill" required value={form.skill} onChange={e => set('skill', e.target.value)}>
          <option value="">Choose a team</option>{teams.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
        </select></label>
        <label>Experience (years)<input id="new-experience" type="number" min={0} max={50} value={form.experienceYears} onChange={e => set('experienceYears', Number(e.target.value))} /></label>
      </>}
      <button disabled={busy}>Create account</button>
    </form>
    <p className="muted">Share the temporary password with the person yourself. They must choose their own password the first time they sign in.</p>
    {status}
    <h2>Accounts</h2>
    <ErrorNote message={users.error} onRetry={users.reload} />
    <div className="table-wrap"><table>
      <thead><tr><th>Name</th><th>Role</th><th>Department</th><th>Status</th><th></th></tr></thead>
      <tbody>{users.data?.map(u => <tr key={u.id}>
        <td>{u.name}<small>{u.email}</small></td>
        <td>{u.role === 'Manager' ? 'IT Manager' : u.role}{u.mustChangePassword && <small>Temporary password</small>}</td>
        <td>{u.department ?? '—'}</td>
        <td><span className={u.active ? 'pill' : 'pill off'}>{u.active ? 'Active' : 'Deactivated'}</span></td>
        <td><button className="secondary" disabled={busy} onClick={async () => {
          if (await run(() => api.admin.updateUser(u.id, { active: !u.active }), `${u.name} ${u.active ? 'deactivated' : 'reactivated'}.`)) users.reload();
        }}>{u.active ? 'Deactivate' : 'Reactivate'}</button></td>
      </tr>)}</tbody>
    </table></div>
  </>;
}

function Technicians() {
  const technicians = useLoad(() => api.technicians(), []);
  const { busy, run, status } = useAction();
  const save = async (id: number, profile: { skill?: string; experienceYears?: number; available?: boolean }, label: string) => {
    if (await run(() => api.admin.saveTechnician(id, profile), `${label} updated.`)) technicians.reload();
  };
  return <>
    <p className="muted">Assignments follow team expertise and availability. Add technician accounts under Users.</p>
    {status}
    <ErrorNote message={technicians.error} onRetry={technicians.reload} />
    <div className="table-wrap"><table>
      <thead><tr><th>Technician</th><th>Team</th><th>Experience</th><th>Workload</th><th>Available</th></tr></thead>
      <tbody>{technicians.data?.map(t => <tr key={t.id}>
        <td>{t.name}<small>{t.email}</small></td>
        <td><select className="inline-input" aria-label={`Team for ${t.name}`} disabled={busy} value={t.skill} onChange={e => void save(t.id, { skill: e.target.value }, t.name)}>
          {teams.map(team => <option key={team.code} value={team.code}>{team.label}</option>)}
          {!teams.some(team => team.code === t.skill) && <option value={t.skill}>{humanize(t.skill)}</option>}
        </select></td>
        <td><input className="inline-input" type="number" min={0} max={50} aria-label={`Experience for ${t.name}`} defaultValue={t.experienceYears} disabled={busy}
          onBlur={e => Number(e.target.value) !== t.experienceYears && void save(t.id, { experienceYears: Number(e.target.value) }, t.name)} /> yrs</td>
        <td>{t.workload} / {t.capacity}</td>
        <td><label className="checkbox"><input type="checkbox" checked={t.available} disabled={busy} onChange={e => void save(t.id, { available: e.target.checked }, t.name)} />{t.available ? 'Yes' : 'No'}</label></td>
      </tr>)}</tbody>
    </table></div>
  </>;
}

function Services() {
  const services = useLoad(() => api.admin.services(), []);
  const categories = useLoad(() => api.categories(), []);
  const { busy, run, status } = useAction();
  const blank = { name: '', category: '', criticality: 'HIGH' as Criticality, tatkalBookingPath: false };
  const [form, setForm] = useState(blank);

  async function create(e: FormEvent) {
    e.preventDefault();
    if (await run(() => api.admin.createService(form), `Service ${form.name} added.`)) { setForm(blank); services.reload(); }
  }
  return <>
    <h2>Add a service</h2>
    <form className="admin-form" onSubmit={create}>
      <label>Service name<input id="service-name" required minLength={3} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Waitlist confirmation engine" /></label>
      <label>Category<select id="service-category" required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
        <option value="">Choose</option>{categories.data?.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
      </select></label>
      <label>Business criticality<select id="service-criticality" value={form.criticality} onChange={e => setForm(f => ({ ...f, criticality: e.target.value as Criticality }))}>
        {criticalities.map(c => <option key={c} value={c}>{humanize(c)}</option>)}
      </select></label>
      <label className="checkbox"><input id="service-tatkal" type="checkbox" checked={form.tatkalBookingPath} onChange={e => setForm(f => ({ ...f, tatkalBookingPath: e.target.checked }))} />Tatkal bookings depend on it</label>
      <button disabled={busy}>Add service</button>
    </form>
    {status}
    <p className="muted">Service criticality influences incident priority. Enable the Tatkal booking path only for services needed to complete Tatkal bookings.</p>
    <div className="table-wrap"><table>
      <thead><tr><th>Service</th><th>Category</th><th>Business criticality</th><th>Tatkal booking path</th></tr></thead>
      <tbody>{services.data?.map(s => <tr key={s.id}>
        <td>{s.name}</td><td>{humanize(s.category)}</td>
        <td><select className="inline-input" aria-label={`Criticality for ${s.name}`} disabled={busy} value={s.criticality}
          onChange={async e => { if (await run(() => api.admin.updateService(s.id, { criticality: e.target.value as Criticality }), `${s.name} updated.`)) services.reload(); }}>
          {criticalities.map(c => <option key={c} value={c}>{humanize(c)}</option>)}
        </select> <small>counts {s.criticalityScore}</small></td>
        <td><label className="checkbox"><input type="checkbox" checked={s.tatkalBookingPath} disabled={busy} aria-label={`Tatkal booking path for ${s.name}`}
          onChange={async e => { if (await run(() => api.admin.updateService(s.id, { tatkalBookingPath: e.target.checked }), `${s.name} updated.`)) services.reload(); }} />{s.tatkalBookingPath ? 'Yes' : 'No'}</label></td>
      </tr>)}</tbody>
    </table></div>
  </>;
}

function SlaPolicies() {
  const policies = useLoad(() => api.admin.slaPolicies(), []);
  const { busy, run, status } = useAction();
  return <>
    <p className="muted">Targets apply to incidents reported after a change. Existing incidents keep the deadlines they were given.</p>
    {status}
    <ErrorNote message={policies.error} onRetry={policies.reload} />
    <div className="table-wrap"><table>
      <thead><tr><th>Priority</th><th>Response target (minutes)</th><th>Resolution target (minutes)</th><th></th></tr></thead>
      <tbody>{policies.data?.map(p => <SlaRow key={p.priority} policy={p} busy={busy}
        onSave={async (r, res) => { if (await run(() => api.admin.updateSlaPolicy(p.priority, r, res), `${p.priority} targets saved.`)) policies.reload(); }} />)}</tbody>
    </table></div>
  </>;
}

function SlaRow({ policy, busy, onSave }: { policy: SlaPolicy; busy: boolean; onSave: (response: number, resolution: number) => void }) {
  const [response, setResponse] = useState(policy.responseMinutes);
  const [resolution, setResolution] = useState(policy.resolutionMinutes);
  const changed = response !== policy.responseMinutes || resolution !== policy.resolutionMinutes;
  return <tr>
    <td><span className={`badge ${policy.priority}`}>{policy.priority}</span></td>
    <td><input className="inline-input" type="number" min={1} aria-label={`${policy.priority} response minutes`} value={response} onChange={e => setResponse(Number(e.target.value))} /></td>
    <td><input className="inline-input" type="number" min={1} aria-label={`${policy.priority} resolution minutes`} value={resolution} onChange={e => setResolution(Number(e.target.value))} /></td>
    <td><button className="secondary" disabled={busy || !changed} onClick={() => onSave(response, resolution)}>Save</button></td>
  </tr>;
}

function Categories() {
  const categories = useLoad(() => api.admin.categories(), []);
  const { busy, run, status } = useAction();
  const [form, setForm] = useState({ label: '', team: '' });
  async function create(e: FormEvent) {
    e.preventDefault();
    if (await run(() => api.admin.createCategory(form.label, form.team), `Category ${form.label} added.`)) { setForm({ label: '', team: '' }); categories.reload(); }
  }
  return <>
    <h2>Add a category</h2>
    <form className="admin-form" onSubmit={create}>
      <label>Name<input id="category-label" required minLength={2} maxLength={60} value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="e.g. Mobile app" /></label>
      <label>Handled by<select id="category-team" required value={form.team} onChange={e => setForm(f => ({ ...f, team: e.target.value }))}>
        <option value="">Choose a team</option>{teams.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
      </select></label>
      <button disabled={busy}>Add category</button>
    </form>
    <p className="muted">Switched-off categories disappear from the report form. Each category goes to technicians of the team that handles it. Categories handled by Security are treated as security incidents (P1).</p>
    {status}
    <div className="table-wrap"><table>
      <thead><tr><th>Code</th><th>Label shown to users</th><th>Handled by</th><th>Available</th></tr></thead>
      <tbody>{categories.data?.map(c => <CategoryRow key={c.code} category={c} busy={busy}
        onSave={async patch => { if (await run(() => api.admin.updateCategory(c.code, patch), `${c.code} updated.`)) categories.reload(); }} />)}</tbody>
    </table></div>
  </>;
}

function CategoryRow({ category, busy, onSave }: { category: Category; busy: boolean; onSave: (patch: { label?: string; active?: boolean; team?: string }) => void }) {
  const [label, setLabel] = useState(category.label);
  return <tr>
    <td>{category.code}</td>
    <td><input className="inline-input" style={{ maxWidth: 220 }} aria-label={`Label for ${category.code}`} value={label} onChange={e => setLabel(e.target.value)} />
      {label !== category.label && <button className="secondary" disabled={busy} onClick={() => onSave({ label })}>Save</button>}</td>
    <td><select className="inline-input" aria-label={`Team for ${category.code}`} disabled={busy} value={category.team} onChange={e => onSave({ team: e.target.value })}>
      {teams.map(t => <option key={t.code} value={t.code}>{t.label}</option>)}
    </select></td>
    <td><label className="checkbox"><input type="checkbox" checked={category.active} disabled={busy} onChange={e => onSave({ active: e.target.checked })} />{category.active ? 'On' : 'Off'}</label></td>
  </tr>;
}

const auditActions = ['INCIDENT_CREATED', 'CUSTOMER_ASSESSMENT', 'PRIORITY_ASSIGNED', 'POSSIBLE_DUPLICATE', 'TECHNICIAN_ASSIGNED', 'ASSIGNMENT_REASON',
  'STATUS_CHANGED', 'INCIDENT_RESOLVED', 'INCIDENT_EDITED', 'PRIORITY_CHANGED', 'INFO_REQUESTED', 'INFO_PROVIDED', 'MESSAGE', 'NOTE', 'FEEDBACK',
  'SLA_WARNING', 'SLA_VIOLATED', 'ESCALATED'];

/** Search the history of every incident: who did what and when. */
function AuditLog() {
  const blank = { q: '', action: '', incidentId: '', from: '', to: '' };
  const [form, setForm] = useState(blank);
  const [filters, setFilters] = useState(blank);
  const entries = useLoad(() => api.audit(filters), [filters]);
  const set = (k: keyof typeof blank, v: string) => setForm(f => ({ ...f, [k]: v }));
  return <>
    <form className="admin-form" onSubmit={e => { e.preventDefault(); setFilters(form); }}>
      <label>Text<input id="audit-q" value={form.q} onChange={e => set('q', e.target.value)} placeholder="Words in the entry or incident title" /></label>
      <label>Action<select id="audit-action" value={form.action} onChange={e => set('action', e.target.value)}>
        <option value="">Any</option>{auditActions.map(a => <option key={a} value={a}>{humanize(a)}</option>)}
      </select></label>
      <label>Incident<input id="audit-incident" value={form.incidentId} onChange={e => set('incidentId', e.target.value.toUpperCase())} placeholder="INC-1001" /></label>
      <label>From<input id="audit-from" type="date" value={form.from} onChange={e => set('from', e.target.value)} /></label>
      <label>To<input id="audit-to" type="date" value={form.to} onChange={e => set('to', e.target.value)} /></label>
      <button>Search</button>
      <button type="button" className="secondary" onClick={() => { setForm(blank); setFilters(blank); }}>Clear</button>
    </form>
    <ErrorNote message={entries.error} onRetry={entries.reload} />
    {entries.data && <p className="muted">{entries.data.length === 0 ? 'No entries match.' : `${entries.data.length} entries, newest first${entries.data.length === 200 ? ' (first 200 shown)' : ''}.`}</p>}
    <div className="table-wrap"><table>
      <thead><tr><th>When</th><th>Incident</th><th>Action</th><th>By</th><th>Details</th></tr></thead>
      <tbody>{entries.data?.map((a: AuditSearchEntry) => <tr key={a.id}>
        <td>{formatDate(a.at)}</td>
        <td><Link to={`/incidents/${a.incidentId}`}>{a.incidentId}</Link></td>
        <td>{humanize(a.action)}{a.fromStatus && a.toStatus && a.fromStatus !== a.toStatus && <small>{humanize(a.fromStatus)} → {humanize(a.toStatus)}</small>}</td>
        <td>{a.actorName ?? 'System'}</td>
        <td>{a.description ?? '—'}</td>
      </tr>)}</tbody>
    </table></div>
  </>;
}

function Assignment() {
  const settings = useLoad(() => api.admin.settings(), []);
  const { busy, run, status } = useAction();
  const describe: Record<string, string> = {
    skill: 'Skill-based: the first available technician whose skill matches the incident category.',
    load: 'Load-based: the matching technician with the fewest active incidents.'
  };
  return <>
    <p className="muted">Used when a manager presses Assign without choosing a strategy or technician.</p>
    {status}
    {settings.data && <div className="admin-form">
      {settings.data.assignmentStrategies.map(s => <label key={s} className="checkbox">
        <input type="radio" name="strategy" checked={settings.data!.defaultAssignmentStrategy === s} disabled={busy}
          onChange={async () => { if (await run(() => api.admin.updateSettings(s), 'Default strategy saved.')) settings.reload(); }} />
        {describe[s] ?? s}
      </label>)}
    </div>}
  </>;
}
