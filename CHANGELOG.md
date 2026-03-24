# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

[0.3.1]: https://github.com/rohanraarora/metabase-cli/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/rohanraarora/metabase-cli/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/rohanraarora/metabase-cli/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/rohanraarora/metabase-cli/releases/tag/v0.1.0
