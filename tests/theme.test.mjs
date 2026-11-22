import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alternateTheme, parseStoredTheme, resolveInitialTheme, THEME_STORAGE_KEY } from '../src/themePreference.ts';
import { readFileSync, statSync } from 'node:fs';

test('honors manually selected theme over OS preference', () => {
  assert.equal(resolveInitialTheme('dark', false), 'dark');
  assert.equal(resolveInitialTheme('light', true), 'light');
});

test('uses OS preference only when stored setting is absent or invalid', () => {
  assert.equal(resolveInitialTheme(null, true), 'dark');
  assert.equal(resolveInitialTheme(null, false), 'light');
  assert.equal(resolveInitialTheme('garbage', true), 'dark');
  assert.equal(parseStoredTheme('DARK'), null);
});

test('theme switch is reversible and uses stable localStorage key', () => {
  assert.equal(alternateTheme('dark'), 'light');
  assert.equal(alternateTheme(alternateTheme('light')), 'light');
  assert.equal(THEME_STORAGE_KEY, 'bharat-rail.theme');
});

test('both supplied theme logos are real optimized WebP assets', () => {
  for (const name of ['dark', 'light']) {
    const path = new URL('../public/brand/bharat-rail-' + name + '.webp', import.meta.url);
    const signature = readFileSync(path).subarray(0, 12);
    assert.equal(signature.toString('ascii', 0, 4), 'RIFF');
    assert.equal(signature.toString('ascii', 8, 12), 'WEBP');
    assert.ok(statSync(path).size > 1000);
  }
});
