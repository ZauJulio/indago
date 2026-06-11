# Skill — Change a schema

1. Edit `<contentDir>/<type>/schema.json`.
2. Update the existing `.json` files to match (`strict: true` ⇒ unknown properties fail).
3. `hyperjson validate both`.
4. `hyperjson generate` — regenerate types; fix any new TS errors in consumers.

Checks: [../rules/checks.md](../rules/checks.md) · CLI: [cli.md](cli.md).
