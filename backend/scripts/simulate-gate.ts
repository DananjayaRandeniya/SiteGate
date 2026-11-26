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

  for (let i = 1; i <= Number(count); i++) {
    const started = Date.now();
    const res = await fetch(`${baseUrl}/access-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialNumber, siteId, gateId, direction }),
    });
    const body = await res.json();
    console.log(`#${i} HTTP ${res.status} ${JSON.stringify(body)} (${Date.now() - started} ms)`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});