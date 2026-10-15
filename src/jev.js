// Client for TypeSafe's Jev, a classifier: it doesn't write text, it picks among options
// (and answers yes/no) in one fast call (~0.25 s, mostly the request's round trip).

const ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

export async function ask({ apiKey, model = 'jev-latest', state, questions, signal, fetchImpl = fetch, onUsage }) {
  if (!apiKey) throw new Error('Jev API key missing (jevKey in ~/.jev/config.json)');
  for (let attempt = 0; ; attempt++) {
    const res = await fetchImpl(ENDPOINT, {
      method: 'POST',
      signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, state, questions }),
    });
    if (res.ok) {
      const body = await res.json();
      onUsage?.(body.usage);
      return body.answers;
    }
    // 429 rate limited / 529 overloaded: back off briefly and retry.
    if ((res.status === 429 || res.status === 529) && attempt < 3) {
      await new Promise((r) => setTimeout(r, 250 * 2 ** attempt));
      continue;
    }
    throw new Error(`Jev request failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  }
}
