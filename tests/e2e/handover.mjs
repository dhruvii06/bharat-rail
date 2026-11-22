// End-to-end: technicians sharing work. Hand over to a colleague (request, decline, withdraw, accept),
// hand off part-done work to another team, and hand back to the IT manager.
import { check, finish, j, login, runId } from './lib.mjs';

const mgr = await login('admin1@demo.local'), cust = await login('customer@demo.local'), emp = await login('support1@demo.local');
const payTech = await login('tech.payment@demo.local'), appTech = await login('app.tech@demo.local'), dbTech = await login('tech.database@demo.local');
const notes = async token => (await j('GET', '/notifications', token)).body.items;
const outbox = async () => (await j('GET', '/notifications/outbox', mgr)).body;
const workload = async name => (await j('GET', '/technicians', mgr)).body.find(t => t.name === name)?.workload;

const overviewBefore = (await j('GET', '/reports/overview', mgr)).body;
const progressOf = (o, name) => o.technicianProgress.find(t => t.name === name) ?? { completed: 0, ongoing: 0 };

// A customer reports a payment problem; it is assigned to the payment technician, who acknowledges.
let r = await j('POST', '/incidents', cust, { title: `Refund not received ${runId}`, description: 'Ticket was cancelled a week ago but the refund has not arrived', serviceId: 2, effect: 'DEGRADED', moneyTaken: true, stillHappening: false });
const id = r.body.incident.id;
await j('POST', `/incidents/${id}/assignment`, mgr, { strategy: 'skill' });
await j('POST', `/incidents/${id}/transitions`, payTech, { action: 'ACKNOWLEDGE' });
const start = (await j('GET', `/incidents/${id}`, mgr)).body;
check('the payment technician has it and may hand it over or off', start.assigneeName === 'Demo Tech Payment'
  && ['HANDOVER', 'HANDOFF'].every(a => start.allowedActions.includes(a)) || (await j('GET', `/incidents/${id}`, payTech)).body.allowedActions.includes('HANDOVER'));
const me = (await j('GET', `/incidents/${id}`, payTech)).body;
check('the assigned technician is offered Hand over and Hand off', me.allowedActions.includes('HANDOVER') && me.allowedActions.includes('HANDOFF'), me.allowedActions.join(','));

r = await j('GET', `/incidents/${id}/colleagues`, payTech);
check('colleagues list leaves out the technician themself', r.status === 200 && !r.body.some(c => c.name === 'Demo Tech Payment') && r.body.some(c => c.name === 'Application Support'));
check('a technician who is not assigned cannot see or hand it over', (await j('POST', `/incidents/${id}/handover`, appTech, { technicianId: 1, reason: 'Not mine' })).status === 404);
check('customers and employees cannot hand over', (await j('POST', `/incidents/${id}/handover`, cust, { reason: 'Please move' })).status === 403
  && (await j('POST', `/incidents/${id}/handover`, emp, { reason: 'Please move' })).status === 403);

const appId = r.body.find(c => c.name === 'Application Support').id, dbId = r.body.find(c => c.name === 'Demo Tech Database').id;
check('a hand-over needs a reason', (await j('POST', `/incidents/${id}/handover`, payTech, { technicianId: appId, reason: 'x' })).status === 422);
check('you cannot hand over to yourself', (await j('POST', `/incidents/${id}/handover`, payTech, { technicianId: start.assigneeId, reason: 'Myself again' })).status === 422);

// --- request, then decline
r = await j('POST', `/incidents/${id}/handover`, payTech, { technicianId: appId, reason: 'On leave from tomorrow' });
check('the technician asks a colleague to take over; nothing moves yet', r.status === 200 && r.body.handover?.toName === 'Application Support'
  && r.body.assigneeName === 'Demo Tech Payment' && r.body.allowedActions.includes('WITHDRAW_HANDOVER') && !r.body.allowedActions.includes('HANDOFF'));
check('only one hand-over can wait at a time', (await j('POST', `/incidents/${id}/handover`, payTech, { technicianId: dbId, reason: 'Second request' })).status === 409);
r = await j('GET', `/incidents/${id}`, appTech);
check('the colleague can open it and is offered Accept / Decline', r.status === 200 && r.body.allowedActions.includes('ACCEPT_HANDOVER') && r.body.allowedActions.includes('DECLINE_HANDOVER'));
check('the colleague sees it in their queue', (await j('GET', '/incidents', appTech)).body.some(i => i.id === id));
check('the colleague is notified in-app and by email', (await notes(appTech)).some(n => n.type === 'HANDOVER_REQUESTED' && n.incidentId === id)
  && (await outbox()).some(o => o.type === 'HANDOVER_REQUESTED' && o.recipientEmail === 'app.tech@demo.local'));
check('someone else cannot accept it', (await j('POST', `/incidents/${id}/handover/accept`, dbTech)).status === 404);
r = await j('POST', `/incidents/${id}/handover/decline`, appTech, { reason: 'Already on two P1s' });
const afterDecline = (await j('GET', `/incidents/${id}`, payTech)).body;
check('the colleague declines; the incident stays with the requester', r.status === 200 && r.body.id === id
  && afterDecline.handover === null && afterDecline.assigneeName === 'Demo Tech Payment' && (await j('GET', `/incidents/${id}`, appTech)).status === 404, r.body.message ?? r.status);
check('the requester is told it was declined', (await notes(payTech)).some(n => n.type === 'HANDOVER_DECLINED' && n.incidentId === id));

// --- request, then withdraw
await j('POST', `/incidents/${id}/handover`, payTech, { technicianId: appId, reason: 'On leave from tomorrow' });
r = await j('POST', `/incidents/${id}/handover/withdraw`, payTech);
check('the requester can withdraw before an answer', r.status === 200 && r.body.handover === null);
check('the colleague hears it was withdrawn and can no longer open it', (await notes(appTech)).some(n => n.type === 'HANDOVER_WITHDRAWN' && n.incidentId === id)
  && (await j('GET', `/incidents/${id}`, appTech)).status === 404);

// --- request, then accept
const payBefore = await workload('Demo Tech Payment'), appBefore = await workload('Application Support');
await j('POST', `/incidents/${id}/handover`, payTech, { technicianId: appId, reason: 'On leave from tomorrow' });
r = await j('POST', `/incidents/${id}/handover/accept`, appTech);
check('the colleague accepts: the incident moves to them and must be acknowledged', r.status === 200 && r.body.assigneeName === 'Application Support'
  && r.body.status === 'ASSIGNED' && r.body.handover === null && r.body.allowedActions.includes('ACKNOWLEDGE'), r.body.status);
check('the workload moves with it', (await workload('Demo Tech Payment')) === payBefore - 1 && (await workload('Application Support')) === appBefore + 1,
  `${payBefore}->${await workload('Demo Tech Payment')}, ${appBefore}->${await workload('Application Support')}`);
check('earlier assignees are recorded', r.body.contributors.length === 1 && r.body.contributors[0].name === 'Demo Tech Payment' && r.body.contributors[0].passedOn === 'HANDED_OVER');
check('the requester hears it was accepted', (await notes(payTech)).some(n => n.type === 'HANDOVER_ACCEPTED' && n.incidentId === id));
const prev = (await j('GET', `/incidents/${id}`, payTech)).body;
check('the earlier technician can still read it but no longer act on it', prev.id === id && !prev.allowedActions.some(a => ['ACKNOWLEDGE', 'HANDOVER', 'HANDOFF', 'MESSAGE'].includes(a)));
await j('POST', `/incidents/${id}/transitions`, appTech, { action: 'ACKNOWLEDGE' });
r = await j('GET', `/incidents/${id}`, mgr);
check('the first acknowledgement time and the deadlines are kept', r.body.acknowledgedAt === start.acknowledgedAt
  && r.body.responseDueAt === start.responseDueAt && r.body.resolutionDueAt === start.resolutionDueAt);

// --- hand off part-done work to another team
check('a hand-off needs a note of what was done', (await j('POST', `/incidents/${id}/handoff`, appTech, { team: 'DATABASE', workDone: 'short' })).status === 422);
check('a team with nobody available is refused', (await j('POST', `/incidents/${id}/handoff`, appTech, { team: 'INFRASTRUCTURE', workDone: 'App side checked; the refund job never ran' })).status === 409);
await j('POST', `/incidents/${id}/transitions`, appTech, { action: 'START' });
r = await j('POST', `/incidents/${id}/handoff`, appTech, { team: 'DATABASE', workDone: 'Refund request reached the app; the refund job row is stuck in the database' });
check('the rest goes to the database team', r.status === 200 && r.body.assigneeName === 'Demo Tech Database' && r.body.status === 'ASSIGNED'
  && r.body.contributors.map(c => c.passedOn).join(',') === 'HANDED_OVER,HANDED_OFF', r.body.assigneeName);
check('the database technician is notified in-app and by email', (await notes(dbTech)).some(n => n.type === 'HANDED_OFF' && n.incidentId === id)
  && (await outbox()).some(o => o.type === 'HANDED_OFF' && o.recipientEmail === 'tech.database@demo.local'));
check('the history shows what the first team did', r.body.history.some(h => h.action === 'HANDED_OFF' && h.description.includes('stuck in the database')));

// --- the customer sees only that a specialist changed
const cv = (await j('GET', `/incidents/${id}`, cust)).body;
const changes = cv.history.filter(h => h.action === 'SPECIALIST_CHANGED');
check('the customer sees a neutral line for each change and nothing internal', changes.length === 2
  && changes.every(h => h.description === 'Another specialist from our IT team is now handling your request' && h.actorName === 'IT team')
  && !cv.history.some(h => /HANDOVER_|HANDED_/.test(h.action)) && cv.handover === null && cv.contributors.length === 0);
const custNotes = (await notes(cust)).filter(n => n.incidentId === id);
// The customer may see who is handling the request now (as on the incident page), but never hand-over reasons or notes.
check('the customer is told a specialist changed, without the reasons or notes', custNotes.filter(n => n.type === 'SPECIALIST_CHANGED').length === 2
  && custNotes.every(n => !/On leave|stuck|hand(ed)? ?(over|off|back)/i.test(n.message)), custNotes.map(n => `${n.type}: ${n.message}`).join(' | '));

await j('POST', `/incidents/${id}/transitions`, dbTech, { action: 'ACKNOWLEDGE' });
await j('POST', `/incidents/${id}/transitions`, dbTech, { action: 'START' });
r = await j('POST', `/incidents/${id}/transitions`, dbTech, { action: 'RESOLVE', summary: 'Re-queued the stuck refund job; refund issued', rootCause: 'Refund job row locked by a failed batch' });
check('the last technician resolves it', r.body.status === 'RESOLVED');
check('the audit log can find hand-offs', (await j('GET', `/audit?action=HANDED_OFF&incidentId=${id}`, mgr)).body.length === 1);

// --- hand back to the IT manager
r = await j('POST', '/incidents', emp, { title: `Seat map not loading ${runId}`, description: 'The seat map spinner never finishes on the booking page', serviceId: 1, category: 'APPLICATION', impact: 2, urgency: 2 });
const back = r.body.incident.id;
await j('POST', `/incidents/${back}/assignment`, mgr, { strategy: 'skill' });
r = await j('POST', `/incidents/${back}/handover`, appTech, { reason: 'This is a network problem, not the app' });
check('a technician can hand an incident back to the IT manager', r.status === 200 && r.body.status === 'CLASSIFIED' && r.body.assigneeId === null);
check('the IT manager is told to reassign it', (await notes(mgr)).some(n => n.type === 'HANDED_BACK' && n.incidentId === back));
r = await j('POST', `/incidents/${back}/assignment`, mgr, { technicianId: (await j('GET', '/technicians', mgr)).body.find(t => t.name === 'Network Support').id });
check('the manager assigns it again', r.body.assigneeName === 'Network Support' && r.body.contributors[0]?.passedOn === 'HANDED_BACK');
const netTech = await login('network.tech@demo.local');
for (const action of ['ACKNOWLEDGE', 'START']) await j('POST', `/incidents/${back}/transitions`, netTech, { action });
await j('POST', `/incidents/${back}/transitions`, netTech, { action: 'RESOLVE', summary: 'Fixed the CDN route for seat map tiles', rootCause: 'Bad CDN route' });   // keep workloads clean for later runs

// --- the IT manager's charts
const overviewAfter = (await j('GET', '/reports/overview', mgr)).body;
const thisMonth = new Date().toISOString().slice(0, 7);
check('monthly chart: 12 months, oldest first, ending this month', overviewAfter.monthly.length === 12 && overviewAfter.monthly.at(-1).month === thisMonth
  && overviewAfter.monthly.every((m, i, all) => i === 0 || all[i - 1].month < m.month));
check('monthly chart counts the two incidents reported in this run', overviewAfter.monthly.at(-1).count === overviewBefore.monthly.at(-1).count + 2,
  `${overviewBefore.monthly.at(-1).count} -> ${overviewAfter.monthly.at(-1).count}`);
check('technician chart credits the resolver with a completed incident', progressOf(overviewAfter, 'Demo Tech Database').completed === progressOf(overviewBefore, 'Demo Tech Database').completed + 1);
check('technician chart shows nothing left ongoing from this run', ['Demo Tech Payment', 'Application Support', 'Demo Tech Database', 'Network Support']
  .every(n => progressOf(overviewAfter, n).ongoing === progressOf(overviewBefore, n).ongoing));
check('only the IT manager can read the report', (await j('GET', '/reports/overview', appTech)).status === 403);
const mine = (await j('GET', '/technicians/me', dbTech)).body;
check('a technician can see their own workload and capacity', mine.name === 'Demo Tech Database' && mine.capacity === 5 && mine.workload === progressOf(overviewAfter, 'Demo Tech Database').ongoing,
  `${mine.workload}/${mine.capacity}`);
check('only technicians have their own workload view', (await j('GET', '/technicians/me', emp)).status === 403 && (await j('GET', '/technicians/me', mgr)).status === 403);

finish('handover');
