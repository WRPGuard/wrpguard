/** Human-readable and JSON rendering. Every untrusted-derived string is escaped for terminals. */
import {
  escapeControlCharacters,
  escapeJsonForDisplay,
  REPORT_NOTICE,
  type EvaluationReport,
  type InputErrorReport,
} from '@wrpguard/core';

export const EXIT_CODES = { pass: 0, error: 1, fail: 2, indeterminate: 3 } as const;

/** One JSON document with display-unsafe characters escaped (still valid, equivalent JSON). */
export function renderJson(document: EvaluationReport | InputErrorReport): string {
  return `${escapeJsonForDisplay(JSON.stringify(document, null, 2))}\n`;
}

const safe = escapeControlCharacters;

export function renderReport(report: EvaluationReport): string {
  const exit = EXIT_CODES[report.decision];
  const { subject, evaluated } = report;
  const lines = [
    `WRPGuard preflight: ${report.decision.toUpperCase()} (exit ${String(exit)})`,
    `Scope: relying party ${safe(JSON.stringify(subject.relyingPartyId))}, service ${safe(JSON.stringify(subject.serviceId))}, ` +
      `intended use ${safe(JSON.stringify(subject.intendedUseId))} (caller-supplied, unverified)`,
    `Evaluated ${plural(evaluated.credentialQueries, 'credential query', 'credential queries')}, ` +
      `${plural(evaluated.claimQueries, 'claim query', 'claim queries')} under ${report.policyVersion}`,
  ];
  if (report.findings.length === 0) {
    lines.push('', 'No findings.');
  } else {
    lines.push('', `Findings (${String(report.totalFindings)}):`);
    for (const finding of report.findings) {
      lines.push(
        `  [${finding.effect}] ${finding.code} (${finding.ruleId}) at ${finding.source}${safe(finding.pointer) || '/'}`,
        `      ${safe(finding.message)}`,
      );
    }
    if (report.findingsTruncated) {
      lines.push(`  ... ${String(report.totalFindings - report.findings.length)} more findings omitted`);
    }
  }
  lines.push('', `Note: ${REPORT_NOTICE}`, '');
  return lines.join('\n');
}

export function renderInputError(error: InputErrorReport): string {
  const lines = [`WRPGuard preflight: INVALID INPUT (exit ${String(EXIT_CODES.error)})`];
  for (const issue of error.issues) {
    lines.push(`  [${issue.code}] ${issue.source}${safe(issue.pointer) || '/'}: ${safe(issue.message)}`);
  }
  if (error.issuesTruncated) lines.push('  ... more issues omitted');
  lines.push('');
  return lines.join('\n');
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
