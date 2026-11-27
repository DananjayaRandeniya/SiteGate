/// <reference types="node" />
// Simulates a gate tapping a card.
// Usage: npx tsx scripts/simulate-gate.ts <credentialNumber> [siteId] [gateId] [ENTRY|EXIT] [count]
const [
  credentialNumber,
  siteId = 'S-01',
  gateId = 'G-01',
  direction = 'ENTRY',
  count = '1',
] = process.argv.slice(2);

const baseUrl = process.env.ACCESS_URL ?? 'http://localhost:3002';

async function main() {
  if (!credentialNumber) {
    console.error('Usage: npx tsx scripts/simulate-gate.ts <credentialNumber> [siteId] [gateId] [ENTRY|EXIT] [count]');
    process.exit(1);
  }

  const durations: number[] = [];

  for (let i = 1; i <= Number(count); i++) {
    const started = Date.now();
    const res = await fetch(`${baseUrl}/access-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialNumber, siteId, gateId, direction }),
    });
    const body = await res.json();
    const ms = Date.now() - started;
    durations.push(ms);

    // Print every tap only for short runs
    if (Number(count) <= 10) {
      console.log(`#${i} HTTP ${res.status} ${JSON.stringify(body)} (${ms} ms)`);
    }
  }

  if (durations.length > 1) {
    const sorted = [...durations].sort((a, b) => a - b);
    const p95 = sorted[Math.ceil(sorted.length * 0.95) - 1];
    const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
    console.log(`${durations.length} taps: avg ${avg} ms, p95 ${p95} ms, max ${sorted[sorted.length - 1]} ms`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});