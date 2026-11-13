import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriority, nextStatus, slaBreached } from '../shared/domain.ts';
for (const [factors, priority] of [[[1,1,1], 'P4'], [[1,1,3], 'P3'], [[2,2,2], 'P2'], [[3,3,2], 'P1'], [[3,3,3], 'P1']]) {
  test(`Priority ${factors} becomes ${priority}`, () => assert.equal(calculatePriority({ impact: factors[0], urgency: factors[1], criticality: factors[2] }), priority));
}
for (const n of [0, 4, 1.5, NaN]) test(`Reject invalid priority factor ${n}`, () => assert.throws(() => calculatePriority({ impact: n, urgency: 1, criticality: 1 })));
for (const [status, role, next] of [['CLASSIFIED','Manager','ASSIGNED'], ['ASSIGNED','Technician','ACKNOWLEDGED'], ['ACKNOWLEDGED','Technician','IN_PROGRESS'], ['IN_PROGRESS','Technician','RESOLVED'], ['RESOLVED','Employee','VERIFIED'], ['VERIFIED','Manager','CLOSED'], ['CLASSIFIED','Employee',undefined], ['CLOSED','Manager',undefined], ['IN_PROGRESS','Employee',undefined]]) {
  test(`${role}: ${status} → ${next ?? 'blocked'}`, () => assert.equal(nextStatus({ status }, role), next));
}
const base = { responseDueAt: '2026-01-01T00:05:00Z', resolutionDueAt: '2026-01-01T00:30:00Z' };
test('Response deadline equality is within target', () => assert.equal(slaBreached(base, Date.parse(base.responseDueAt)), false));
test('Missing acknowledgement breaches response target', () => assert.equal(slaBreached(base, Date.parse('2026-01-01T00:06:00Z')), true));
test('Timely completion stays met after time passes', () => assert.equal(slaBreached({ ...base, acknowledgedAt: '2026-01-01T00:04:00Z', resolvedAt: '2026-01-01T00:25:00Z' }, Date.parse('2026-02-01')), false));
test('Late response remains a historical violation', () => assert.equal(slaBreached({ ...base, acknowledgedAt: '2026-01-01T00:06:00Z', resolvedAt: '2026-01-01T00:25:00Z' }), true));
