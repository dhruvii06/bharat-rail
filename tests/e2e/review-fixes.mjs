// End-to-end: incident editing, the audit log search, categories added by the IT manager, and the
// Tatkal rule limited to services Tatkal bookings depend on.
import { check, finish, j, login, runId } from './lib.mjs';

const mgr = await login('admin1@demo.local'), emp = await login('support1@demo.local'), ops = await login('ops@demo.local');
const appTech = await login('app.tech@demo.local'), cust = await login('customer@demo.local');

// ---------------- Tatkal rule only on the booking path ----------------
let r = await j('GET', '/services', emp);
const onPath = r.body.filter(s => s.tatkalBookingPath).map(s => s.name).sort();
check('booking engine, payment gateway and core database are on the Tatkal booking path',
  onPath.includes('TATKAL_BOOKING_ENGINE') && onPath.includes('UPI_PAYMENT_GATEWAY') && onPath.includes('NGET_CORE_DATABASE') && !onPath.includes('E_CATERING_PORTAL'), onPath.join(', '));
const catering = r.body.find(s => s.name === 'E_CATERING_PORTAL');
r = await j('POST', '/incidents', emp, { title: 'Catering menu not loading', description: 'Menu page spins forever during the Tatkal hour', serviceId: catering.id, category: 'APPLICATION', impact: 3, urgency: 3, tatkalWindow: true });
let m = r.body.incident;
check('Tatkal window ignored for a service outside the booking path (3x3x1 = 9 gives P3)', m.priority === 'P3' && m.tatkalWindow === false, `${m.priority}, tatkal ${m.tatkalWindow}`);

r = await j('POST', '/admin/services', mgr, { name: `Seat map ${runId}`, category: 'APPLICATION', criticality: 'LOW', tatkalBookingPath: true });
const seatMap = r.body;
check('IT manager adds a low-criticality service on the Tatkal booking path', r.status === 201 && seatMap.tatkalBookingPath === true && seatMap.criticalityScore === 1);
r = await j('POST', '/incidents', emp, { title: 'Seat map blank in Tatkal', description: 'Seat map is blank so Tatkal bookings cannot pick berths', serviceId: seatMap.id, category: 'APPLICATION', impact: 3, urgency: 3, tatkalWindow: true });
check('the same answers on a booking-path service get the Tatkal P1 override', r.body.incident.priority === 'P1' && r.body.incident.tatkalWindow === true, r.body.incident.priorityReason);
r = await j('PATCH', `/admin/services/${seatMap.id}`, mgr, { tatkalBookingPath: false });
check('IT manager can take a service off the booking path', r.body.tatkalBookingPath === false);
r = await j('POST', '/incidents', emp, { title: 'Seat map blank again', description: 'Seat map is blank again for Tatkal users', serviceId: seatMap.id, category: 'APPLICATION', impact: 3, urgency: 3, tatkalWindow: true });
check('after that the override no longer applies', r.body.incident.priority === 'P3');

// ---------------- Categories added by the IT manager ----------------
r = await j('POST', '/admin/categories', mgr, { label: `Mobile app ${runId}`, team: 'APPLICATION' });
const mobile = r.body;
check('IT manager adds a category handled by the application team', r.status === 201 && mobile.code === `MOBILE_APP_${runId.toUpperCase()}` && mobile.team === 'APPLICATION' && mobile.standard === false && mobile.active, mobile.code);
check('a duplicate name is refused', (await j('POST', '/admin/categories', mgr, { label: `mobile APP ${runId}`, team: 'NETWORK' })).status === 409);
check('an unknown team is refused', (await j('POST', '/admin/categories', mgr, { label: `Kiosks ${runId}`, team: 'PLUMBING' })).status === 422);
check('a team is required', (await j('POST', '/admin/categories', mgr, { label: `Kiosks ${runId}` })).status === 422);
check('employees cannot add categories', (await j('POST', '/admin/categories', emp, { label: `Kiosks ${runId}`, team: 'NETWORK' })).status === 403);
check('reporters can choose the new category', (await j('GET', '/categories', emp)).body.some(c => c.code === mobile.code));
r = await j('POST', '/incidents', emp, { title: 'App crashes on launch', description: 'The Android app crashes right after the splash screen', serviceId: 1, category: mobile.code, impact: 2, urgency: 2 });
const mobileIncident = r.body.incident.id;
check('an incident can be reported in it', r.status === 201 && r.body.incident.category === mobile.code);
r = await j('POST', `/incidents/${mobileIncident}/assignment`, mgr, { strategy: 'skill' });
check('skill-based assignment routes it to the application team with no code change', r.body.assigneeName === 'Application Support', r.body.assigneeName);
for (const action of ['ACKNOWLEDGE', 'START']) await j('POST', `/incidents/${mobileIncident}/transitions`, appTech, { action });
await j('POST', `/incidents/${mobileIncident}/transitions`, appTech, { action: 'RESOLVE', summary: 'Rolled back the faulty app release', rootCause: 'Crash in the new splash screen' });   // frees the technician for later runs
r = await j('POST', '/admin/services', mgr, { name: `Mobile gateway ${runId}`, category: mobile.code, criticality: 'MEDIUM' });
check('services can use the new category', r.status === 201 && r.body.category === mobile.code);

r = await j('POST', '/admin/categories', mgr, { label: `Phishing ${runId}`, team: 'SECURITY' });
const phishing = r.body;
r = await j('POST', '/incidents', emp, { title: 'Phishing mail to staff', description: 'Staff received a fake password reset mail with our logo', serviceId: 5, category: phishing.code, impact: 1, urgency: 1 });
check('a category handled by the security team gets the security P1 rule', r.body.incident.priority === 'P1', r.body.incident.priorityReason);
r = await j('PATCH', `/admin/categories/${mobile.code}`, mgr, { team: 'NETWORK' });
check('IT manager can move a category to another team', r.body.team === 'NETWORK');
await j('PATCH', `/admin/categories/${mobile.code}`, mgr, { team: 'APPLICATION' });

// ---------------- Editing incidents ----------------
r = await j('POST', '/incidents', emp, { title: 'Refund page eror', description: 'The refund status page shows an eror', serviceId: 2, category: 'PAYMENT', impact: 1, urgency: 2 });
const id = r.body.incident.id, originalPriority = r.body.incident.priority;
check('reporter is offered Edit on their new incident', r.body.incident.allowedActions.includes('EDIT'));
r = await j('PATCH', `/incidents/${id}`, emp, { title: 'Refund page error', description: `The refund status page shows an error for every PNR (${runId})` });
check('reporter corrects the title and description', r.status === 200 && r.body.title === 'Refund page error' && r.body.history.some(h => h.action === 'INCIDENT_EDITED' && h.description === 'Updated title and description'));
check('an edit that changes nothing is refused', (await j('PATCH', `/incidents/${id}`, emp, { title: 'Refund page error' })).status === 422);
check('a too-short title is refused', (await j('PATCH', `/incidents/${id}`, emp, { title: 'Bad' })).status === 422);
check('the reporter cannot change the category', (await j('PATCH', `/incidents/${id}`, emp, { category: 'DATABASE' })).status === 403);
check('another employee cannot edit it', (await j('PATCH', `/incidents/${id}`, ops, { title: 'Someone else edits' })).status === 404);
check('technicians cannot edit', (await j('PATCH', `/incidents/${id}`, appTech, { title: 'Technician edits' })).status === 403);

r = await j('PATCH', `/incidents/${id}`, mgr, { category: 'SECURITY' });
check('IT manager recategorises it as security; the priority is recalculated to P1', r.status === 200 && r.body.category === 'SECURITY' && r.body.priority === 'P1'
  && r.body.history.some(h => h.action === 'PRIORITY_CHANGED' && /recalculated because the category changed/.test(h.description)), `${r.body.priority}`);
r = await j('PATCH', `/incidents/${id}`, mgr, { category: 'PAYMENT' });
check('and back to payment; the rules give the original priority again', r.body.priority === originalPriority && originalPriority === 'P3', `${originalPriority} -> ${r.body.priority}`);
r = await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P2', reason: 'Refund complaints are piling up' });
r = await j('PATCH', `/incidents/${id}`, mgr, { category: 'DATABASE' });
check('a manual priority override is kept when the category changes', r.body.priority === 'P2' && r.body.category === 'DATABASE');

await j('POST', `/incidents/${id}/assignment`, mgr, { strategy: 'skill' });
const dbTech = await login('tech.database@demo.local');
await j('POST', `/incidents/${id}/transitions`, dbTech, { action: 'ACKNOWLEDGE' });
r = await j('PATCH', `/incidents/${id}`, emp, { description: 'Adding more detail after acknowledgement' });
check('the reporter cannot edit once a technician has acknowledged it', r.status === 409 && !(await j('GET', `/incidents/${id}`, emp)).body.allowedActions.includes('EDIT'));
r = await j('PATCH', `/incidents/${id}`, mgr, { description: `Refund status page fails for every PNR; started after the 02:00 deploy (${runId})` });
check('the IT manager can still edit an acknowledged incident', r.status === 200);
check('the assigned technician is notified of the edit', (await j('GET', '/notifications', dbTech)).body.items.some(n => n.type === 'INCIDENT_EDITED' && n.incidentId === id));
await j('POST', `/incidents/${id}/transitions`, dbTech, { action: 'START' });
await j('POST', `/incidents/${id}/transitions`, dbTech, { action: 'RESOLVE', summary: 'Rebuilt the refund status index', rootCause: 'Index corrupted by the deploy' });
check('nobody can edit a resolved incident', (await j('PATCH', `/incidents/${id}`, mgr, { title: 'Too late to edit' })).status === 409);

r = await j('POST', '/incidents', cust, { title: 'Ticket not showing', description: 'My booked ticket is not in my bookings list', serviceId: 1, effect: 'DEGRADED', moneyTaken: false, stillHappening: true });
const custId = r.body.incident.id;
r = await j('PATCH', `/incidents/${custId}`, cust, { description: 'My booked ticket (PNR 4521) is not in my bookings list' });
check('a customer can correct their report and sees the edit in their history', r.status === 200 && r.body.history.some(h => h.action === 'INCIDENT_EDITED') && r.body.priority === null);

// ---------------- Audit log search ----------------
r = await j('GET', `/audit?incidentId=${id}`, mgr);
const trail = r.body;
check('the audit log lists every entry for an incident, newest first', r.status === 200 && trail.length >= 8 && trail[0].action === 'INCIDENT_RESOLVED'
  && trail.every((e, i) => i === 0 || Date.parse(trail[i - 1].at) >= Date.parse(e.at)), `${trail.length} entries`);
check('entries say who did it', trail.some(e => e.action === 'INCIDENT_EDITED' && e.actorName === 'Demo Admin One') && trail.some(e => e.action === 'INCIDENT_EDITED' && e.actorName === 'Demo Support Agent'));
r = await j('GET', `/audit?action=INCIDENT_EDITED&q=${encodeURIComponent('Refund page error')}`, mgr);
check('text and action filters work across incidents', r.body.length >= 5 && r.body.every(e => e.action === 'INCIDENT_EDITED') && r.body.some(e => e.incidentId === id), `${r.body.length} entries`);
r = await j('GET', `/audit?q=${encodeURIComponent('Refund page error')}&incidentId=${id}`, mgr);
check('text also matches the incident title', r.body.length === trail.length);
const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
check('date filters work', (await j('GET', `/audit?incidentId=${id}&to=${yesterday}`, mgr)).body.length === 0
  && (await j('GET', `/audit?incidentId=${id}&from=${yesterday}&to=${tomorrow}`, mgr)).body.length === trail.length);
check('the limit is applied', (await j('GET', '/audit?limit=3', mgr)).body.length === 3);
check('a bad date is refused', (await j('GET', '/audit?from=22-11-2026', mgr)).status === 422);
check('only the IT manager can search the audit log', (await j('GET', '/audit', emp)).status === 403 && (await j('GET', '/audit', appTech)).status === 403);

// Switch off the categories this run added so they don't pile up in the report form (categories are never deleted).
for (const c of [mobile, phishing]) await j('PATCH', `/admin/categories/${c.code}`, mgr, { active: false });
check('test categories switched off again', !(await j('GET', '/categories', emp)).body.some(c => c.code === mobile.code || c.code === phishing.code));

finish('review fixes');
