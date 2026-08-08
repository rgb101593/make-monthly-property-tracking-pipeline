export const ZERO_FILL = 'zero';
export const PRESERVE = 'preserve';

export function normalizeCode(code) {
  return String(code).trim().toLowerCase();
}

export function mapCategories({
  sourceRows,
  targetCodes,
  aliases = {},
  existingValues = [],
  unmatched = ZERO_FILL
}) {
  if (unmatched !== ZERO_FILL && unmatched !== PRESERVE) {
    throw new RangeError(`unknown unmatched policy: ${unmatched}`);
  }

  const wanted = new Set(targetCodes.map(normalizeCode));
  const normalizedAliases = new Map(
    Object.entries(aliases).map(([source, target]) => [normalizeCode(source), normalizeCode(target)])
  );
  const totals = new Map();
  const unmappedSourceCodes = [];

  for (const row of sourceRows) {
    if (typeof row.value !== 'number' || !Number.isFinite(row.value)) {
      throw new TypeError(`value for ${row.code} must be a finite number`);
    }

    const sourceCode = normalizeCode(row.code);
    const resolved = normalizedAliases.get(sourceCode) ?? sourceCode;
    if (!wanted.has(resolved)) {
      if (row.value !== 0) unmappedSourceCodes.push(row.code);
      continue;
    }
    totals.set(resolved, (totals.get(resolved) ?? 0) + row.value);
  }

  const values = targetCodes.map((code, i) => {
    const key = normalizeCode(code);
    if (totals.has(key)) return totals.get(key);
    return unmatched === PRESERVE ? (existingValues[i] ?? null) : 0;
  });

  return { values, unmappedSourceCodes };
}
