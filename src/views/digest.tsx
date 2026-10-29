import type { DigestRow } from '../digest/types.js';

const dash = '—';

export function DigestPage({ night, rows, badLines }: { night: string; rows: DigestRow[]; badLines: number }) {
  return (
    <>
      <h1>digest {night}</h1>
      {rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th>
              <th>last status</th><th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr class={r.retries >= 3 || r.lastStatus === 'fail' ? 'warn' : undefined}>
                <td>{r.job || dash}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.lastStatus ?? dash}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt || dash}</td>
                <td>{r.lastAt || dash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {badLines > 0 && <p class="mute">{badLines} bad line(s) skipped</p>}
    </>
  );
}

export function DigestMissing({ night }: { night: string }) {
  return (
    <>
      <h1>digest {night}</h1>
      <p class="warn">no run log for {night}</p>
    </>
  );
}
