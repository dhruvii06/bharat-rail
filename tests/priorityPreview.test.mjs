import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewStaffIncidentPriority, isPeakTatkalTime } from '../shared/priorityPreview.ts';

const service = { criticalityScore: 1, tatkalBookingPath: true };
const security = { code: 'MOBILE_SECURITY', team: 'SECURITY' };
const application = { code: 'APPLICATION', team: 'APPLICATION' };
const incident = { category: 'APPLICATION', impact: 3, urgency: 3, tatkalWindow: false };
const outsideWindow = new Date('2026-11-22T06:00:00.000Z'); // 11:30 IST
const peakWindow = new Date('2026-11-22T04:35:00.000Z'); // 10:05 IST

test('Tatkal windows follow the Java Asia/Kolkata rule including boundaries', () => {
  const at = time => new Date('2026-11-22T' + time + ':00.000Z');
  assert.equal(isPeakTatkalTime(at('04:29')), false); // 09:59
  assert.equal(isPeakTatkalTime(at('04:30')), true);  // 10:00
  assert.equal(isPeakTatkalTime(at('04:59')), true);  // 10:29
  assert.equal(isPeakTatkalTime(at('05:00')), false); // 10:30
  assert.equal(isPeakTatkalTime(at('05:29')), false); // 10:59
  assert.equal(isPeakTatkalTime(at('05:30')), true);  // 11:00
  assert.equal(isPeakTatkalTime(at('05:59')), true);  // 11:29
  assert.equal(isPeakTatkalTime(at('06:00')), false); // 11:30
});

test('custom categories handled by security trigger P1 regardless of category name', () => {
  const result = previewStaffIncidentPriority({ ...incident, category: 'MOBILE_SECURITY', impact: 1, urgency: 1 },
    { criticalityScore: 1, tatkalBookingPath: false }, security, outsideWindow);
  assert.equal(result?.priority, 'P1');
  assert.equal(result?.securityOverride, true);
});

test('Tatkal window is detected automatically for eligible booking services', () => {
  const result = previewStaffIncidentPriority(incident, service, application, peakWindow);
  assert.equal(result?.priority, 'P1');
  assert.equal(result?.autoTatkalWindow, true);
  assert.equal(result?.peakTatkalOverride, true);
});

test('Tatkal flag alone cannot override an unrelated service', () => {
  const result = previewStaffIncidentPriority({ ...incident, tatkalWindow: true },
    { criticalityScore: 1, tatkalBookingPath: false }, application, peakWindow);
  assert.equal(result?.priority, 'P2');
  assert.equal(result?.peakTatkalOverride, false);
});

test('Tatkal flag outside current window mirrors the accepted staff input', () => {
  const result = previewStaffIncidentPriority({ ...incident, tatkalWindow: true }, service, application, outsideWindow);
  assert.equal(result?.priority, 'P1');
  assert.equal(result?.autoTatkalWindow, false);
});

test('Tatkal does not override a low impact or urgency score', () => {
  const result = previewStaffIncidentPriority({ ...incident, urgency: 2 }, service, application, peakWindow);
  assert.equal(result?.priority, 'P3');
  assert.equal(result?.peakTatkalOverride, false);
});

test('cannot preview without both matching category and selected service', () => {
  assert.equal(previewStaffIncidentPriority(incident, undefined, application, outsideWindow), null);
  assert.equal(previewStaffIncidentPriority(incident, service, security, outsideWindow), null);
});
