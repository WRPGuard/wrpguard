/** Shared synthetic test data. No real identity data anywhere. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';
import {
  evaluateDcqlScope,
  type EvaluateOptions,
  type EvaluationContext,
  type EvaluationReport,
  type EvaluationResult,
  type InputErrorReport,
} from '@wrpguard/core';

export const FIXTURES_DIR = fileURLToPath(new URL('../../../fixtures/', import.meta.url));

export function fixtureText(name: string): string {
  return readFileSync(FIXTURES_DIR + name, 'utf8');
}

/** Fixtures are trusted test data, so JSON.parse is acceptable here. */
export function fixture(name: string): unknown {
  return JSON.parse(fixtureText(name)) as unknown;
}

export const AGE_VCT = 'https://example.org/credentials/age-attestation';
export const MDL = 'org.iso.18013.5.1.mDL';
export const MDL_NS = 'org.iso.18013.5.1';
export const CONTEXT: EvaluationContext = { serviceId: 'onboarding', intendedUseId: 'age-check' };

export type Path = (string | number | null)[];

export interface ScopeCredentialSpec {
  format: 'dc+sd-jwt' | 'mso_mdoc';
  type: string;
  claims: Path[];
}

export function makeScope(credentials: ScopeCredentialSpec[]): Record<string, unknown> {
  return {
    schemaVersion: 'wrpguard.scope/1',
    relyingPartyId: 'rp-demo',
    serviceId: 'onboarding',
    intendedUseId: 'age-check',
    credentials,
  };
}

export const SCOPE = fixture('scope.json');

export function sdJwtQuery(paths: Path[] | undefined, vct: string[] = [AGE_VCT], id = 'age'): Record<string, unknown> {
  const query: Record<string, unknown> = { id, format: 'dc+sd-jwt', meta: { vct_values: vct } };
  if (paths !== undefined) query['claims'] = paths.map((path) => ({ path }));
  return query;
}

export function mdocQuery(paths: Path[], doctype = MDL, id = 'mdl'): Record<string, unknown> {
  return { id, format: 'mso_mdoc', meta: { doctype_value: doctype }, claims: paths.map((path) => ({ path })) };
}

export function dcql(...credentials: Record<string, unknown>[]): Record<string, unknown> {
  return { credentials };
}

export function evaluateRaw(
  dcqlQuery: unknown,
  overrides: { scope?: unknown; context?: EvaluationContext; options?: EvaluateOptions } = {},
): EvaluationResult {
  return evaluateDcqlScope(
    { scope: overrides.scope ?? SCOPE, dcqlQuery, context: overrides.context ?? CONTEXT },
    overrides.options,
  );
}

/** Evaluates and asserts the inputs were valid. */
export function evaluate(
  dcqlQuery: unknown,
  overrides: { scope?: unknown; context?: EvaluationContext; options?: EvaluateOptions } = {},
): EvaluationReport {
  const result = evaluateRaw(dcqlQuery, overrides);
  if (!result.ok) {
    throw new Error(`expected a report, got invalid input: ${JSON.stringify(result.error.issues)}`);
  }
  return result.report;
}

/** Evaluates and asserts the inputs were rejected. */
export function rejected(
  dcqlQuery: unknown,
  overrides: { scope?: unknown; context?: EvaluationContext; options?: EvaluateOptions } = {},
): InputErrorReport {
  const result = evaluateRaw(dcqlQuery, overrides);
  expect(result.ok, 'expected invalid input').toBe(false);
  if (result.ok) throw new Error('unreachable');
  return result.error;
}

export function codes(report: EvaluationReport): string[] {
  return report.findings.map((finding) => finding.code);
}
