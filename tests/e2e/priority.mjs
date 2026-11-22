// End-to-end: the IT manager overrides a calculated priority, with a reason.
import { check, finish, j, minutes, runId, session, login as token } from './lib.mjs';
const login = token;

const mgr = await login('admin1@demo.local'), cust = await login('customer@demo.local'), app = await login('app.tech@demo.local'), emp = await login('support1@demo.local');

// A customer reports a "minor" catering typo: the rules give P4.
let r = await j('POST', '/incidents', cust, { title: 'Menu prices look wrong', description: 'Catering menu shows Rs 0 for every item on the app', serviceId: 5, effect: 'MINOR', moneyTaken: false, stillHappening: true });
const id = r.body.incident.id;
let m = (await j('GET', `/incidents/${id}`, mgr)).body;
check('rules give P4 for the customer report', m.priority === 'P4' && m.allowedActions.includes('CHANGE_PRIORITY'), m.priority);
await j('POST', `/incidents/${id}/assignment`, mgr, { strategy: 'skill' });

check('technician cannot change priority', (await j('POST', `/incidents/${id}/priority`, app, { priority: 'P1', reason: 'Looks serious' })).status === 403);
check('employee cannot change priority', (await j('POST', `/incidents/${id}/priority`, emp, { priority: 'P1', reason: 'Looks serious' })).status === 403);
check('a reason is required', (await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P2', reason: '' })).status === 422);
check('an invalid priority is refused', (await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P9', reason: 'Wrong value test' })).status === 422);
check('the same priority is refused', (await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P4', reason: 'No real change here' })).status === 422);

r = await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P2', reason: 'Wrong prices are being charged to every catering customer' });
m = r.body;
check('IT manager raises P4 to P2', r.status === 200 && m.priority === 'P2', m.priority);
check('deadlines follow the P2 targets from creation time', minutes(m.createdAt, m.responseDueAt) === 15 && minutes(m.createdAt, m.resolutionDueAt) === 120,
  `${minutes(m.createdAt, m.responseDueAt)}/${minutes(m.createdAt, m.resolutionDueAt)} min`);
check('history records the change and the reason', m.history.some(h => h.action === 'PRIORITY_CHANGED' && h.description.startsWith('P4 -> P2') && h.description.includes('every catering customer')));
check('the explanation says it was set manually', /Set manually by the IT manager/.test(m.priorityReason) && /rules give P4/.test(m.priorityReason), m.priorityReason);
check('the assigned technician is notified', (await j('GET', '/notifications', app)).body.items.some(n => n.type === 'PRIORITY_CHANGED' && n.incidentId === id));
check('the technician also gets an email', (await j('GET', '/notifications/outbox', mgr)).body.some(o => o.type === 'PRIORITY_CHANGED' && o.recipientEmail === 'app.tech@demo.local'));
const custView = (await j('GET', `/incidents/${id}`, cust)).body;
check('the customer is not notified and sees nothing of it', !(await j('GET', '/notifications', cust)).body.items.some(n => n.type === 'PRIORITY_CHANGED')
  && custView.priority === null && !custView.history.some(h => h.action === 'PRIORITY_CHANGED'));
check('the technician sees the new priority in the queue', (await j('GET', '/incidents', app)).body.find(i => i.id === id)?.priority === 'P2');

await j('POST', `/incidents/${id}/transitions`, app, { action: 'ACKNOWLEDGE' });
await j('POST', `/incidents/${id}/transitions`, app, { action: 'START' });
check('can still change while in progress (lower back to P3)', (await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P3', reason: 'Only the snacks section is affected' })).body.priority === 'P3');
await j('POST', `/incidents/${id}/transitions`, app, { action: 'RESOLVE', summary: 'Re-synced the menu price feed', rootCause: 'Price import failed overnight' });
check('cannot change after resolution', (await j('POST', `/incidents/${id}/priority`, mgr, { priority: 'P1', reason: 'Too late now' })).status === 409);
finish('priority');
