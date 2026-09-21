# Pi Token Stats

A persistent token and cost usage dashboard for Pi.

## Features

- **Persistent SQLite history** — Records usage across sessions without deleting historical data.
- **Provider and model breakdowns** — Tracks provider, model, input/output/reasoning/cache tokens, request counts, and reported costs.
- **Time-based cost charts** — Shows daily, weekly, monthly, and annual costs.
- **Provider summaries** — Displays provider summary cards and provider cost charts.
- **Date-range filtering** — Filter all summaries, charts, and model tables with calendar controls.
- **Zero-value periods** — Optionally include periods with no usage; enabled by default.
- **Water-impact estimate** — Estimates water usage for all tokens in the selected range using model categories, regions, and low/central/high scenarios.
- **Automatic model classification** — Categorizes models as low, medium, or frontier based on model IDs, with manual overrides.
- **Visual comparisons** — Expresses estimated water usage as glasses, bottles, showers, bathtubs, cashews, milk tankers, blue whales, human bodies, Coke bottles, and Olympic swimming pools.
- **Local-only dashboard** — Serves the dashboard on `127.0.0.1` and opens it in the default browser.
- **Prepared database statements** — Uses `better-sqlite3` and a dedicated SQLite data-access layer.
- **Mock data generator** — Populate the dashboard with sample data across providers and time periods.

## Installation

Install the latest tagged release from GitHub:

```bash
pi install git:github.com/walruskhan/pi-token-usage
```

To install a specific release:

```bash
pi install git:github.com/walruskhan/pi-token-usage@v0.1.0
```

To test the extension from a local checkout without installing it:

```bash
pi -e ./extensions/main.ts
```

The package includes the runtime dependency `better-sqlite3`. No external `sqlite3` command-line binary is required.

## Usage

Open the dashboard from Pi:

```text
/stats
```

The browser dashboard refreshes every 30 seconds. It includes date-range controls with presets for:

- Today
- Week Start (Monday)
- Month Start
- Year Start

Clear the local database with:

```text
/stats-reset
```

`/stats-reset` asks for confirmation, removes the local SQLite database and its WAL files, then reinitializes tracking for the current session. This is the only extension command that deletes statistics.

## Database

The database is stored at:

```text
~/.pi/agent/token-usage.sqlite
```

Or, when configured:

```text
$PI_CODING_AGENT_DIR/token-usage.sqlite
```

Tables:

- `sessions` — Session metadata and lifecycle timestamps.
- `usage_events` — Provider/model usage, input/output/reasoning/cache token counts, costs, timestamps, and source information.

Usage rows are never deleted during normal operation. Stable event keys prevent duplicate writes when a session is reloaded. The database layer lives in:

```text
extensions/SqliteDAL.ts
```

The dashboard is kept separately in:

```text
extensions/dashboard.html
```

## Mock data

Populate the database with sample OpenRouter, Anthropic, and OpenAI data:

```bash
pnpm mock-data
```

The data spans multiple days, weeks, months, and years. Existing records are preserved. Then launch Pi and run `/stats`.

## Development

The project uses Node.js 22, pnpm, Devbox, and Just.

Enter the Devbox environment:

```bash
devbox shell
```

The Devbox shell installs dependencies and builds the native `better-sqlite3` dependency.

## Checks

Run the TypeScript syntax checks:

```bash
pnpm check
```

Run linting:

```bash
pnpm lint
```

Apply lint fixes:

```bash
pnpm lint-fix
```

Install Git hooks:

```bash
pnpm hooks:install
```

The hooks scan staged files for secrets before commits and run checks before pushes.

## Justfile

The `justfile` provides convenient commands:

- `just` — List available commands.
- `just check` — Run TypeScript syntax checks.
- `just lint` — Check extension files for lint errors.
- `just lint-fix` — Apply available lint fixes.
- `just mock-data` — Insert sample usage data.
- `just db` — Open the SQLite database in DB Browser for SQLite.
- `just secrets` — Scan staged files for secrets.
- `just install-hooks` — Configure the repository Git hooks.
- `just pi` — Launch Pi with the local extension.

Launch the local extension directly:

```bash
just pi
```

## Database inspection tools

The `just db` recipe opens the database with **DB Browser for SQLite** (`sqlitebrowser`):

```bash
just db
```

Install DB Browser for SQLite with your system package manager, for example:

```bash
# Arch Linux
sudo pacman -S sqlitebrowser

# Debian/Ubuntu
sudo apt install sqlitebrowser
```

Other useful options:

- **DB Browser for SQLite** — Best general-purpose GUI for browsing tables, running queries, and inspecting indexes.
- **SQLiteStudio** — Full-featured cross-platform GUI with schema browsing and SQL editing.
- **LiteCLI** — Terminal client with autocomplete and table-friendly output.
- **Datasette** — Useful for serving a read-only SQLite database as a local web application.
- **sqlite3** — Minimal command-line tool for quick queries and scripts.

The database path is `~/.pi/agent/token-usage.sqlite`, or `$PI_CODING_AGENT_DIR/token-usage.sqlite` when that environment variable is set.

## Package structure

```text
extensions/
├── main.ts             # Pi package entrypoint
├── token-stats.ts      # Pi events, commands, and dashboard server
├── SqliteDAL.ts        # SQLite access and prepared statements
└── dashboard.html      # Dashboard markup, styles, and browser logic
scripts/
└── seed-mock-data.mjs  # Sample data generator
```

## Publish

Create a Git release:

```bash
git add .
git commit -m "Initial token stats extension"
git branch -M main
git tag v0.1.0
git push origin main --tags
```

Users can install a tagged release with:

```bash
pi install git:github.com/YOUR_USER/pi-token-stats@v0.1.0
```

Before publishing an npm package, inspect the files that will be included:

```bash
npm pack --dry-run
```

No TypeScript build step is required. Pi loads the TypeScript extension directly, while package installation installs the runtime `better-sqlite3` dependency.
