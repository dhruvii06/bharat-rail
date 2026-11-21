import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeFailure, identifyService, SERVICE_TOPOLOGY } from '../shared/impactSimulator.ts';

test('payment gateway outage affects direct and indirect booking workflows', () => {
  const result = analyzeFailure('UPI_PAYMENT_GATEWAY');
  assert.equal(result.failed.label, 'UPI Payment Gateway');
  assert.equal(result.directCount, 4);
  assert.ok(result.affected.some(s => s.id === 'TATKAL_BOOKING_ENGINE' && s.depth === 1));
  const notification = result.affected.find(s => s.id === 'PASSENGER_NOTIFICATIONS');
  assert.ok(notification);
  assert.equal(notification.depth, 2);
  assert.equal(new Set(result.affected.map(s => s.id)).size, result.affected.length);
  assert.equal(result.advisoryPriority, 'P1');
});

test('core database cascade is transitive with no duplicates', () => {
  const result = analyzeFailure('NGET_CORE_DATABASE');
  assert.ok(result.affected.length > result.directCount);
  assert.ok(result.affected.some(s => s.id === 'PASSENGER_NOTIFICATIONS'));
  assert.equal(result.affected.some(s => s.id === 'NGET_CORE_DATABASE'), false);
});

test('isolated leaf has zero blast radius', () => {
  const result = analyzeFailure('CATERING_ORDERS');
  assert.equal(result.affected.length, 0);
  assert.equal(result.directCount, 0);
  assert.equal(result.indirectCount, 0);
});

test('breadth-first search is cycle-safe and picks shortest path', () => {
  const sample = [
    { id: 'A', label: 'A', owner: 'test', criticality: 3, dependents: ['B', 'C'] },
    { id: 'B', label: 'B', owner: 'test', criticality: 1, dependents: ['A', 'D'] },
    { id: 'C', label: 'C', owner: 'test', criticality: 1, dependents: ['D'] },
    { id: 'D', label: 'D', owner: 'test', criticality: 1, dependents: [] }
  ];
  const result = analyzeFailure('A', sample);
  assert.equal(result.affected.length, 3);
  assert.deepEqual(result.affected.find(s => s.id === 'D').path, ['A', 'B', 'D']);
});

test('unknown nodes, duplicate IDs and dangling edges are rejected', () => {
  assert.throws(() => analyzeFailure('MISSING'), RangeError);
  assert.throws(() => analyzeFailure('A', [{ id: 'A', label: 'A', owner: '-', criticality: 1, dependents: ['X'] }]), /Unknown dependency/);
  const one = { id: 'A', label: 'A', owner: '-', criticality: 1, dependents: [] };
  assert.throws(() => analyzeFailure('A', [one, one]), /duplicate service/);
});

test('repository seed names and aliases are mapped, unknown services are explicit', () => {
  assert.equal(identifyService('UPI_PAYMENT_GATEWAY'), 'UPI_PAYMENT_GATEWAY');
  assert.equal(identifyService('NGET_CORE_DATABASE'), 'NGET_CORE_DATABASE');
  assert.equal(identifyService('E_CATERING_PORTAL'), 'E_CATERING_PORTAL');
  assert.equal(identifyService('Payment Gateway'), 'UPI_PAYMENT_GATEWAY');
  assert.equal(identifyService('not-listed-service'), null);
  assert.equal(SERVICE_TOPOLOGY.length >= 10, true);
});

test('no stored graph mutation during repeated analysis', () => {
  const before = JSON.stringify(SERVICE_TOPOLOGY);
  assert.deepEqual(analyzeFailure('SMS_GATEWAY'), analyzeFailure('SMS_GATEWAY'));
  assert.equal(JSON.stringify(SERVICE_TOPOLOGY), before);
});
