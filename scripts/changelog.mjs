import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const count = process.argv.includes('--self-test') ? '5' : '30';
const log = execFileSync(
  'git',
  ['log', '--no-merges', '-n', count, '--date=short', '--pretty=format:%h %ad %s'],
  { encoding: 'utf8', cwd: root },
);

console.log('# Notes from git log');
console.log('');
console.log('This prints history only. It does not rewrite CHANGELOG.md.');
console.log('');
if (!log.trim()) {
  console.log('(no commits)');
} else {
  for (const line of log.split('\n')) console.log(`- ${line}`);
}
