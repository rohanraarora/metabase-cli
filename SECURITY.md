# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.2.x   | Yes       |
| < 0.2   | No        |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue.
2. Email the maintainers or use [GitHub's private vulnerability reporting](https://github.com/rohanraarora/metabase-cli/security/advisories/new).
3. Include a description of the vulnerability, steps to reproduce, and potential impact.

We will acknowledge your report within 48 hours and aim to release a fix within 7 days for critical issues.

## Security Considerations

- **Credentials storage**: Profile credentials (passwords, API keys) are stored in `~/.metabase-cli/config.json` with `0600` permissions. Passwords are stored in plaintext. For production use, prefer API key auth.
- **Do not commit** your `~/.metabase-cli/config.json` file to version control.
- **Network security**: All API calls are made over HTTPS. Ensure your Metabase instance uses HTTPS.
