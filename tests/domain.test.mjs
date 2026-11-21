// Frontend priority preview must agree with RailwayPriorityStrategy in java/domain.
// Lifecycle, SLA and assignment rules live in the Java domain and are covered by its checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePriority } from '../shared/domain.ts';

const cases = [
  [{ impact: 1, urgency: 1, criticality: 1 }, 'P4', 'score 1'],
  [{ impact: 1, urgency: 2, criticality: 2 }, 'P4', 'score 4, just below P3'],
  [{ impact: 1, urgency: 1, criticality: 3 }, 'P4', 'score 3'],
  [{ impact: 1, urgency: 2, criticality: 3 }, 'P3', 'score 6'],
  [{ impact: 2, urgency: 2, criticality: 3 }, 'P2', 'score 12'],
  [{ impact: 3, urgency: 3, criticality: 2 }, 'P2', 'score 18 stays P2'],
  [{ impact: 3, urgency: 3, criticality: 3 }, 'P1', 'score 27'],
  [{ impact: 3, urgency: 3, criticality: 1, tatkalWindow: true }, 'P1', 'Tatkal window with high impact and urgency'],
  [{ impact: 2, urgency: 3, criticality: 1, tatkalWindow: true }, 'P3', 'Tatkal without high impact does not override (score 6)'],
  [{ impact: 1, urgency: 1, criticality: 1, securityIncident: true }, 'P1', 'security override']
];
for (const [factors, expected, name] of cases) {
  test(`Priority: ${name} → ${expected}`, () => assert.equal(calculatePriority(factors), expected));
}
for (const n of [0, 4, 1.5, NaN]) {
  test(`Reject invalid priority factor ${n}`, () => assert.throws(() => calculatePriority({ impact: n, urgency: 1, criticality: 1 })));
}
