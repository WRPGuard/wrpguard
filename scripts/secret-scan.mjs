// Basic regex secret scan of the working tree. Not a substitute for a dedicated scanner
// (e.g. gitleaks) on the full git history before any public push.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const skipDirs = new Set(['node_modules', 'dist', '.git', 'coverage']);
const skipFiles = new Set(['pnpm-lock.yaml']);

// Patterns are assembled from parts so this file does not match itself.
const patterns = [
  ['private key block', new RegExp('-----BEGIN ' + '[A-Z ]*PRIVATE KEY-----')],
  ['AWS access key id', new RegExp('\\b(AKIA|ASIA)' + '[0-9A-Z]{16}\\b')],
  ['GitHub token', new RegExp('\\b(gh[pousr]_' + '[A-Za-z0-9]{36,}|github_pat_' + '[A-Za-z0-9_]{50,})\\b')],
  ['npm token', new RegExp('\\bnpm_' + '[A-Za-z0-9]{36}\\b')],
  ['Slack token', new RegExp('\\bxox[baprs]-' + '[A-Za-z0-9-]{10,}')],
  ['Stripe live key', new RegExp('\\b(sk|rk)_live_' + '[A-Za-z0-9]{16,}')],
  ['Google API key', new RegExp('\\bAIza' + '[0-9A-Za-z_-]{35}\\b')],
  ['JWT', new RegExp('\\beyJ[A-Za-z0-9_-]{10,}\\.' + 'eyJ[A-Za-z0-9_-]{10,}\\.[A-Za-z0-9_-]{10,}')],
  ['generic assigned secret', new RegExp('(api[_-]?key|secret|passw(or)?d|token)["\']?\\s*[:=]\\s*["\'][A-Za-z0-9/+_=-]{20,}["\']', 'i')],
];

const findings = [];
let scanned = 0;
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (skipDirs.has(name) || skipFiles.has(name)) continue;
    const path = join(dir, name);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      walk(path);
    } else if (stats.isFile() && stats.size < 5 * 1024 * 1024) {
      scanned++;
      const lines = readFileSync(path, 'utf8').split('\n');
      lines.forEach((line, index) => {
        for (const [label, pattern] of patterns) {
          if (pattern.test(line)) findings.push(`${relative(root, path)}:${String(index + 1)}: ${label}`);
        }
      });
    }
  }
}
walk(root);

if (findings.length > 0) {
  console.error(findings.join('\n'));
  console.error(`secret-scan: ${String(findings.length)} potential secret(s) in ${String(scanned)} files`);
  process.exit(1);
}
console.log(`secret-scan: no matches in ${String(scanned)} files (regex scan of working tree only)`);
