import { useState, type ReactNode } from 'react';
import { teams } from '../../shared/domain';

// Small HTML/CSS charts for the IT manager. Colours come from the --viz-* tokens in styles.css
// (validated for colour-blind separation and contrast on both theme surfaces). Every mark has a
// hover / keyboard tooltip, and each chart can be shown as a table instead.

/** Rounds the axis maximum up to a readable step and returns the gridline values. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / 4;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 5, 10].map(m => m * pow).find(s => s >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

const monthName = (ym: string, withYear: boolean) => {
  const [y, m] = ym.split('-').map(Number);
  const name = new Date(y, m - 1, 1).toLocaleString('en', { month: 'short' });
  return withYear ? `${name} ${y}` : name;
};

function ChartFrame({ title, subtitle, legend, table, children }: { title: string; subtitle?: ReactNode; legend?: ReactNode; table: ReactNode; children: ReactNode }) {
  const [asTable, setAsTable] = useState(false);
  return <section className="viz">
    <div className="viz-head">
      <div><h2>{title}</h2>{subtitle && <p className="muted">{subtitle}</p>}</div>
      <button type="button" className="link-button" onClick={() => setAsTable(t => !t)}>{asTable ? 'Show chart' : 'Show as table'}</button>
    </div>
    {asTable ? <div className="table-wrap">{table}</div> : <>{legend}{children}</>}
  </section>;
}

/** Incidents reported per month (single series, so no legend: the title names it). */
export function MonthlyReportedChart({ data }: { data: { month: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const scale = ticks(Math.max(0, ...data.map(d => d.count)));
  const top = scale[scale.length - 1];
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const range = data.length ? `${monthName(data[0].month, true)} – ${monthName(data[data.length - 1].month, true)}` : '';
  return <ChartFrame title="Incidents reported per month" subtitle={`${total} reported, ${range}`}
    table={<table><thead><tr><th>Month</th><th>Incidents reported</th></tr></thead>
      <tbody>{data.map(d => <tr key={d.month}><td>{monthName(d.month, true)}</td><td>{d.count}</td></tr>)}</tbody></table>}>
    <div className="viz-columns" role="img" aria-label={`Incidents reported per month: ${data.map(d => `${monthName(d.month, true)} ${d.count}`).join(', ')}`}>
      <div className="viz-yaxis" aria-hidden="true">{[...scale].reverse().map(t => <span key={t}>{t}</span>)}</div>
      <div className="viz-plot">
        {scale.map(t => <div key={t} className="viz-grid" style={{ bottom: `${(t / top) * 100}%` }} aria-hidden="true" />)}
        {data.map((d, i) => <div key={d.month} className="viz-col" tabIndex={0}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
          aria-label={`${monthName(d.month, true)}: ${d.count} reported`}>
          <div className="viz-bar" style={{ height: `${(d.count / top) * 100}%` }} />
          {hover === i && <div className="viz-tip" role="tooltip"><strong>{monthName(d.month, true)}</strong>{d.count} reported</div>}
        </div>)}
      </div>
      <div />
      <div className="viz-xaxis" aria-hidden="true">{data.map(d => <span key={d.month}>{monthName(d.month, false)}</span>)}</div>
    </div>
  </ChartFrame>;
}

/** Each technician's resolved and still-open incidents, stacked on one bar. */
export function TechnicianProgressChart({ data }: { data: { id: number; name: string; team: string; completed: number; ongoing: number }[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const top = ticks(Math.max(0, ...data.map(d => d.completed + d.ongoing))).at(-1)!;
  const teamLabel = (code: string) => teams.find(t => t.code === code)?.label ?? code;
  const legend = <div className="viz-legend">
    <span><i className="viz-swatch s1" />Completed</span><span><i className="viz-swatch s2" />Ongoing</span>
  </div>;
  return <ChartFrame title="Technician progress" subtitle="Incidents each technician resolved, and those assigned to them that are still open" legend={legend}
    table={<table><thead><tr><th>Technician</th><th>Team</th><th>Completed</th><th>Ongoing</th></tr></thead>
      <tbody>{data.map(t => <tr key={t.id}><td>{t.name}</td><td>{teamLabel(t.team)}</td><td>{t.completed}</td><td>{t.ongoing}</td></tr>)}</tbody></table>}>
    {!data.length && <p className="muted">No technicians yet.</p>}
    <div className="viz-rows">{data.map(t => {
      const seg = (kind: 'completed' | 'ongoing', value: number, cls: string) => {
        if (!value) return null;
        const key = `${t.id}-${kind}`;
        return <div className={`viz-seg ${cls}`} style={{ width: `${(value / top) * 100}%` }} tabIndex={0}
          aria-label={`${t.name}: ${value} ${kind}`}
          onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(key)} onBlur={() => setHover(null)}>
          {hover === key && <div className="viz-tip" role="tooltip"><strong>{t.name}</strong>{value} {kind}</div>}
        </div>;
      };
      return <div className="viz-row" key={t.id}>
        <div className="viz-row-label">{t.name}<small>{teamLabel(t.team)}</small></div>
        <div className="viz-track">{seg('completed', t.completed, 's1')}{seg('ongoing', t.ongoing, 's2')}</div>
        <span className="viz-value">{t.completed} done · {t.ongoing} ongoing</span>
      </div>;
    })}</div>
  </ChartFrame>;
}
