/**
 * The env rule (src/lib/env-rule.ts) reads the project's environment list
 * before a project-scoped command. Route tests that replace `fetch` answer
 * that read here — a project with only PROD, so the command runs as before —
 * and keep it out of the calls they count. `env-rule.test.ts` tests the rule.
 */
export function envListAnswer(input: RequestInfo | URL, init?: RequestInit, environments: string[] = ['PROD']): Response | undefined {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if ((init?.method ?? 'GET') !== 'GET' || !/\/account\/projects\/environments$/.test(new URL(href).pathname)) return undefined
  return new Response(JSON.stringify({item: {environments}}), {status: 200, headers: {'Content-Type': 'application/json'}})
}
