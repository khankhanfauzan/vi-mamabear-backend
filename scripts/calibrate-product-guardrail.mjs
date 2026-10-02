import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { OpenRouter } from '@openrouter/sdk';

const path = process.argv[2];
if (!path)
  throw new Error(
    'Usage: node scripts/calibrate-product-guardrail.mjs cases.json',
  );
const cases = JSON.parse(await readFile(path, 'utf8'));
if (
  !Array.isArray(cases) ||
  cases.some(
    (item) =>
      typeof item.query !== 'string' || typeof item.expected !== 'boolean',
  ) ||
  cases.filter((item) => item.expected).length < 3 ||
  cases.filter((item) => !item.expected).length < 3
) {
  throw new Error(
    'Provide at least three independently labelled positive and negative product queries',
  );
}
const db = new Client({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  query_timeout: 15000,
});
const router = new OpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
const rows = [];
try {
  await db.connect();
  // Import the actual extraction/identity policy rather than duplicating it.
  const ts = await import('typescript');
  const source = await readFile(
    new URL('../src/ai/guardrail/product-scope.ts', import.meta.url),
    'utf8',
  );
  const compiled = ts.default.transpileModule(source, {
    compilerOptions: { module: ts.default.ModuleKind.ES2022 },
  }).outputText;
  const { extractProductQueries, matchesProductIdentity } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );
  const catalog = (
    await db.query(
      'SELECT id, name, tags FROM "Product" WHERE "isActive" = true ORDER BY id',
    )
  ).rows;
  const normalize = (value) =>
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  for (const item of cases) {
    const queries = extractProductQueries(item.query);
    if (queries.length !== 1)
      throw new Error(
        `Calibration needs one specific product per case: ${item.query}`,
      );
    const query = queries[0];
    const result = await router.embeddings.generate({
      requestBody: {
        model: 'liquid/lfm-2.5-embedding-350m:free',
        input: query,
        encodingFormat: 'float',
      },
    });
    const embedding = result.data[0].embedding;
    if (
      embedding.length !== 1024 ||
      embedding.some((value) => !Number.isFinite(value))
    )
      throw new Error('Invalid embedding');
    const matches = (
      await db.query(
        'SELECT id, name, tags, 1 - (embedding <=> $1::vector) AS similarity FROM "Product" WHERE "isActive" = true AND embedding IS NOT NULL ORDER BY embedding <=> $1::vector, id LIMIT 20',
        [`[${embedding.join(',')}]`],
      )
    ).rows;
    const literal = catalog.some((product) =>
      [product.name, ...product.tags].some((value) =>
        ` ${normalize(value)} `.includes(` ${normalize(query)} `),
      ),
    );
    const compatible = matches.filter((product) =>
      matchesProductIdentity(query, product),
    );
    rows.push({
      ...item,
      phrase: query,
      literal,
      topMatch: matches[0] ?? null,
      compatibleScore: compatible[0]?.similarity ?? null,
    });
  }
  const positiveScores = rows
    .filter((item) => item.expected && !item.literal)
    .map((item) => item.compatibleScore);
  const negativeScores = rows
    .filter((item) => !item.expected && item.compatibleScore !== null)
    .map((item) => item.compatibleScore);
  const minPositive =
    positiveScores.length && positiveScores.every((score) => score !== null)
      ? Math.min(...positiveScores)
      : null;
  const maxNegative = negativeScores.length ? Math.max(...negativeScores) : -1;
  // Literal-only positives cannot establish a semantic cutoff.
  const recommendedThreshold =
    minPositive !== null && minPositive > maxNegative
      ? (Math.max(0, maxNegative) + minPositive) / 2
      : null;
  const threshold = Number(process.env.PRODUCT_MATCH_THRESHOLD ?? 0.75);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
    throw new Error('Invalid PRODUCT_MATCH_THRESHOLD');
  for (const item of rows)
    item.allowed =
      item.literal ||
      (item.compatibleScore !== null && item.compatibleScore >= threshold);
  const report = {
    measuredAt: new Date().toISOString(),
    model: 'liquid/lfm-2.5-embedding-350m:free',
    activeProducts: catalog.length,
    threshold,
    recommendedThreshold,
    falsePositives: rows.filter((item) => item.expected && !item.allowed)
      .length,
    falseAcceptances: rows.filter((item) => !item.expected && item.allowed)
      .length,
    rows,
  };
  console.log(JSON.stringify(report, null, 2));
  if (
    report.falsePositives ||
    report.falseAcceptances ||
    recommendedThreshold === null
  )
    process.exitCode = 1;
} finally {
  await db.end();
}
