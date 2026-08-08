import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRows, buildPatchPayload } from '../src/sparse-rows.js';

test('a sparse first row does not define the width', () => {
  const rows = [
    [11, 12],
    [21, 22, 23, 24, 25],
    [31, 32, 33]
  ];

  const values = normalizeRows({ rows, expectedWidth: 5 });

  assert.deepEqual(values[0], [11, 12, 0, 0, 0]);
  assert.deepEqual(values[1], [21, 22, 23, 24, 25]);
  assert.deepEqual(values[2], [31, 32, 33, 0, 0]);
  assert.equal(new Set(values.map((r) => r.length)).size, 1);
});

test('values are not right-aligned when the first row is short', () => {
  const values = normalizeRows({ rows: [[11], [21, 22, 23]], expectedWidth: 3 });

  assert.equal(values[0][0], 11);
  assert.equal(values[0][2], 0);
});

test('a source narrower than the authoritative width throws', () => {
  assert.throws(
    () => normalizeRows({ rows: [[11, 12], [21, 22]], expectedWidth: 5 }),
    RangeError
  );
});

test('a source wider than the authoritative width throws', () => {
  assert.throws(
    () => normalizeRows({ rows: [[11, 12, 13, 14]], expectedWidth: 3 }),
    RangeError
  );
});

test('a width mismatch produces no write payload', () => {
  let payload;

  assert.throws(() => {
    payload = buildPatchPayload({
      rows: [[11, 12], [21, 22]],
      expectedWidth: 5,
      targetRange: 'synthetic-range'
    });
  }, RangeError);

  assert.equal(payload, undefined);
});

test('a matching width produces a payload with uniform rows', () => {
  const payload = buildPatchPayload({
    rows: [[11], [21, 22, 23]],
    expectedWidth: 3,
    targetRange: 'synthetic-range'
  });

  assert.equal(payload.targetRange, 'synthetic-range');
  assert.deepEqual(payload.values, [
    [11, 0, 0],
    [21, 22, 23]
  ]);
});
