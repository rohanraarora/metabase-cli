# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
