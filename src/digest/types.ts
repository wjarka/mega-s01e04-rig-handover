// The night's run log, read into one row per job (plan.md § 1).

export type RunStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing.
export type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

export type DigestRow = {
  job: string;
  // Owner on the job's last line. null renders as `—`.
  owner: string | null;
  runs: number;
  // Lines with status `retry`.
  retries: number;
  lastStatus: RunStatus;
  // The most recent error the job reported this night, or null if it reported none.
  lastError: string | null;
  // Times as written in the log, offset kept (styleguide).
  firstAt: string;
  lastAt: string;
};

// `found: false`: no file for that night (404). `found: true` with no rows: the file is empty
// ("nothing ran"). `badLines` counts lines that don't parse or lack a required field.
export type Night =
  | { night: string; found: false }
  | { night: string; found: true; rows: DigestRow[]; badLines: number };

// Rows sorted by job. Never throws on a bad line; a night that isn't YYYY-MM-DD is not found.
export type ReadNight = (runsDir: string, night: string) => Night;
