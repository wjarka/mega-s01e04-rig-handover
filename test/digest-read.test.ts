import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  if (!night.found) throw new Error('runs/2026-10-28.jsonl not found');
  const row = (job: string) => night.rows.find((r) => r.job === job);

  it('has 5 jobs, sorted by job, and 1 bad line', () => {
    expect(night.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    expect(night.badLines).toBe(1);
  });

  it('counts runs and retries for fixtures/refresh', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the failure and its error for notes/backup', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps digest/render with a null owner', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastError: null });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reports a missing file as not found', () => {
    expect(readNight(dir, '2026-01-01')).toEqual({ night: '2026-01-01', found: false });
  });

  it('reports an empty file as found with no rows', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', found: true, rows: [], badLines: 0 });
  });

  it('counts lines that lack required fields instead of throwing', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"maybe","owner":"x"}',
        '{"job":"a","status":"ok","owner":"x"}',
        '[]',
        '',
      ].join('\n'),
    );
    const night = readNight(dir, '2026-01-03');
    expect(night).toMatchObject({ found: true, badLines: 3 });
    expect(night.found && night.rows.map((r) => r.runs)).toEqual([1]);
  });

  it('treats a night that is not a date as not found', () => {
    expect(readNight(dir, '../etc/passwd').found).toBe(false);
  });
});
