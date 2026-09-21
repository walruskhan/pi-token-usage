# List available development commands.
default:
    @just --list

# Check TypeScript syntax without emitting files.
check:
    pnpm check

# Check extension code for lint errors.
lint:
    pnpm lint

# Apply lint fixes to extension code.
lint-fix:
    pnpm lint-fix

# Populate the local database with sample data.
mock-data:
    pnpm mock-data

# Open the local database in DB Browser for SQLite.
db:
    @DB="${PI_CODING_AGENT_DIR:-$HOME/.pi/agent}/token-usage.sqlite"; if ! command -v sqlitebrowser >/dev/null 2>&1; then echo "sqlitebrowser is not installed. Install DB Browser for SQLite, then run just db again." >&2; exit 1; fi; sqlitebrowser "$DB"

# Configure the repository Git hooks.
install-hooks:
    git config core.hooksPath .githooks

# Scan staged files for accidentally committed secrets.
secrets:
    git diff --cached --name-only --diff-filter=ACMR -z | xargs -0 -r detect-secrets-hook

# Launch Pi with the local extension.
pi:
    pi -e extensions/main.ts
