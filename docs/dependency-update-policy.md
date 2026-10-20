# Dependency update policy

Wait 7 days before merging a version bump.

`renovate.json` sets `minimumReleaseAge` to `7 days`. Renovate must not treat a release as ready until that age has passed. `.github/dependabot.yml` only schedules weekly npm checks. A weekly pull request is not permission to merge a version on the day it was published. The same 7 day wait applies before merging those bumps.

Do not merge a version bump the day it is published, even when CI is green. A lockfile change that only repeats a version which is already 7 days old can merge with the bump it belongs to. It does not skip the wait, and it does not start a new one.

This policy does not point at a Dependabot or Renovate pull request. Open one only when the bot actually does.
