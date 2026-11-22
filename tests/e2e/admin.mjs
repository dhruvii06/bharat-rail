// End-to-end: admin settings (strategy, accounts, SLA, categories, services) and the technician information step.
import { check, finish, j, minutes, runId, session, login as token } from './lib.mjs';
const login = token;

const authEmail = `auth.tech.${runId}@demo.local`;
const mgr = await login('admin1@demo.local'), emp = await login('support1@demo.local'), ops = await login('ops@demo.local');
const before1001 = (await j('GET', '/incidents/INC-1001', mgr)).body;

// --- Settings: default strategy
let r = await j('GET', '/admin/settings', mgr);
check('default strategy starts as skill', r.body.defaultAssignmentStrategy === 'skill', r.body.assignmentStrategies.join(','));
check('invalid strategy rejected', (await j('PUT', '/admin/settings', mgr, { defaultAssignmentStrategy: 'random' })).status === 422);
check('set default strategy to load', (await j('PUT', '/admin/settings', mgr, { defaultAssignmentStrategy: 'load' })).body.defaultAssignmentStrategy === 'load');

// --- Users: create a technician with a skill
r = await j('POST', '/admin/users', mgr, { name: `Auth Support ${runId}`, email: authEmail, password: 'AuthTech2026', role: 'Technician', department: 'Identity', skill: 'AUTHENTICATION', experienceYears: 4 });
check('manager creates a technician account', r.status === 201 && !r.body.warning, r.body.warning ?? r.body.user?.id);
const authTechId = r.body.user.id;
r = await j('GET', '/technicians', mgr);
const authTech = r.body.find(t => String(t.id) === authTechId);
// Technicians left by earlier runs of this suite would compete for the same incident; take them off duty.
for (const t of r.body.filter(t => t.skill === 'AUTHENTICATION' && String(t.id) !== authTechId && t.name.startsWith('Auth Support') && t.available))
  await j('PUT', `/admin/technicians/${t.id}`, mgr, { available: false });
check('technician profile saved through Java', authTech?.skill === 'AUTHENTICATION' && authTech.experienceYears === 4 && authTech.available);
check('employee cannot open admin settings', (await j('GET', '/admin/settings', emp)).status === 403);

// --- SLA policy: change P2 targets; new incidents use them, old ones keep theirs
check('invalid SLA (resolution not longer than response) rejected', (await j('PUT', '/admin/sla-policies/P2', mgr, { responseMinutes: 60, resolutionMinutes: 30 })).status === 422);
r = await j('PUT', '/admin/sla-policies/P2', mgr, { responseMinutes: 20, resolutionMinutes: 180 });
check('P2 SLA updated to 20/180', r.status === 200 && r.body.responseMinutes === 20);
r = await j('POST', '/incidents', emp, { title: 'OTP login failing', description: 'Users do not receive the login OTP on the app', serviceId: 1, category: 'AUTHENTICATION', impact: 2, urgency: 2 });
const id = r.body.incident.id;
check('new P2 incident uses the configured targets', r.body.incident.priority === 'P2' && minutes(r.body.incident.createdAt, r.body.incident.responseDueAt) === 20 && minutes(r.body.incident.createdAt, r.body.incident.resolutionDueAt) === 180,
  `${id}: ${minutes(r.body.incident.createdAt, r.body.incident.responseDueAt)}/${minutes(r.body.incident.createdAt, r.body.incident.resolutionDueAt)} min`);
const after1001 = (await j('GET', '/incidents/INC-1001', mgr)).body;
check('existing incident keeps its deadlines', after1001.responseDueAt === before1001.responseDueAt && after1001.resolutionDueAt === before1001.resolutionDueAt);

// --- Categories: switch one off and on
r = await j('PATCH', '/admin/categories/NETWORK', mgr, { active: false, label: 'Network & connectivity' });
check('category switched off and renamed', r.body.active === false && r.body.label === 'Network & connectivity');
r = await j('GET', '/categories', emp);
check('reporters no longer see it', !r.body.some(c => c.code === 'NETWORK'));
check('report in a switched-off category is refused', (await j('POST', '/incidents', emp, { title: 'PNR slow', description: 'PNR status is very slow', serviceId: 4, category: 'NETWORK', impact: 2, urgency: 2 })).status === 422);
await j('PATCH', '/admin/categories/NETWORK', mgr, { active: true, label: 'Network' });

// --- Services: add and edit
r = await j('POST', '/admin/services', mgr, { name: `Waitlist engine ${runId}`, category: 'APPLICATION', criticality: 'HIGH' });
check('service added with normalised name', r.status === 201 && r.body.name === `WAITLIST_ENGINE_${runId.toUpperCase()}` && r.body.criticalityScore === 2, r.body.name);
r = await j('PATCH', `/admin/services/${r.body.id}`, mgr, { criticality: 'CRITICAL' });
check('service criticality changed', r.body.criticality === 'CRITICAL' && r.body.criticalityScore === 3);
check('bad criticality rejected', (await j('POST', '/admin/services', mgr, { name: 'X svc', category: 'APPLICATION', criticality: 'URGENT' })).status === 422);

// --- Assignment uses the default (load) strategy
r = await j('POST', `/incidents/${id}/assignment`, mgr, {});
check('assign without a strategy uses the default and finds the new technician', r.body.assigneeName === `Auth Support ${runId}`, r.body.history?.find(h => h.action === 'ASSIGNMENT_REASON')?.description);

// --- Technician information step
const tech = await login(authEmail, 'AuthTech2026');
check('new technician is blocked until the temporary password is changed', (await j('GET', '/incidents', tech)).body.error?.code === 'PASSWORD_CHANGE_REQUIRED');
check('technician changes the temporary password', (await j('POST', '/auth/change-password', tech, { currentPassword: 'AuthTech2026', newPassword: 'AuthTech2027' })).body.user?.mustChangePassword === false);
check('cannot ask before acknowledging', (await j('POST', `/incidents/${id}/info-request`, tech, { question: 'Which phone model?' })).body.error?.code === 'INVALID_TRANSITION');
await j('POST', `/incidents/${id}/transitions`, tech, { action: 'ACKNOWLEDGE' });
await j('POST', `/incidents/${id}/transitions`, tech, { action: 'START' });
r = await j('POST', `/incidents/${id}/info-request`, tech, { question: 'Which mobile number and operator do affected users have?' });
check('technician asks for information', r.status === 200 && r.body.informationRequest?.startsWith('Which mobile') && r.body.status === 'IN_PROGRESS' && !r.body.allowedActions.includes('RESOLVE'), r.body.allowedActions.join(','));
check('second question refused while one is open', (await j('POST', `/incidents/${id}/info-request`, tech, { question: 'And the app version?' })).status === 409);
check('resolve refused while waiting', (await j('POST', `/incidents/${id}/transitions`, tech, { action: 'RESOLVE', summary: 'Switched SMS gateway route', rootCause: 'Operator throttling' })).body.error?.code === 'INVALID_TRANSITION');
r = await j('GET', `/incidents/${id}`, emp);
check('reporter sees the question and can answer', r.body.allowedActions.includes('PROVIDE_INFO') && r.body.informationRequest !== null);
r = await j('GET', '/notifications', emp);
check('reporter notified of the question', r.body.items.some(n => n.type === 'INFO_REQUESTED' && n.incidentId === id));
check('another employee cannot answer', (await j('POST', `/incidents/${id}/info-response`, ops, { answer: 'no idea' })).status === 404);
r = await j('POST', `/incidents/${id}/info-response`, emp, { answer: 'Mostly Jio and Airtel numbers in Mumbai' });
check('reporter answers; request cleared', r.status === 200 && r.body.informationRequest === null);
r = await j('GET', '/notifications', tech);
check('technician notified of the answer', r.body.items.some(n => n.type === 'INFO_PROVIDED' && n.incidentId === id));
r = await j('POST', `/incidents/${id}/transitions`, tech, { action: 'RESOLVE', summary: 'Switched the OTP SMS route to the backup gateway', rootCause: 'Primary SMS gateway throttled by operators' });
check('resolve works after the answer', r.body.status === 'RESOLVED');
const actions = r.body.history.map(h => h.action);
check('history has the question and the answer', actions.includes('INFO_REQUESTED') && actions.includes('INFO_PROVIDED'));

// --- Deactivate and reactivate the technician
r = await j('PATCH', `/admin/users/${authTechId}`, mgr, { active: false });
check('technician deactivated', r.body.user.active === false);
check('deactivated technician is signed out', (await j('GET', '/auth/me', tech)).status === 401);
check('and cannot sign in', (await j('POST', '/auth/login', null, { email: authEmail, password: 'AuthTech2027' })).status === 401);
r = await j('GET', '/technicians', mgr);
check('and is not available for new work', r.body.find(t => String(t.id) === authTechId).available === false);
check('manager cannot deactivate themselves', (await j('PATCH', '/admin/users/1', mgr, { active: false })).status === 409);
await j('PATCH', `/admin/users/${authTechId}`, mgr, { active: true });
await j('PUT', '/admin/settings', mgr, { defaultAssignmentStrategy: 'skill' });
await j('PUT', '/admin/sla-policies/P2', mgr, { responseMinutes: 15, resolutionMinutes: 120 });   // back to the default for the other suites

finish('admin');
