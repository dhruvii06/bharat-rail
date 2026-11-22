import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLoad } from '../auth';
import { ErrorNote } from '../components/ui';
import { api } from '../data/api';
import { analyzeFailure, identifyService, SERVICE_TOPOLOGY } from '../../shared/impactSimulator';

const labelFor = (id: string) => SERVICE_TOPOLOGY.find(s => s.id === id)?.label ?? id;

/**
 * Manager-only training simulation. No changes to live incident status or the database.
 * This is a model of possible dependencies, not measured service health.
 */
export function ImpactSimulator() {
  const incidents = useLoad(() => api.incidents(), []);
  const [selectedService, setSelectedService] = useState('UPI_PAYMENT_GATEWAY');
  const [selectedIncident, setSelectedIncident] = useState('');
  const report = useMemo(() => analyzeFailure(selectedService), [selectedService]);
  const activeIncident = incidents.data?.find(i => i.id === selectedIncident);
  const incidentMatch = activeIncident ? identifyService(activeIncident.serviceName) : null;
  const depthOne = report.affected.filter(s => s.depth === 1);
  const downstream = report.affected.filter(s => s.depth > 1);
  const affectedIds = new Set(report.affected.map(s => s.id));

  function selectIncident(id: string) {
    setSelectedIncident(id);
    if (!id) return;
    const incident = incidents.data?.find(i => i.id === id);
    if (!incident) return;
    const matched = identifyService(incident.serviceName);
    if (matched) setSelectedService(matched);
  }

  return <div className="impact-page">
    <div className="page-heading">
      <div>
        <div className="eyebrow">MANAGEMENT / ADVANCED OPERATIONS</div>
        <h1>Incident Impact Simulator</h1>
        <p className="muted">Explore the potential downstream blast radius of a railway IT service failure.</p>
      </div>
      <span className="impact-demo-pill">TRAINING SIMULATION</span>
    </div>
    <div className="impact-controls">
      <label>Simulate failure at
        <select id="impact-service" value={selectedService} onChange={e => { setSelectedService(e.target.value); setSelectedIncident(''); }}>
          {SERVICE_TOPOLOGY.map(s => <option value={s.id} key={s.id}>{s.label}</option>)}
        </select>
      </label>
      <label>Or examine an existing incident (optional)
        <select id="impact-incident" value={selectedIncident} onChange={e => selectIncident(e.target.value)}>
          <option value="">Select an incident</option>
          {incidents.data?.map(i => <option key={i.id} value={i.id}>{i.id}: {i.title}</option>)}
        </select>
      </label>
    </div>
    <ErrorNote message={incidents.error} onRetry={incidents.reload} />
    {selectedIncident && activeIncident && <p className="muted">
      Incident <Link to={'/incidents/' + encodeURIComponent(activeIncident.id)}>{activeIncident.id}</Link>:
      {' '}{incidentMatch
        ? 'Matched ' + labelFor(incidentMatch) + ' to the demonstration graph.'
        : 'The service "' + activeIncident.serviceName + '" is not in this graph. Showing your manually selected failure only.'}
    </p>}

    <div className="impact-metrics">
      <section><span>Direct dependents</span><strong>{report.directCount}</strong></section>
      <section><span>Indirect dependents</span><strong>{report.indirectCount}</strong></section>
      <section><span>Total at risk</span><strong>{report.affected.length}</strong></section>
      <section><span>Advisory severity</span><strong className={'impact-priority ' + report.advisoryPriority}>{report.advisoryPriority}</strong></section>
    </div>

    <div className="impact-card">
      <div className="section-heading">
        <h2>Dependency cascade</h2><span className="muted">Arrows indicate hypothetical downstream dependence</span>
      </div>
      <div className="impact-graph" aria-label="Dependency impact graph">
        <div className="impact-graph-col">
          <div className="impact-stage">FAILURE SOURCE</div>
          <div className="impact-node failed">
            <strong>{report.failed.label}</strong>
            <span>{report.failed.owner}</span>
            <em>Simulated unavailable</em>
          </div>
        </div>
        <div className="impact-graph-arrow" aria-hidden="true">→</div>
        <div className="impact-graph-col">
          <div className="impact-stage">DIRECTLY AT RISK</div>
          {depthOne.length ? depthOne.map(s => <div className="impact-node direct" key={s.id}>
            <strong>{s.label}</strong><span>{s.owner}</span><em>1 hop</em>
          </div>) : <div className="impact-node clear">No direct dependencies modelled</div>}
        </div>
        <div className="impact-graph-arrow" aria-hidden="true">→</div>
        <div className="impact-graph-col">
          <div className="impact-stage">INDIRECTLY AT RISK</div>
          {downstream.length ? downstream.map(s => <div className="impact-node indirect" key={s.id}>
            <strong>{s.label}</strong><span>{s.owner}</span><em>{s.depth} hops</em>
          </div>) : <div className="impact-node clear">No indirect dependencies modelled</div>}
        </div>
      </div>
    </div>

    <div className="impact-bottom">
      <section className="impact-card">
        <h2>Explainable propagation paths</h2>
        <p className="muted">Shortest modeled path from the failed service to every potentially affected service.</p>
        {report.affected.length
          ? <ol className="impact-paths">{report.affected.map(s => <li key={s.id}>
              <strong>{s.label}</strong><small>{s.path.map(labelFor).join(' → ')}</small>
            </li>)}</ol>
          : <p>No dependent services are modeled for this outage.</p>}
      </section>
      <section className="impact-card">
        <h2>Suggested IT manager response</h2>
        <ol className="workflow">{report.recommendations.map(action => <li key={action}>{action}</li>)}</ol>
        <p className="muted">The advisory severity is not the official priority of an incident. The normal priority engine remains authoritative.</p>
        {affectedIds.has('TATKAL_BOOKING_ENGINE') && <p className="warning-box">Tatkal Booking may be impacted. Validate booking and payment services before communicating with passengers.</p>}
      </section>
    </div>
  </div>;
}
