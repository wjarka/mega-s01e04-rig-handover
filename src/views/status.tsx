import type { NightSummary, Status } from '../status.js';

const STATUSES = ['ok', 'retry', 'fail'] as const;

// `2026-10-28 · 4 ok · 0 retry · 1 fail`; `—` for each count when the file cannot be read.
function Night({ night }: { night: NightSummary }) {
  return (
    <>
      <a href={`/digest/${night.night}`}>{night.night}</a>
      {STATUSES.map((s) => (
        <>
          {' · '}
          {night.counts ? `${night.counts[s]} ${s}` : `— ${s}`}
        </>
      ))}
    </>
  );
}

export function StatusBoard({ status }: { status: Status }) {
  return (
    <>
      <h1>status</h1>
      <table>
        <tbody>
          <tr><th>adapter</th><td>{status.adapter}</td></tr>
          <tr><th>installed</th><td>{status.installed}</td></tr>
          <tr>
            <th>last beat</th>
            <td>{status.lastBeat ? `${status.lastBeat.at} · pid ${status.lastBeat.pid}` : <span class="warn">none</span>}</td>
          </tr>
        </tbody>
      </table>
      <h2>nights on disk</h2>
      {status.nights.length === 0 ? (
        <p class="mute">nothing in runs/</p>
      ) : (
        <ul>
          {status.nights.map((n) => (
            <li>
              <Night night={n} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
