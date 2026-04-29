# CLAUDE.md

Guidance for Claude Code sessions working in this repository.

## What this repo is

Long-term fork of [`Lumysia/copilot-api-plus`](https://github.com/Lumysia/copilot-api-plus) (which itself forks `ericc-ch/copilot-api`).

A Hono HTTP proxy that exposes GitHub Copilot via OpenAI-compatible (`/v1/chat/completions`) and Anthropic-compatible (`/v1/messages`) APIs.

## Workflow — two-machine collaboration

Two machines collaborate via this repo:

- **Dev machine** (no active Copilot subscription): writes code, unit tests, integration tests with mocks, opens upstream PRs
- **Validation machine** (active Copilot subscription): pulls feature branches, runs e2e tests against real Copilot, captures fixtures + reports, commits them back

If another `copilot-api` instance is already running on the validation machine (e.g. as an editor backend), e2e tests must NOT collide with it. They spawn their own server on `COPILOT_API_E2E_PORT` (default `14141`) — pick a different port from any running instance.

## Branch strategy

This fork uses two long-lived branches:

- **`master`** = pure mirror of `upstream/master`. Only updated via `git fetch upstream && git merge --ff-only upstream/master`. Never receives our commits directly.
- **`main`** = our default branch. Carries all our delta on top of upstream: this CLAUDE.md, tests/, helpers, fixtures, merged patches.

Workflow:

- **Feature branches for upstream PRs** branch from `master` (which == `upstream/master`). This keeps PR diffs free of our infra files.
- After upstream PR opened: open a parallel own-fork PR `feat/<name> → main` so the patch is live in our fork regardless of upstream merge timing. Follow-up commits on `main` add e2e mirror + fixture-loading integration variant.
- **Fork-only changes** (CLAUDE.md, e2e infra, fork-exclusive features) branch from `main`, PR back to `main`.
- **Never push directly** to `master` or `main`. Always branch + PR (review trail).
- **Never `git push --force`** to `master` or `main`.
- Periodic upstream sync: `git fetch upstream && git checkout master && git merge --ff-only upstream/master && git push origin master && git checkout main && git merge master`. Then `bun install && bun test && bun run build` to confirm still green. If upstream merged one of our patches, the merge absorbs cleanly (or applies via patch-id detection on rebase).

## Upstream PR policy

Initiative — what we send proactively to upstream:

- **Yes**: bug-fixes that any upstream user benefits from
- **No**: refactors for our style, e2e infra, fixture commits, this CLAUDE.md, fork-exclusive features

During review — cooperation is the default. The only hard refusal: if upstream requests pulling fork-internal infra into the PR, propose a smaller alternative; failing that, withdraw and keep the fix in our fork.

Tone — standard upstream contribution. No mention of our fork strategy or downstream tooling.

## Note on AGENTS.md

This repo also carries `AGENTS.md` — a file inherited from upstream that documents build / lint / test commands and code-style guidelines.

Treat it as **upstream territory**: we don't edit `AGENTS.md` in our PRs — it belongs to Lumysia, and edits in upstream-bound branches (`feat/*` from `master`) would be downstream noise in their diff. Fork-only branches (`main`) also shouldn't touch it without a strong reason.

`CLAUDE.md` is authoritative for this fork. On any conflict with `AGENTS.md`, follow `CLAUDE.md` — our repo, our rules.

## Test layout (target — being built incrementally)

```
tests/
├── *.test.ts                  # unit + integration (mock-based), always-on
├── *.e2e.test.ts              # e2e (real Copilot), opt-in via RUN_E2E=1
├── __fixtures__/<scenario>/*.json
├── __reports__/<branch>/<date>-<sha>.md
└── _helpers/                  # shared test utilities — added when first consumer needs them
```

## How to run tests

```bash
bun test                        # unit + integration only (e2e skipped via test.skipIf)
RUN_E2E=1 bun test              # all tests, including e2e
RUN_E2E=1 bun test tests/<name>.e2e.test.ts   # single e2e file
```

E2E tests spawn `copilot-api start --port $COPILOT_API_E2E_PORT` (default `14141`) as a subprocess in `beforeAll` and kill it in `afterAll`. They authenticate via the existing Copilot login state — same as a normal `copilot-api` install.

## 🚨 FIXTURE SANITIZATION (CRITICAL — read before EVERY fixture commit)

E2E tests capture real Copilot responses. Real responses contain sensitive data: account IDs, request IDs, rate-limit headers, organization metadata, infrastructure identifiers. Committing them is a leak.

The defenses are layered, but **the active patterns are machine-specific**. Different Copilot tiers and accounts surface different fields. A list of headers / body keys baked into this file would be both incomplete and itself a quiet hint about what we know to strip — it lives in `CLAUDE.local.md` (untracked), not here.

### Layer 1 — Auto-strip during capture

A single sanitize step (`tests/_helpers/sanitize.ts` once it exists) is invoked by `client-real.ts` on every captured response before the fixture is written. Its rules are sourced from `CLAUDE.local.md` → "Sanitization patterns" — header drop-list, body-key drop-list, `_meta` allowlist.

**Before the first fixture is captured on a new validation machine:**

1. Check `CLAUDE.local.md` for a "Sanitization patterns" section.
2. If absent: capture a single representative response with sanitization OFF (or with only obvious credentials masked), then walk the response with the human:
   - List every header present, classify as keep / drop / case-by-case
   - List every body key recursively, same classification
   - Identify which `_meta` fields the validation flow actually needs
3. Record the resulting drop-lists + allowlist into `CLAUDE.local.md` under "Sanitization patterns".
4. Wire `sanitize.ts` to read those patterns. NEVER hard-code patterns derived from a real account into this tracked file.

### Layer 2 — Pre-commit guard

A pre-commit guard greps staged fixture files for forbidden patterns and blocks the commit on hit. Same as the sanitize step, the patterns come from `CLAUDE.local.md` — this file describes the *contract* (must run on every fixture commit; must block on match), not the patterns.

If no project-level guard is wired yet, the [`check-leaks` module](https://github.com/ximera239/private-setup/tree/main/modules/check-leaks) running via `core.hooksPath` covers the same surface for now.

### Layer 3 — Human review (THIS RULE)

**Before `git add tests/__fixtures__/`:**

1. Run the fixture-check script (see Layer 2) — must pass
2. **Visually review every changed `.json` file**
3. Scan for: emails, usernames, account IDs, hostnames, subscription/tier strings, any string that looks like a personal identifier
4. Only then `git add`

**NEVER skip step 3.** Sanitization helpers can have bugs. Pre-commit guards have false negatives. Your eyes are the last line.

If sensitive data slipped through and was pushed:
1. Rotate the leaked credential (Copilot token re-auth)
2. Rewrite git history with `git filter-repo` to remove the leaked content
3. Force-push (one-time exception to the no-force-push rule, with explicit owner confirmation)
4. Add the missed pattern to `CLAUDE.local.md` and to the sanitize/guard wiring; add a regression test

## Commit & PR conventions

- Conventional Commits style: `fix:`, `feat:`, `test:`, `docs:`, `chore:`
- One logical change per commit. Tests live in the same commit as the code they cover.
- PR descriptions: problem statement → fix summary → test coverage. Three sections, terse.
- Personal stylistic preferences (e.g. AI-attribution footer policy) live in `CLAUDE.local.md`, not here.

## Local conventions (`CLAUDE.local.md`)

`CLAUDE.local.md` (gitignored) is the per-machine companion to this file. It holds machine-/operator-specific things that should not ride in the public repo:

- Sanitization patterns derived from this machine's Copilot account (see [Fixture sanitization](#-fixture-sanitization-critical))
- Personal stylistic preferences for commits, PRs, code comments
- Local environment notes (port assignments if `14141` collides, etc.)

If `CLAUDE.local.md` is absent on a machine, prompt the operator to create it before running anything that captures real Copilot data.

## Common tasks

### Adding a new patch (with upstream PR target)

1. Sync `master` with upstream (see Branch strategy), then `git checkout -b feat/<name> master`. Implement: source change + unit tests + integration tests with **inlined mocks** (no fixture-file dependency in the PR-bound branch).
2. `bun run lint:all && bun run typecheck && bun test` — all green; push.
3. Two PRs in parallel: `gh pr create --repo Lumysia/copilot-api-plus --base master --head feat/<name>` (upstream) and `gh pr create --base main --head feat/<name>` (own-fork; auto-merge on green CI).
4. On `main`, follow-up commit adds `tests/<name>.e2e.test.ts` mirror + switches integration to load from `tests/__fixtures__/<name>/`. Open tracking issue in own fork (problem + link to upstream PR + our merge commit). Notify the validation machine to pull `main` and run `RUN_E2E=1 bun test tests/<name>.e2e.test.ts`.

### E2E validation workflow (validation machine)

1. `git fetch && git checkout main && git pull`
2. `bun install` (if dependencies changed)
3. `RUN_E2E=1 bun test tests/<name>.e2e.test.ts` — runs real Copilot requests, captures fixtures + report
4. `bun run test:fixtures-check` — must pass
5. Visually review changed fixtures (see CRITICAL section above)
6. `git add tests/__fixtures__/<name>/ tests/__reports__/main/`
7. Commit + push

