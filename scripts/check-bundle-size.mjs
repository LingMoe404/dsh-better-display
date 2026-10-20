import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

/** Committed lib/dsh-better-display.js size when this budget was set. */
export const BASELINE_BYTES = 11482;
export const BUDGET_BYTES = Math.floor(BASELINE_BYTES * 1.1);

export function judgeBundle(size, budget = BUDGET_BYTES) {
  if (size > budget) return { code: 1, message: `bundle exceeds budget: ${size} > ${budget}` };
  return { code: 0, message: `lib/dsh-better-display.js ${size} bytes; budget ${budget} (baseline ${BASELINE_BYTES} + 10%).` };
}

export function reportBundle(file) {
  if (!existsSync(file)) {
    return { code: 0, message: `skip: ${file} is absent. Run npm run build before measuring the bundle.` };
  }
  return judgeBundle(statSync(file).size);
}

function selfTest() {
  const over = judgeBundle(BUDGET_BYTES + 1);
  const under = judgeBundle(BASELINE_BYTES);
  const skipped = reportBundle(resolve(import.meta.dirname, 'no-such-bundle.js'));
  if (BUDGET_BYTES !== 12630 || over.code !== 1 || under.code !== 0 || skipped.code !== 0 || !skipped.message.startsWith('skip:')) {
    console.error('check-bundle-size self-test failed', { over, under, skipped, BUDGET_BYTES });
    process.exit(1);
  }
  console.log('check-bundle-size self-test passed');
}

if (process.argv.includes('--self-test')) selfTest();

const result = reportBundle(resolve(import.meta.dirname, '../lib/dsh-better-display.js'));
console.log(result.message);
process.exit(result.code);
