// A wrong decision here publishes to npm by accident, so every branch is pinned down.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changelogStatus, decide } from './release-plan.mjs';

const changelog = ['# Changelog', '', '## 1.1.0 (unreleased)', '- next', '', '## 1.0.0 (2026-10-29)', '- first'].join('\n');

describe('changelogStatus', () => {
  it.each([
    ['1.0.0', 'dated'],
    ['1.1.0', 'undated'],
    ['2.0.0', 'missing'],
    ['1.0', 'missing'],
  ])('%s is %s', (version, status) => {
    expect(changelogStatus(changelog, version)).toBe(status);
  });

  it('a date-like but malformed heading is not dated', () => {
    expect(changelogStatus('## 1.0.0 (2026-10-29) draft', '1.0.0')).toBe('undated');
    expect(changelogStatus('## 1.0.0 (soon)', '1.0.0')).toBe('undated');
  });

  it('CRLF line endings', () => {
    expect(changelogStatus(changelog.replaceAll('\n', '\r\n'), '1.0.0')).toBe('dated');
  });
});

describe('decide', () => {
  const push = { event: 'push', dryRun: false };
  const manual = { event: 'workflow_dispatch' };

  it('push: releases only a dated version that npm does not have', () => {
    expect(decide({ ...push, status: 'dated', onNpm: false }).run).toBe(true);
    expect(decide({ ...push, status: 'dated', onNpm: true }).run).toBe(false);
    expect(decide({ ...push, status: 'undated', onNpm: false }).run).toBe(false);
    expect(decide({ ...push, status: 'missing', onNpm: false }).run).toBe(false);
  });

  it('manual: dry runs always run; a real publish needs a dated heading', () => {
    expect(decide({ ...manual, dryRun: true, status: 'undated', onNpm: false }).run).toBe(true);
    expect(decide({ ...manual, dryRun: false, status: 'dated', onNpm: false }).run).toBe(true);
    expect(decide({ ...manual, dryRun: false, status: 'undated', onNpm: false })).toHaveProperty('error');
    expect(decide({ ...manual, dryRun: false, status: 'missing', onNpm: false })).toHaveProperty('error');
  });

  it('the repository as committed does not release on push unless its version is dated', () => {
    const version = JSON.parse(readFileSync(new URL('../packages/core/package.json', import.meta.url), 'utf8')).version;
    const status = changelogStatus(readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8'), version);
    expect(['dated', 'undated']).toContain(status);
    if (status === 'undated') expect(decide({ ...push, status, onNpm: false }).run).toBe(false);
  });
});
