import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function isAuditReport(report) {
  return Boolean(report && !report.error && report.metadata?.vulnerabilities);
}

export function formatAuditError(report, stderr) {
  const summary = report?.error?.summary || report?.error?.detail || stderr || 'npm audit failed';
  return [
    '## npm audit',
    '',
    'npm audit did not return a vulnerability report. Nothing was filled in as a clean result.',
    '',
    '```',
    String(summary).slice(0, 8000),
    '```',
  ].join('\n');
}

export function formatAudit(report) {
  const counts = report?.metadata?.vulnerabilities ?? {};
  const vulns = report?.vulnerabilities ?? {};
  const lines = [
    '## npm audit',
    '',
    `Total ${counts.total ?? 'unknown'}: critical ${counts.critical ?? 0}, high ${counts.high ?? 0}, moderate ${counts.moderate ?? 0}, low ${counts.low ?? 0}, info ${counts.info ?? 0}.`,
    '',
    '| Package | Severity | Fix |',
    '| --- | --- | --- |',
  ];
  for (const [name, info] of Object.entries(vulns)) {
    const fix = info?.fixAvailable === true ? 'yes' : info?.fixAvailable ? 'yes' : 'no';
    lines.push(`| ${name} | ${info?.severity ?? 'unknown'} | ${fix} |`);
  }
  if (Object.keys(vulns).length === 0) lines.push('| (none) |  |  |');
  lines.push('', '<details>', '<summary>npm audit JSON</summary>', '', '```json');
  const json = JSON.stringify(report, null, 2);
  lines.push(json.length > 100000 ? `${json.slice(0, 100000)}\n… truncated` : json);
  lines.push('```', '', '</details>');
  return lines.join('\n');
}

function writeSummary(text) {
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (!summary) {
    console.log('GITHUB_STEP_SUMMARY is unset; the report was printed here only.');
    return;
  }
  appendFileSync(summary, `${text}\n`);
  console.log(`Wrote the npm audit report to ${summary}`);
}

function selfTest() {
  const text = formatAudit({
    metadata: { vulnerabilities: { info: 0, low: 1, moderate: 0, high: 0, critical: 0, total: 1 } },
    vulnerabilities: { example: { severity: 'low', fixAvailable: false } },
  });
  const enolock = { error: { code: 'ENOLOCK', summary: 'This command requires an existing lockfile.' } };
  if (!text.includes('| example | low | no |') || !text.includes('```json') || isAuditReport(enolock) || !isAuditReport({ metadata: { vulnerabilities: { total: 0 } } })) {
    console.error('security-audit-report self-test failed');
    process.exit(1);
  }
  console.log('security-audit-report self-test passed');
}

if (process.argv.includes('--self-test')) selfTest();

const root = fileURLToPath(new URL('..', import.meta.url));
const result = spawnSync('npm', ['audit', '--json'], {
  cwd: root,
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});
const stdout = result.stdout ?? '';
let report;
try {
  report = JSON.parse(stdout);
} catch {
  report = undefined;
}
if (!isAuditReport(report)) {
  const failure = formatAuditError(report, result.stderr || stdout || result.error?.message || 'npm audit produced no output');
  console.log(failure);
  writeSummary(failure);
  process.exit(1);
}

const text = formatAudit(report);
console.log(text);
writeSummary(text);
