import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

// Temp runs dir: runs/ is read-only and real nights, so the fixtures are written here.
const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error === undefined ? {} : { error }) });

const GOOD = '2026-10-28';
const EMPTY = '2026-10-29';
const BAD = '2026-10-27';
const MISSING = '2026-10-01';

let runsDir: string;

const config = () => ({
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir,
});

// Jobs in the order the page and the JSON must both list them: sorted by job name.
const GOOD_JOBS = ['backup', 'flaky-sync', 'report'];

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  // Written out of job order on purpose: the digest must sort them.
  writeFileSync(
    join(runsDir, `${GOOD}.jsonl`),
    [
      line('2026-10-28T02:00:00+01:00', 'report', 'ok', 'ana'),
      line('2026-10-28T02:05:00+01:00', 'flaky-sync', 'retry', 'bo', 'timeout'),
      line('2026-10-28T02:10:00+01:00', 'flaky-sync', 'retry', 'bo', 'timeout'),
      line('2026-10-28T02:15:00+01:00', 'flaky-sync', 'retry', 'bo', 'timeout'),
      line('2026-10-28T02:20:00+01:00', 'flaky-sync', 'fail', 'bo', 'disk full'),
      line('2026-10-28T03:00:00+01:00', 'backup', 'ok', null),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(
    join(runsDir, `${BAD}.jsonl`),
    [line('2026-10-27T02:00:00+01:00', 'backup', 'ok', 'ana'), '{not json'].join('\n') + '\n',
  );
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

// Index of each job name in the HTML, in document order.
const positions = (html: string, jobs: string[]) => jobs.map((job) => html.indexOf(`>${job}<`));

describe('digest page /digest/:night', () => {
  it('returns 200 and one row per job, sorted by job', async () => {
    const res = await createApp(config()).request(`/digest/${GOOD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('<title>rig · digest</title>');
    for (const job of GOOD_JOBS) expect(html).toContain(`>${job}<`);
    const at = positions(html, GOOD_JOBS);
    expect(at.every((i) => i > 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it('marks retries of 3 or more and a fail row with class warn', async () => {
    const html = await (await createApp(config()).request(`/digest/${GOOD}`)).text();
    expect(html).toMatch(/<tr class="warn"[^>]*>(?:(?!<\/tr>)[\s\S])*>flaky-sync</);
    expect(html).not.toMatch(/<tr class="warn"[^>]*>(?:(?!<\/tr>)[\s\S])*>report</);
  });

  it('renders a missing owner as an em dash', async () => {
    const html = await (await createApp(config()).request(`/digest/${GOOD}`)).text();
    expect(html).toMatch(/>backup<[\s\S]*?—/);
  });

  it('returns 404 with a page saying there is no run log for a night with no file', async () => {
    const res = await createApp(config()).request(`/digest/${MISSING}`);
    const html = await res.text();
    expect(res.status).toBe(404);
    expect(html).toContain(`no run log for ${MISSING}`);
    expect(html).toContain('<title>rig · digest</title>');
  });

  it('renders "nothing ran" for an empty night with 200', async () => {
    const res = await createApp(config()).request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('renders the bad line count under the table', async () => {
    const res = await createApp(config()).request(`/digest/${BAD}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('1 bad line(s) skipped');
    expect(html).toContain('>backup<');
  });
});

describe('digest JSON /api/digest/:night', () => {
  it('returns 200 with night, badLines and rows in the page order', async () => {
    const res = await createApp(config()).request(`/api/digest/${GOOD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; badLines: number; rows: { job: string }[] };
    expect(body.night).toBe(GOOD);
    expect(body.badLines).toBe(0);
    expect(body.rows.map((row) => row.job)).toEqual(GOOD_JOBS);
  });

  it('lists the same jobs in the same order as the page', async () => {
    const html = await (await createApp(config()).request(`/digest/${GOOD}`)).text();
    const body = (await (await createApp(config()).request(`/api/digest/${GOOD}`)).json()) as {
      rows: { job: string }[];
    };
    const pageOrder = GOOD_JOBS.map((job) => html.indexOf(`>${job}<`));
    expect(pageOrder.every((i) => i > 0)).toBe(true);
    expect(body.rows.map((row) => row.job)).toEqual(GOOD_JOBS);
    expect([...pageOrder].sort((a, b) => a - b)).toEqual(pageOrder);
  });

  it('returns 404 with an error for a night with no file', async () => {
    const res = await createApp(config()).request(`/api/digest/${MISSING}`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: `no run log for ${MISSING}` });
  });

  it('returns 200 with no rows for an empty night', async () => {
    const res = await createApp(config()).request(`/api/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: EMPTY, badLines: 0, rows: [] });
  });

  it('counts one bad line and still returns the good rows', async () => {
    const res = await createApp(config()).request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { badLines: number; rows: { job: string }[] };
    expect(body.badLines).toBe(1);
    expect(body.rows.map((row) => row.job)).toEqual(['backup']);
  });
});
