export function normalizeRows({ rows, expectedWidth, fill = 0 }) {
  if (!Number.isInteger(expectedWidth) || expectedWidth < 1) {
    throw new RangeError('expectedWidth must be a positive integer');
  }

  const widest = rows.reduce((max, row) => Math.max(max, row.length), 0);

  if (widest !== expectedWidth) {
    throw new RangeError(
      `widest source row is ${widest} columns, authoritative width is ${expectedWidth}`
    );
  }

  return rows.map((row) => {
    const padded = row.slice(0, expectedWidth);
    while (padded.length < expectedWidth) padded.push(fill);
    return padded;
  });
}

export function buildPatchPayload({ rows, expectedWidth, targetRange, fill = 0 }) {
  const values = normalizeRows({ rows, expectedWidth, fill });
  return { targetRange, values };
}
