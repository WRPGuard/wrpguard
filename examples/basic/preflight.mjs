// Minimal relying-party integration (synthetic data only): run WRPGuard on every DCQL query
// before it goes into an OpenID4VP Authorization Request, and refuse to send anything that is
// not `pass`. Run with `node examples/basic/preflight.mjs` after `pnpm install && pnpm build`.
import { readFileSync } from 'node:fs';
import { evaluateDcqlScopeFromJson } from '@wrpguard/core';

// The scope declaration this relying party maintains for one service and intended use. WRPGuard
// does not verify it; where it comes from and how it is kept current is the integrator's job.
const scopeJson = readFileSync(new URL('./scope.json', import.meta.url), 'utf8');
const context = { serviceId: 'onboarding', intendedUseId: 'age-check' };

/**
 * Checks a DCQL query and returns the exact JSON text to send, or why it must not be sent.
 * Serializing once and sending the same text keeps what was checked identical to what is sent.
 */
export function preflight(dcqlQuery) {
  const dcqlQueryJson = JSON.stringify(dcqlQuery);
  const result = evaluateDcqlScopeFromJson({ scopeJson, dcqlQueryJson, context });
  if (!result.ok) {
    return { send: false, decision: 'invalid_input', reasons: result.error.issues.map((issue) => `${issue.code} at ${issue.pointer}`) };
  }
  const { decision, findings } = result.report;
  return {
    send: decision === 'pass',
    decision,
    dcqlQueryJson,
    reasons: findings.map((finding) => `${finding.code} at ${finding.pointer}`),
  };
}

const ageQuery = (claims) => ({
  credentials: [
    {
      id: 'age',
      format: 'dc+sd-jwt',
      meta: { vct_values: ['https://example.org/credentials/age-attestation'] },
      claims: claims.map((path) => ({ path })),
    },
  ],
});

const candidates = {
  'age-only': ageQuery([['age_over_18']]),
  'age-and-birth-date': ageQuery([['age_over_18'], ['birth_date']]),
  'no-claims-list': { credentials: [{ ...ageQuery([]).credentials[0], claims: undefined }] },
};

for (const [name, query] of Object.entries(candidates)) {
  const outcome = preflight(query);
  if (outcome.send) {
    // A real relying party would now put outcome.dcqlQueryJson into its signed request.
    console.log(`${name}: ${outcome.decision} -> send`);
  } else {
    console.log(`${name}: ${outcome.decision} -> blocked (${outcome.reasons.join('; ')})`);
  }
}
