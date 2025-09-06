# Repository Guidelines

## Project Structure & Module Organization

- Root `*.user.js`: Tampermonkey/Greasemonkey userscripts (no build step).
- `scripts/update-version.js`: Pre-commit helper that bumps metadata `// @version` for modified `*.user.js` files.
- Supporting files: `README.md`, `package.json`, `.gitignore`.

Example paths:

- `refined-boss.user.js`
- `github-release-assets-recommend.user.js`

## Build, Test, and Development Commands

- Install tools: `pnpm i` (or `ni`). Installs `simple-git-hooks`.
- Setup hooks (auto on install): `pnpm run prepare` → enables git hooks.
- Manually bump versions (optional): `node scripts/update-version.js`.

Notes:

- Committing runs the pre-commit hook to auto-increment `// @version` for changed scripts and re-stage files.

## Coding Style & Naming Conventions

- Files: `kebab-case.user.js` (e.g., `refined-github-comments-tj.user.js`).
- Indentation: 4 spaces; use single quotes; keep semicolons.
- Wrap logic in an IIFE with `'use strict'` (matches existing scripts).
- Userscript header must include: `@name`, `@namespace`, `@version`, `@description`, `@author`, `@homepageURL`, `@supportURL`, `@match`, `@grant`.

## Testing Guidelines

- Manual verification in Tampermonkey: install via raw GitHub URL from `README.md` and test on target pages (e.g., `https://github.com/*/releases/*`, `https://www.zhipin.com/web/geek/job*`).
- Validate header fields and `@match` patterns; keep `@grant` minimal.
- Record a brief test plan in the PR description (scenarios, browsers, pages).

## Commit & Pull Request Guidelines

- Commits: follow Conventional Commits (English type OK, message may be zh/EN):
  - Examples: `feat: add release asset recommendation`, `fix: handle empty job list`, `docs: update install links`.
- PRs must include:
  - Clear description, linked issues (if any), before/after screenshots for UI changes, and manual test steps.
  - Scope small; keep unrelated refactors separate.

## Security & Configuration Tips

- Restrict `@match` to necessary domains/paths; avoid wildcards broader than needed.
- Keep `@grant` to `none` unless required; do not load third-party trackers.
- Prefer small, readable helpers over dependencies; this repo is zero-build and dependency-light by design.
