# metabase-cli

[![npm version](https://img.shields.io/npm/v/metabase-cli.svg)](https://www.npmjs.com/package/metabase-cli)
[![CI](https://github.com/rohanraarora/metabase-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/rohanraarora/metabase-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Headless CLI and Node.js library for interacting with [Metabase](https://www.metabase.com/) instances. Manage profiles, run queries, CRUD questions, dashboards, collections, snippets, alerts, segments, timelines, and more — all from the terminal.

## Install

```bash
# Global install
npm install -g metabase-cli

# Or run directly
npx metabase-cli --help
```

Requires Node.js 18+.

## Quick Start

```bash
# 1. Add a profile (auto-logs in for session auth)
metabase-cli profile add prod --domain https://metabase.example.com --email you@example.com --password secret

# 2. Run a query
metabase-cli query run --sql "SELECT * FROM users LIMIT 10" --db 1

# 3. Search for a dashboard
metabase-cli search "Revenue" --models dashboard
```

## Profiles

Profiles store connection details for your Metabase instances. Config is saved at `~/.metabase-cli/config.json`.

```bash
# Session auth (email/password)
metabase-cli profile add prod --domain https://metabase.example.com --email you@example.com --password secret

# API key auth
metabase-cli profile add staging --domain https://staging.metabase.example.com --api-key mb_xxxxx

# List profiles (* = active)
metabase-cli profile list

# Switch active profile
metabase-cli profile switch staging

# Show current profile
metabase-cli profile current

# Remove a profile
metabase-cli profile remove staging
```

## Commands

### Authentication

```bash
metabase-cli login               # Re-login (refresh session token)
metabase-cli logout              # End session
metabase-cli whoami              # Show cached user info
metabase-cli whoami --refresh    # Re-fetch user info from server
```

### Queries

```bash
# Run SQL against a database
metabase-cli query run --sql "SELECT * FROM orders LIMIT 5" --db 1

# Output as JSON
metabase-cli query run --sql "SELECT count(*) FROM users" --db 1 --format json

# Output as CSV
metabase-cli query run --sql "SELECT * FROM products" --db 1 --format csv

# Select specific columns
metabase-cli query run --sql "SELECT * FROM users" --db 1 --columns "id,email,name"

# Limit rows
metabase-cli query run --sql "SELECT * FROM events" --db 1 --limit 100

# Export to file (format auto-detected from extension)
metabase-cli query run --sql "SELECT * FROM orders" --db 1 --output orders.csv
metabase-cli query run --sql "SELECT * FROM orders" --db 1 --output orders.xlsx
metabase-cli query run --sql "SELECT * FROM orders" --db 1 --output orders.json
```

### Questions (Saved Cards)

```bash
# List questions
metabase-cli question list
metabase-cli question list --filter mine

# Show question details
metabase-cli question show 42

# Run a saved question
metabase-cli question run 42
metabase-cli question run 42 --format csv

# Run with parameters
metabase-cli question run 42 --params '{"start_date":"2025-01-01"}'

# Export a saved question to file
metabase-cli question run 42 --output results.csv
metabase-cli question run 42 --output results.xlsx

# Create a question
metabase-cli question create --name "Active Users" --sql "SELECT * FROM users WHERE active = true" --db 1 --collection 5

# Create with display type and visualization settings
metabase-cli question create --name "Revenue Trend" --sql "SELECT date, sum(amount) FROM orders GROUP BY date" --db 1 --display line --viz '{"graph.show_values":true}'

# Create with parameterized query (template tags)
metabase-cli question create --name "Users Since" --sql "SELECT * FROM users WHERE created_at >= {{start_date}}" --db 1 \
  --template-tags '{"start_date":{"type":"date","name":"start_date","display-name":"Start Date","default":"2024-01-01"}}'

# Update a question (safe mode blocks if you're not the creator)
metabase-cli question update 42 --name "New Name"
metabase-cli question update 42 --display line --viz '{"graph.show_values":true}'
metabase-cli question update 42 --sql "SELECT ..." --unsafe   # bypass safe mode

# Delete a question
metabase-cli question delete 42
metabase-cli question delete 42 --unsafe

# Copy a question
metabase-cli question copy 42 --name "Copy of Active Users" --collection 10
```

### Dashboards

```bash
metabase-cli dashboard list
metabase-cli dashboard show 7
metabase-cli dashboard create --name "Sales Overview" --collection 5
metabase-cli dashboard update 7 --name "Updated Name"
metabase-cli dashboard update 7 --name "..." --unsafe
metabase-cli dashboard delete 7
metabase-cli dashboard copy 7 --name "Sales Overview (copy)"

# Add/remove cards from a dashboard
metabase-cli dashboard add-card 7 --card 42
metabase-cli dashboard add-card 7 --card 42 --width 12 --height 8
metabase-cli dashboard add-card 7 --card 42 --row 0 --col 6
metabase-cli dashboard remove-card 7 --card 42
```

### Collections

```bash
metabase-cli collection list
metabase-cli collection tree                  # Hierarchical view
metabase-cli collection show 5
metabase-cli collection items 5               # List items in collection
metabase-cli collection items 5 --models card # Only questions
metabase-cli collection create --name "Analytics" --parent 3
metabase-cli collection update 5 --name "New Name"
```

### Databases, Tables & Fields

```bash
# Databases
metabase-cli database list
metabase-cli database show 1
metabase-cli database schemas 1
metabase-cli database tables 1 public         # Tables in schema

# Tables
metabase-cli table show 15
metabase-cli table metadata 15                # Fields and types
metabase-cli table fks 15                     # Foreign keys

# Fields
metabase-cli field show 100
metabase-cli field values 100                 # Distinct values
```

### Search

```bash
metabase-cli search "revenue"
metabase-cli search "revenue" --models card,dashboard
metabase-cli search "users" --limit 5 --format json
```

### SQL Snippets

```bash
metabase-cli snippet list
metabase-cli snippet show 3
metabase-cli snippet create --name "Active filter" --content "WHERE active = true"
metabase-cli snippet update 3 --content "WHERE active = true AND deleted_at IS NULL"
metabase-cli snippet update 3 --content "..." --unsafe
```

### Alerts

```bash
metabase-cli alert list
metabase-cli alert show 3
metabase-cli alert create --card 42 --condition rows --first-only
metabase-cli alert create --card 42 --condition goal --above-goal --recipients 1,2,3
metabase-cli alert update 3 --condition goal --above-goal
metabase-cli alert delete 3
```

### Revisions

```bash
# View revision history for a question or dashboard
metabase-cli revision list card 42
metabase-cli revision list dashboard 7

# Revert to a specific revision
metabase-cli revision revert card 42 123
```

### Activity

```bash
metabase-cli activity recent          # Recently viewed items
metabase-cli activity popular         # Popular items
```

### Timelines & Events

```bash
# Manage timelines
metabase-cli timeline list
metabase-cli timeline show 1
metabase-cli timeline create --name "Product Launches" --icon rocket
metabase-cli timeline update 1 --name "Renamed"
metabase-cli timeline delete 1

# Manage timeline events
metabase-cli timeline add-event 1 --name "v2.0 Release" --timestamp "2025-06-01T00:00:00Z"
metabase-cli timeline add-event 1 --name "Launch" --timestamp "2025-03-15T14:30:00Z" --time-matters
metabase-cli timeline update-event 5 --name "Renamed Event"
metabase-cli timeline delete-event 5
```

### Segments

```bash
metabase-cli segment list
metabase-cli segment show 1
metabase-cli segment create --name "Big Orders" --table 5 --definition '{"filter":[">",[" field",10],100]}'
metabase-cli segment update 1 --name "Large Orders" --revision-message "Renamed"
metabase-cli segment delete 1
```

### Notifications

```bash
metabase-cli notification list
metabase-cli notification show 1
metabase-cli notification create --card 42 --channel-type email --recipients "1,2,3"
metabase-cli notification update 1 --active false
metabase-cli notification send 1
```

## Safe Mode

By default, **update** and **delete** operations are blocked if you are not the creator of the entity. This prevents accidentally modifying questions, dashboards, or snippets owned by other team members.

Safe mode compares the entity's `creator_id` against your cached user ID (set at profile-add or login time — no extra API call per operation).

To bypass safe mode:

```bash
# Per-command
metabase-cli question update 42 --name "..." --unsafe

# Via environment variable
METABASE_UNSAFE=1 metabase-cli question update 42 --name "..."
```

## Output Formats

All query commands support `--format`:

| Format  | Description              | Stdout | `--output` |
|---------|--------------------------|--------|------------|
| `table` | ASCII table (default)    | Yes    | Yes        |
| `json`  | Raw JSON                 | Yes    | Yes        |
| `csv`   | Comma-separated values   | Yes    | Yes        |
| `tsv`   | Tab-separated values     | Yes    | Yes        |
| `xlsx`  | Excel spreadsheet        | No     | Yes        |

### Exporting to Files

Use `--output <file>` to write results directly to a file. The format is auto-detected from the file extension:

```bash
metabase-cli query run --sql "SELECT * FROM orders" --db 1 --output orders.csv
metabase-cli question run 42 --output results.xlsx
```

When using `--output` with CSV, JSON, or XLSX formats, the CLI uses Metabase's native export API which **bypasses the 2000-row limit** — all rows are exported.

## Library Usage

The package also exports a programmatic API:

```typescript
import { MetabaseClient, DatasetApi, CardApi } from "metabase-cli";

const client = new MetabaseClient({
  name: "prod",
  domain: "https://metabase.example.com",
  auth: { method: "api-key", apiKey: "mb_xxxxx" },
});

// Run a query
const dataset = new DatasetApi(client);
const result = await dataset.queryNative(1, "SELECT * FROM users LIMIT 10");
console.log(result.data.rows);

// Export to CSV/JSON/XLSX (bypasses 2000-row limit)
const csvBuffer = await dataset.exportBinary(
  { type: "native", database: 1, native: { query: "SELECT * FROM orders" } },
  "csv",
);
fs.writeFileSync("orders.csv", csvBuffer);

// Get a question
const cards = new CardApi(client);
const question = await cards.get(42);
console.log(question.name);

// Export a saved question
const xlsxBuffer = await cards.queryExportBinary(42, "xlsx");
fs.writeFileSync("results.xlsx", xlsxBuffer);
```

Additional API modules available: `AlertApi`, `RevisionApi`, `ActivityApi`, `TimelineApi`, `SegmentApi`, `NotificationApi`.

## Security

Profile credentials are stored in `~/.metabase-cli/config.json`. The file is created with `0600` permissions (owner-only read/write), but **passwords are stored in plaintext**. For production use, prefer API key auth (`--api-key`) over email/password auth.

Do not commit or share your `~/.metabase-cli/config.json` file.

## Development

```bash
git clone <repo-url>
cd metabase-cli
npm install
npm run build        # Build with tsup
npm run dev          # Watch mode
npm run typecheck    # Type checking
npm test             # Run tests
```

## License

MIT
