# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.7.0] - 2026-06-02

### Added

- `question update --db <id>` flag — moves a saved card to a different database. Updates both the top-level `database_id` and `dataset_query.database` so the two never drift. Without this, `PUT /api/card/{id}` with a new `database_id` alone leaves `dataset_query.database` pointing at the old DB and the card keeps running against the original source.
- `alert create` / `notification create`: `--slack-channel <name>` flag for posting to a Slack channel by name. Emits a `notification-recipient/raw-value` recipient with `details.value: "#channel"`, which is the only shape v0.59+ Metabase accepts for channel-name targets.
- `alert create` / `alert update`: `--schedule <cron>` (Quartz/Spring), `--schedule-type hourly|daily|weekly|monthly`, and `--schedule-hour` flags. Schedules are now attached to the top-level `subscriptions[]` as `notification-subscription/cron` (the location v0.59+ expects).
- `notification create`: `--condition rows|has_result|goal_above|goal_below`, `--send-once`, and `--disable-links` flags so the full v0.59+ payload is reachable from the CLI.

### Fixed

- `alert create` / `notification create` with `--channel-type slack` no longer returns `400 Bad Request: {"specific-errors":{"handlers":[{"channel_type":["unknown error, received: :slack"]}]}}`. The CLI now canonicalizes the channel type to the `channel/slack` / `channel/email` form Metabase v0.59+ requires. Both the bare (`slack`) and prefixed (`channel/slack`) forms are accepted.
- `notification create --schedule` no longer attaches a raw cron string to `handlers[].schedule` (which the v0.59+ API silently ignored). The cron is now mounted at the notification level as `subscriptions[{type: "notification-subscription/cron", cron_schedule: "..."}]`, matching the server-side payload model.
- `AlertApi.create` / `AlertApi.update` translate `alert_condition` + `alert_above_goal` → `send_condition` (`has_result` / `goal_above` / `goal_below`) and `alert_first_only` → `send_once`, matching the renamed payload fields in v0.59+. Older callers can keep using the legacy field names; the translation is internal.
- `alert create` now canonicalizes `--channel-type` before validating Slack handlers, so the prefixed form (`channel/slack`) is checked the same as the bare form (`slack`). Previously the prefixed form skipped the guard and could emit a Slack handler with no recipients.
- `alert update --above-goal` without an explicit `--condition` now implies a goal condition instead of falling back to `rows` / `has_result`, which silently downgraded a goal alert.

### Security

- Resolved all open `npm audit` advisories (dev dependencies): `brace-expansion` (ReDoS — GHSA-f886-m6hf-6m8v, GHSA-jxxr-4gwj-5jf2), `postcss` <8.5.10 (XSS in CSS stringify — GHSA-qx2v-qp2m-jg93), and `vitest` 3 → 4.1.8 (critical UI-server arbitrary file read/exec — GHSA-5xrq-8626-4rwp). `npm audit` now reports 0 vulnerabilities. No runtime dependencies changed.

## [0.6.1] - 2026-04-20

### Added

- Global `--verbose` flag (and `METABASE_CLI_VERBOSE=1` env var) to print full API error response bodies. Useful for debugging; off by default.

### Changed

- API errors are now one-line human-readable messages instead of the full server response. Previously a single 500 dumped 5–20 KB of Clojure stacktrace into stdout; now it prints just the top-level `message` / `error` / `cause` field (e.g. `500 Server Error: Invalid parameter: Card 24,009 does not have a template tag named "since_date".`). Use `--verbose` to see the original body. Applies to both HTTP errors and in-band query-execution failures.

### Fixed

- `question update` no longer corrupts v0.59+ cards when template tags are involved. The previous code wrapped `stages[0].native` as an object with nested `template-tags`; Metabase saved the payload but the query processor could not substitute parameters, leaving cards unrunnable ("Card does not have a template tag named X"). Updates now emit `native` as a string with `template-tags` at the stage level, matching native-UI-authored cards. Cards previously corrupted by this bug are healed on their next update.

## [0.6.0] - 2026-04-07

### Added

- `doctor` command: runs 8 diagnostic checks against your Metabase instance (connectivity, version detection, API compatibility)
- `--template-tags` and `--template-tags-file` flags on `question update` (previously only available on `create`)

### Fixed

- `question update --sql` no longer corrupts questions on Metabase v0.59+ — now detects the `stages` format vs legacy `native` format
- Migrated alert commands from deprecated `/api/alert` to `/api/notification` endpoints (backward-compatible CLI interface)
- `segment delete` now uses `PUT` with `archived: true` instead of deprecated `DELETE` endpoint
- `dashboard list` falls back to search API if `/api/dashboard` returns 404 (endpoint deprecated in recent Metabase versions)
- Security: updated transitive deps `vite` (7.3.1 → 7.3.2) and `picomatch` (4.0.3 → 4.0.4), fixing 4 Dependabot alerts

### Changed

- `DatasetQuery` type now includes optional `stages` property for Metabase v0.59+ compatibility
- Alert delete now archives (soft delete) instead of hard delete, matching notification API behavior

## [0.5.0] - 2026-04-02

### Added

- Environment variable authentication: set `METABASE_CLI_AUTH_KEY` and `METABASE_CLI_DOMAIN` to use the CLI without running `profile add` (useful for CI/CD and containers)
- Warning when only one of the two env vars is set
- 5 new tests for env var auth (116 total)

## [0.4.1] - 2026-03-24

### Fixed

- Dropdown filters rendering as text inputs — `values_query_type: "list"` is now automatically set when using `--source-card` or `values_source_type` in JSON

## [0.4.0] - 2026-03-24

### Added

- Dashboard filter/parameter commands: `dashboard list-params`, `add-param`, `remove-param`, `map-param`, `unmap-param`
- Bulk filter setup: `dashboard setup-filters --from-json` for configuring all parameters and mappings in a single command
- File input support: `--sql-file`, `--viz-file`, `--template-tags-file`, `--params-file`, `--content-file`, `--definition-file` across `query`, `question`, `snippet`, and `segment` commands
- Shared `resolveInput()` helper with mutual exclusivity validation
- `ParameterMapping` and `ValuesSourceConfig` type interfaces
- 11 new tests (111 total)

### Changed

- CI now runs on `release/*` branches in addition to `main`
- Extracted `serializeDashcard()` helper to reduce duplication in dashboard card commands
- Upgraded `vitest` v2 → v3 (pulls `esbuild` 0.27.4)

### Fixed

- Security: esbuild vulnerability (Dependabot alert #1) resolved by upgrading vitest/vite

## [0.3.1] - 2026-03-24

### Fixed

- `metabase-cli` command not found after `npm install -g` due to incorrect bin entry point
- Sync `package-lock.json` version

## [0.3.0] - 2026-03-22

### Added

- Alert management: `alert list`, `alert show`, `alert create`, `alert update`, `alert delete`
- Revision history: `revision list`, `revision revert`
- Activity feed: `activity recent`, `activity popular`
- Timeline management: `timeline list/show/create/update/delete`, `timeline add-event/update-event/delete-event`
- Segment management: `segment list/show/create/update/delete`
- Notification management: `notification list/show/create/update/send`
- Dashboard card management: `dashboard add-card`, `dashboard remove-card`
- Auto-login on `profile add` for session auth
- API tests for all new modules (28 new tests)
- CI workflow with GitHub Actions
- CONTRIBUTING.md, CODE_OF_CONDUCT.md, SECURITY.md
- GitHub issue and PR templates
- EditorConfig

## [0.2.3] - 2025-03-20

### Added

- Global `--profile` flag for per-command profile selection

## [0.2.2] - 2025-03-19

### Changed

- CLI version is now read from package.json dynamically

## [0.2.1] - 2025-03-18

### Fixed

- Snippet template-tag handling

## [0.2.0] - 2025-03-17

### Added

- SQL snippet management: `snippet list/show/create/update`
- Search command: `search`
- Database/table/field browsing
- Collection management with tree view
- Dashboard CRUD with copy support
- Question management with parameterized queries
- Query execution with multi-format export (CSV, JSON, XLSX)
- Safe mode for update/delete operations
- Profile system with session and API key auth
- Library API exports for programmatic use

## [0.1.0] - 2025-03-15

### Added

- Initial release

[0.6.1]: https://github.com/rohanraarora/metabase-cli/compare/v0.6.0...v0.6.1
[0.6.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/rohanraarora/metabase-cli/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.3.1...v0.4.0
[0.3.1]: https://github.com/rohanraarora/metabase-cli/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rohanraarora/metabase-cli/releases/tag/v0.1.0
