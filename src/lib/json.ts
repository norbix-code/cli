/** Helpers for JSON flags: accept inline JSON or `-` to read from stdin. */

export async function readJsonInput(value: string, flagName: string): Promise<string> {
  const raw = value === '-' ? await readStdin() : value
  try {
    // Parse + re-stringify: validates and normalizes the JSON the backend
    // receives (all Norbix DTOs take filters/documents as JSON strings).
    return JSON.stringify(JSON.parse(raw))
  } catch {
    throw new Error(`--${flagName} is not valid JSON: ${truncate(raw)}`)
  }
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

function truncate(text: string, max = 120): string {
  return text.length > max ? `${text.slice(0, max)}…` : text
}
