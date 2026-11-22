// End-to-end: customers describe problems, never see triage, and can message the IT team.
const hidesTriage = v => v.priority === null && v.priorityReason === null && v.sla === 'NONE' && v.responseDueAt === null && v.resolutionDueAt === null && v.impact === 0 && v.urgency === 0;
import { check, finish, j, minutes, runId, session, login as token } from './lib.mjs';
const login = session;

const meeraEmail = `meera.${runId}@demo.local`;
check('seeded demo customer signs in', (await login('customer@demo.local')).user?.role === 'Customer');
let r = await j('POST', '/auth/register', null, { name: 'Meera Traveller', email: meeraEmail, password: 'Travel2026x', role: 'Employee' });
check('public sign-up creates a Customer even if another role is sent', r.status === 201 && r.body.user.role === 'Customer');
const c = (await login(meeraEmail, 'Travel2026x')).token;
const mgr = (await login('admin1@demo.local')).token, payTech = (await login('tech.payment@demo.local')).token, emp = (await login('support1@demo.local')).token;

// --- the system decides priority (checked through the manager's view)
r = await j('POST', '/incidents', c, { title: 'Money debited but no ticket', description: 'My UPI payment was debited but no PNR was generated', serviceId: 2,
  effect: 'BLOCKED', moneyTaken: true, stillHappening: true, impact: 1, urgency: 1, category: 'NETWORK', tatkalWindow: true, affectedUsers: 99999 });
const id = r.body.incident?.id;
check('customer receives the report without priority, SLA or ratings', r.status === 201 && hidesTriage(r.body.incident));
check('customer gets no duplicate list (other people\'s incidents)', Array.isArray(r.body.possibleDuplicates) && r.body.possibleDuplicates.length === 0);
let m = (await j('GET', `/incidents/${id}`, mgr)).body;
check('manager sees P1 from the customer\'s answers', m.priority === 'P1' && m.impact === 3 && m.urgency === 3, `${m.priority} ${m.impact}/${m.urgency}`);
check('category comes from the service; customer-sent values ignored', m.category === 'PAYMENT' && m.affectedUsers === 1);
check('manager sees the assessment in the history', m.history.some(h => h.action === 'CUSTOMER_ASSESSMENT'));
r = await j('POST', '/incidents', c, { title: 'Typo on the catering page', description: 'The word restaurant is misspelt on the menu page', serviceId: 5, effect: 'MINOR', moneyTaken: false, stillHappening: false });
check('minor cosmetic problem gives P4 (manager view)', (await j('GET', `/incidents/${r.body.incident.id}`, mgr)).body.priority === 'P4');
check('customer must say how they were affected', (await j('POST', '/incidents', c, { title: 'Something broke', description: 'Something is not working right', serviceId: 1 })).status === 422);
check('staff still see priority on their own reports', (await j('POST', '/incidents', emp, { title: 'Staff report with ratings', description: 'Staff still rate impact and urgency themselves', serviceId: 1, category: 'APPLICATION', impact: 1, urgency: 1 })).body.incident?.priority === 'P4');

// --- nothing internal leaks to the customer
let cv = (await j('GET', `/incidents/${id}`, c)).body;
const internal = ['PRIORITY_ASSIGNED', 'CUSTOMER_ASSESSMENT', 'POSSIBLE_DUPLICATE', 'NOTE', 'ASSIGNMENT_REASON', 'SLA_VIOLATED', 'SLA_WARNING', 'ESCALATED'];
check('customer detail hides triage', hidesTriage(cv));
check('customer history has no internal entries', !cv.history.some(h => internal.includes(h.action)), cv.history.map(h => h.action).join(','));
check('customer list hides priority and SLA', (await j('GET', '/incidents', c)).body.every(hidesTriage));
const allMine = (await j('GET', '/incidents', c)).body.length;
check('customer cannot filter by priority or SLA to infer them', (await j('GET', '/incidents?priority=P4', c)).body.length === allMine && (await j('GET', '/incidents?sla=BREACHED', c)).body.length === allMine, `${allMine} incidents`);
let notes = (await j('GET', '/notifications', c)).body.items;
check('customer notifications never mention a priority', notes.length > 0 && notes.every(n => !/\bP[1-4]\b/.test(n.message)), notes.map(n => n.type).join(','));
check('customer gets a neutral receipt', notes.some(n => n.type === 'RECEIVED' && n.incidentId === id));
check('customer cannot add internal notes', (await j('POST', `/incidents/${id}/notes`, c, { text: 'hello' })).status === 403);

// --- conversation with the IT team
check('before assignment the customer can message; the IT manager is notified', (await j('POST', `/incidents/${id}/messages`, c, { text: 'Is there any update? It is urgent for my trip.' })).status === 200 &&
  (await j('GET', '/notifications', mgr)).body.items.some(n => n.type === 'MESSAGE_UNASSIGNED' && n.incidentId === id));
await j('POST', `/incidents/${id}/assignment`, mgr, { strategy: 'skill' });
cv = (await j('GET', `/incidents/${id}`, c)).body;
check('customer sees who is handling it', cv.assigneeName === 'Demo Tech Payment' && cv.history.some(h => h.action === 'TECHNICIAN_ASSIGNED' && !/Technician ID/.test(h.description)));
r = await j('POST', `/incidents/${id}/messages`, c, { text: 'The amount was Rs 1,450 from my SBI account.' });
check('customer messages the assigned technician', r.status === 200 && r.body.allowedActions.includes('MESSAGE'));
check('technician is notified of the customer message', (await j('GET', '/notifications', payTech)).body.items.some(n => n.type === 'MESSAGE_FROM_REPORTER' && n.incidentId === id));
await j('POST', `/incidents/${id}/transitions`, payTech, { action: 'ACKNOWLEDGE' });
await j('POST', `/incidents/${id}/notes`, payTech, { text: 'INTERNAL: suspect callback queue on gateway node 3' });
r = await j('POST', `/incidents/${id}/messages`, payTech, { text: 'Thanks, we are checking with the payment gateway now.' });
check('technician replies to the customer', r.status === 200);
check('customer is notified of the reply (in-app)', (await j('GET', '/notifications', c)).body.items.some(n => n.type === 'MESSAGE_TO_REPORTER' && n.incidentId === id));
check('reply also goes out by email', (await j('GET', '/notifications/outbox', mgr)).body.some(o => o.type === 'MESSAGE_TO_REPORTER' && o.recipientEmail === meeraEmail));
cv = (await j('GET', `/incidents/${id}`, c)).body;
check('customer sees the conversation but not the internal note', cv.history.filter(h => h.action === 'MESSAGE').length === 3 && !cv.history.some(h => (h.description ?? '').includes('INTERNAL')));
check('staff see both the note and the messages', (await j('GET', `/incidents/${id}`, payTech)).body.history.some(h => h.action === 'NOTE'));
check('another employee cannot message this incident', (await j('POST', `/incidents/${id}/messages`, emp, { text: 'hi' })).status === 404);
check('an unassigned technician cannot message it', (await j('POST', `/incidents/${id}/messages`, (await login('tech.database@demo.local')).token, { text: 'hi' })).status === 404);

// --- rest of the lifecycle still works for customers
await j('POST', `/incidents/${id}/transitions`, payTech, { action: 'START' });
await j('POST', `/incidents/${id}/info-request`, payTech, { question: 'Please share the UPI transaction reference number.' });
check('customer answers the technician', (await j('POST', `/incidents/${id}/info-response`, c, { answer: 'UTR 4021 8833 1190' })).body.informationRequest === null);
await j('POST', `/incidents/${id}/transitions`, payTech, { action: 'RESOLVE', summary: 'Refund triggered and booking reconciled', rootCause: 'Gateway callback lost' });
cv = (await j('POST', `/incidents/${id}/transitions`, c, { action: 'VERIFY' })).body;
check('customer verifies the fix and does not see the root cause field', cv.status === 'VERIFIED' && hidesTriage(cv));
await j('POST', `/incidents/${id}/transitions`, mgr, { action: 'CLOSE' });
check('no messages after closing', (await j('POST', `/incidents/${id}/messages`, c, { text: 'thanks' })).status === 409);
finish('customer');
