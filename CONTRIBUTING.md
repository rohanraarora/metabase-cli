# Contributing to metabase-cli

Thank you for your interest in contributing! This guide will help you get started.

## Development Setup

```bash
git clone https://github.com/rohanraarora/metabase-cli.git
cd metabase-cli
npm install
npm run build
npm test
```

## Project Structure

```
src/
  api/          # API client modules (one per Metabase resource)
  commands/     # CLI command definitions (Commander.js)
  config/       # Profile/config management
  safety/       # Safe mode guard
  utils/        # Output formatting, errors, export helpers
  client.ts     # HTTP client with auth handling
  types.ts      # TypeScript interfaces
  index.ts      # Public API exports
bin/
  metabase.ts   # CLI entry point
test/           # Vitest test files
```

## Development Workflow

1. **Create a branch** from `main` for your changes.
2. **Write code** — follow existing patterns in the codebase.
3. **Add tests** — new API modules should have tests in `test/`.
4. **Run checks** before submitting:
   ```bash
   npm run typecheck    # Type checking
   npm test             # Unit tests
   npm run build        # Build
   ```
5. **Open a pull request** against `main`.

## Adding a New Command

To add a new Metabase API integration:

1. Create `src/api/<resource>.ts` — API client class wrapping `MetabaseClient`.
2. Create `src/commands/<resource>.ts` — Commander command with subcommands.
3. Add types to `src/types.ts` if needed.
4. Register the command in `bin/metabase.ts`.
5. Export the API class from `src/index.ts`.
6. Add tests in `test/`.
7. Document in `README.md`.

## Code Style

- TypeScript with strict mode enabled.
- 2-space indentation.
- Follow existing patterns — consistency matters more than personal preference.
- Keep commands simple: resolve client, call API, format output.

## Commit Messages

- Use imperative mood: "Add feature" not "Added feature".
- Keep the first line under 72 characters.
- Reference issues when applicable: "Fix #42".

## Reporting Issues

- Use [GitHub Issues](https://github.com/rohanraarora/metabase-cli/issues).
- Include your Node.js version, metabase-cli version, and Metabase server version.
- Provide the command you ran and the error output.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
