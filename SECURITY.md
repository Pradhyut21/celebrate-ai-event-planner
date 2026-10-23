# Security policy

Do not open a public issue containing secrets, personal event data, or a working exploit. Use the repository's **Security → Report a vulnerability** feature when enabled, or send a minimal private report to the repository owner using a contact listed on their GitHub profile. Include the affected commit, impact, and reproduction steps without live credentials.

The current `main` branch is supported. Dependencies are pinned by the lockfile and monitored through Dependabot. CI runs dependency auditing and tests. These checks reduce risk; they do not establish that software has no vulnerabilities.

See [the threat model](docs/THREAT_MODEL.md) for trust boundaries, safeguards, and deployment limitations. This is a personal, single-instance planner. Browser storage is not encrypted. It must not be used as a multi-user service without an identity/authorization layer and isolated persistence.

If a key is exposed, revoke it at the provider immediately, replace it only in the deployment environment, and remove it from Git history. Removing it from the latest source does not revoke it.
