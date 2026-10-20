let meta = #{
    name: "readiness-level5",
    description: "Parallel readiness repairs toward Level 5, then integrate, test, and re-score",
    when_to_use: "Raise dsh-better-display agent readiness toward Level 5 with disjoint worktrees",
    phases: [
        #{ title: "Parallel repair", detail: "quality, contract, runtime, tests, GitHub" },
        #{ title: "Integrate", detail: "copy worktrees, lockfile, typecheck, tests" },
        #{ title: "Rescore", detail: "fresh 84-criterion report" },
    ],
};

let track_schema = #{
    "type": "object",
    "required": ["status", "track", "worktree", "notes"],
    "properties": #{
        "status": #{ "type": "string" },
        "track": #{ "type": "string" },
        "worktree": #{ "type": "string" },
        "notes": #{ "type": "string" },
        "files": #{ "type": "string" },
        "additions": #{ "type": "string" },
    },
};

fn field_of(r, key) {
    if r == () { return ""; }
    if type_of(r.success) == "bool" && r.success == false { return ""; }
    if type_of(r.output) != "map" { return ""; }
    let value = r.output[key];
    if value == () { return ""; }
    if type_of(value) != "string" { return ""; }
    value
}

let repo = "/Volumes/Workspace/Projects/dsh-better-display";
let cli = "/Users/wu/.grok/skills/agent-readiness/_runtime/scripts/readiness.py";

let rules = "";
rules += "Repo: " + repo + "\n";
rules += "This is a DeepSeek Harness client plugin (TypeScript, tsdown, node:test today, npm). main is the checkout.\n";
rules += "Goal: real readiness repairs a later audit can score toward Level 5 (80% of non-skipped signals). Gaming does not count.\n";
rules += "Forbidden: empty tests, disabled lint or typecheck, @ts-nocheck, fake Sentry or PostHog or PagerDuty or Grafana URLs, invented PRs, deleting assertions, gitignoring lib/, rewriting the reader UI, commit, or push.\n";
rules += "Read files before editing. Use grep and read_file. Run the commands you add.\n";
rules += "You are in a private worktree when one was created. Record its absolute path from: git rev-parse --show-toplevel\n";
rules += "Write .readiness-track.json at the worktree root with devDependencies and scripts you need. Do not edit package.json yourself; the integrator merges it.\n";
rules += "Return status (ok or blocked), track id, worktree path, notes, files (newline-separated paths you wrote), additions (the JSON text).\n";

phase("Parallel repair");

let tracks = [
    #{
        id: "quality",
        owns: "eslint.config.js, .prettierrc.json, .prettierignore, knip.json, .jscpd.json, .husky/pre-commit, scripts/check-todo-debt.mjs, .readiness-track.json",
        focus: "Configure ESLint flat config with typescript-eslint. Keep naming-convention, complexity, and max-lines as errors. Run eslint on src and set thresholds to the smallest multiple of 5 that current src passes; do not turn the rules off and do not use a limit of 0 or 9999. no-unused-vars stays on. If a rule fails, fix config to match intentional style or list the failing file in notes; do not edit src or tests. Prettier config only; do not reformat the tree. Husky pre-commit runs eslint and prettier on staged files via lint-staged. knip entries are src/dsh-better-display.ts and src/client/index.tsx; ignore lib and upstream snapshots under src/client/markdown and src/client/native; knip must exit 0 without deleting product code or peerDependencies. jscpd ignores those upstream dirs; set minLines and threshold so a real duplicate check exits 0 and still fails if duplication jumps. scripts/check-todo-debt.mjs fails the process when a TODO or FIXME has no issue id like #123; fix only comments in scripts you own. Put eslint, typescript-eslint, prettier, husky, lint-staged, knip, and jscpd in .readiness-track.json devDependencies and add scripts lint, format:check, deadcode, duplicates, debt.",
    },
    #{
        id: "contract",
        owns: "AGENTS.md, README.md, README.en.md, .gitignore, .env.example, .devcontainer/devcontainer.json, .github/CODEOWNERS, .github/pull_request_template.md, .github/ISSUE_TEMPLATE/*, .github/workflows/ci.yml, .github/workflows/publish.yml, .github/dependabot.yml, renovate.json, docs/dependency-update-policy.md, docs/runbooks/blank-reader.md, docs/openapi.yaml, scripts/changelog.mjs, scripts/check-agents-md.mjs, scripts/check-bundle-size.mjs, scripts/security-audit-report.mjs",
        focus: "Read README.md before editing and only add a development section; do not remove install instructions. AGENTS.md must be non-empty and cover npm ci, npm run build, npm test, optional env DSH_HOME, DSH_AGENTS_HOME, DSHX_HARNESS, camelCase functions and PascalCase components, and one interactive path. .env.example lists those three vars as optional. .gitignore must ignore .env but not .env.example, and must ignore .idea/ and .vscode/; keep lib tracked. Devcontainer uses Node 24 and runs npm ci. CODEOWNERS assigns * to @aa2246740. Issue templates for bug and feature. PR template has description, testing, and context. ci.yml on pull_request runs npm ci, typecheck, lint, test, a coverage run, node scripts/security-audit-report.mjs which writes a readable npm audit JSON report into the workflow summary, and a build step that prints duration. Use actions/cache for npm. Job timeout 10 minutes. No secrets required. In publish.yml replace npm install --no-package-lock with npm ci and keep OIDC. renovate.json sets minimumReleaseAge to 7. docs/dependency-update-policy.md states a 7 day wait before merging version bumps. dependabot.yml is weekly npm; do not invent a dependabot PR. OpenAPI must match the real routes in src/dsh-better-display.ts and src/reveal.ts. changelog.mjs prints notes from git log and is an npm script; do not rewrite old CHANGELOG sections. check-agents-md.mjs fails if a fenced npm command in AGENTS.md is not a script. check-bundle-size.mjs measures lib/dsh-better-display.js after build and fails above a budget you set from the current file size plus 10 percent, or skips with a clear message if lib is absent. Runbook covers blank reader, missing stylesheet, and stuck fold using CHANGELOG facts, not filler. No analytics SDK and no fake dashboard link. Record needed npm scripts in .readiness-track.json.",
    },
    #{
        id: "runtime",
        owns: "src/log.ts, src/metrics.ts, src/flags.ts, flags.json, scripts/check-dead-flags.mjs, tests/log.test.ts, tests/flags.test.ts, tests/metrics.test.ts, and a surgical edit of src/dsh-better-display.ts",
        focus: "Add a structured logger that redacts authorization headers, tokens, and secret-looking query values. Use it for the plugin load line and the two HTTP handlers. Honor incoming X-Request-ID or generate one, log it, and set it on the response. Add counters for route hits and GET /better-display/metrics that returns those counters. flags.json has readerEnabled defaulting to true; apply() must skip route registration when it is false. This is a startup kill switch, not the glass setting. scripts/check-dead-flags.mjs exits non-zero if a flags.json key is unused under src. Tests use node:assert/strict and must assert redaction, the flag default, and a counter increment. Do not restyle Reader and do not change fold behavior. If you add an npm script name, put it in .readiness-track.json.",
    },
    #{
        id: "tests",
        owns: "vitest.config.ts and existing tests/*.test.ts import lines only",
        focus: "Keep every assertion. Tests currently import node:test and sometimes call t.after. Switch those files to import { test } from vitest and replace t.after with onTestFinished on the vitest context. Do not include browser tsx fixtures. vitest.config.ts uses fileParallelism true and coverage v8. Run vitest with coverage once, then set coverage thresholds to the measured integers minus one point, never to 0. Unit tests retry 0. If a test file already skips when a browser runtime is missing, put only that file in a vitest project with retry 1 and say why in a comment. npm scripts to request: test = vitest run, test:list = vitest list, test:coverage = vitest run --coverage. Put vitest and @vitest/coverage-v8 in .readiness-track.json. Run npx vitest list and vitest run in the worktree after npm install. If install fails on peer deps, record the exact error. Do not delete tests you cannot migrate; leave them on node:test and name them in notes.",
    },
];

let jobs = [];
for t in tracks {
    let p = rules;
    p += "TRACK: ";
    p += t.id;
    p += "\nYOU MAY WRITE ONLY: ";
    p += t.owns;
    p += "\nFOCUS: ";
    p += t.focus;
    p += "\n";
    jobs.push(#{
        prompt: p,
        label: "track:" + t.id,
        capability_mode: "all",
        isolation_worktree: true,
        output_schema: track_schema,
    });
}

let gh = rules;
gh += "TRACK: github\n";
gh += "Do this on the live repo aa2246740/dsh-better-display with gh. Do not edit source files.\n";
gh += "Create labels if missing: P0, P1, P2, P3, bug, feature, chore, frontend, backend, infra.\n";
gh += "Read the open issues, then add at least one fitting label to each. Do not close issues or change titles.\n";
gh += "Create a main ruleset that requires a pull request before merging. Allow repository admins to bypass so the owner is not locked out. If the API refuses, record the error and stop. Do not delete existing rules.\n";
gh += "worktree may be an empty string. status=ok only if labels exist and every open issue has a label.\n";
jobs.push(#{
    prompt: gh,
    label: "track:github",
    capability_mode: "all",
    output_schema: track_schema,
});

log("launching " + jobs.len().to_string() + " repair tracks");
let results = parallel(jobs);

let packs = [];
let i = 0;
for r in results {
    let row = #{ id: "", ok: false, worktree: "", notes: "", additions: "" };
    if i < tracks.len() {
        row.id = tracks[i].id;
    } else {
        row.id = "github";
    }
    if r != () && r.success && type_of(r.output) == "map" {
        row.ok = true;
        row.worktree = field_of(r, "worktree");
        row.notes = field_of(r, "notes");
        row.additions = field_of(r, "additions");
    }
    packs.push(row);
    i += 1;
}

phase("Integrate");

let integ = "";
integ += rules;
integ += "INTEGRATE into the main checkout ";
integ += repo;
integ += " which is NOT a worktree you should abandon.\n";
integ += "For each pack with a non-empty worktree path, copy only the files that track was allowed to write into the main checkout. Do not copy node_modules, lib, or package-lock from a worktree.\n";
integ += "Merge every .readiness-track.json devDependencies and scripts into the main package.json. Keep existing dependencies, peerDependencies, dsh, exports, and files.\n";
integ += "Create package-lock.json with npm install in the main checkout. Do not pass --no-package-lock.\n";
integ += "If tests were migrated to vitest, point the test script at vitest run. Keep typecheck as tsc --noEmit.\n";
integ += "Run npm run typecheck and the unit test command. Fix failures caused by this integration. Do not weaken assertions or turn off lint rules.\n";
integ += "Do not commit or push.\n";
integ += "Packs:\n";
integ += json_encode(packs);
integ += "\nReturn status=ok only if typecheck and unit tests exit 0.\n";

let integ_r = agent(integ, #{
    label: "integrator",
    capability_mode: "all",
    output_schema: track_schema,
});

phase("Rescore");

let score = "";
score += "Re-score ";
score += repo;
score += " with ";
score += cli;
score += "\n";
score += "1. Prepare a NEW directory /tmp/readiness-dsh-better-display/work-level5 and state dir /tmp/readiness-dsh-better-display/state.\n";
score += "2. Read the generated assessment.md. It is the only rubric. Score all 84 criteria with real file or command evidence.\n";
score += "3. Run report. Do not edit the stored JSON to inflate numerators.\n";
score += "4. dependency_update_automation stays 0 unless you can cite a real dependabot or renovate PR URL from gh.\n";
score += "5. fast_ci_feedback stays 0 unless merged PR status checks have start and end times whose average is under 10 minutes.\n";
score += "6. Do not pass product analytics, error tracking, alerting, or deployment dashboards without a real wired system.\n";
score += "7. A skipped signal needs the rubric skip reason. Do not skip a failure.\n";
score += "Integrator status: ";
score += field_of(integ_r, "status");
score += "\nIntegrator notes: ";
score += field_of(integ_r, "notes");
score += "\nReturn status, the level, the percent, passed/failed/skipped counts, report paths, and blockers.\n";

let score_r = agent(score, #{
    label: "rescore",
    capability_mode: "all",
    output_schema: track_schema,
});

let summary = "integrate=";
summary += field_of(integ_r, "status");
summary += " rescore=";
summary += field_of(score_r, "notes");
complete(#{
    summary: summary,
    packs: packs,
});
