import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const files = git('ls-files', '-z').split('\0').filter(Boolean);
if (!files.length) throw new Error('Stage the source files before checking submission size.');
const limit = 10_000_000;
let bytes = 0;
const problems = [];
for (const path of files) {
  // Count and inspect the same bytes, without a separate filesystem metadata check.
  const content = readFileSync(path);
  bytes += content.byteLength;
  if (/(^|\/)(node_modules|dist|coverage|test-results|playwright-report)\//.test(path))
    problems.push(`Generated file tracked: ${path}`);
  if (/(^|\/)\.env(?:\.|$)/.test(path) && path !== '.env.example')
    problems.push(`Environment file tracked: ${path}`);
  if (/\.(?:pem|p12|pfx|key)$/i.test(path)) problems.push(`Credential file tracked: ${path}`);
  if (!/\.(?:png|jpe?g|webp|ico|woff2?)$/i.test(path)) {
    const source = content.toString('utf8');
    if (
      /(?:sk-(?:proj-)?[\w-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/.test(
        source,
      )
    )
      problems.push(`Possible secret in: ${path}`);
  }
}
const branches = git('for-each-ref', '--format=%(refname:short)', 'refs/heads').split('\n');
if (branches.length !== 1 || branches[0] !== 'main')
  problems.push('Submission must have only the main branch.');
if (bytes >= limit)
  problems.push(`Tracked source is ${bytes} bytes; limit is strictly below ${limit}.`);
if (problems.length) throw new Error(problems.join('\n'));
console.log(
  `PASS: ${files.length} tracked files, ${bytes.toLocaleString()} bytes (${(bytes / 1_000_000).toFixed(2)} MB), one main branch, no generated files or recognized secret patterns.`,
);
console.log(
  'This checks tracked source. Verify public visibility, remote branches, and GitHub repository size separately before submitting.',
);
