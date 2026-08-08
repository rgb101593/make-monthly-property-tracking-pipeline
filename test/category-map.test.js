import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCategories, ZERO_FILL, PRESERVE } from '../src/category-map.js';

const targetCodes = ['CAT_A', 'CAT_B', 'CAT_C'];

test('duplicate source codes are summed into one target row', () => {
  const { values } = mapCategories({
    sourceRows: [
      { code: 'CAT_A', value: 10 },
      { code: 'CAT_A', value: 5 },
      { code: 'CAT_B', value: 7 }
    ],
    targetCodes
  });

  assert.deepEqual(values, [15, 7, 0]);
});

test('code matching ignores surrounding whitespace and case', () => {
  const { values } = mapCategories({
    sourceRows: [{ code: '  cat_a ', value: 4 }],
    targetCodes
  });

  assert.equal(values[0], 4);
});

test('an alias resolves a source code onto its target', () => {
  const { values } = mapCategories({
    sourceRows: [{ code: 'CAT_A_TOTAL', value: 9 }],
    targetCodes,
    aliases: { CAT_A_TOTAL: 'CAT_A' }
  });

  assert.equal(values[0], 9);
});

test('the zero-fill policy writes zero for an unmatched target', () => {
  const { values } = mapCategories({
    sourceRows: [{ code: 'CAT_A', value: 3 }],
    targetCodes,
    existingValues: [99, 99, 99],
    unmatched: ZERO_FILL
  });

  assert.deepEqual(values, [3, 0, 0]);
});

test('the preserve policy leaves an unmatched target untouched', () => {
  const { values } = mapCategories({
    sourceRows: [{ code: 'CAT_A', value: 3 }],
    targetCodes,
    existingValues: [99, 88, 77],
    unmatched: PRESERVE
  });

  assert.deepEqual(values, [3, 88, 77]);
});

test('a nonzero source code with no target is reported as unmapped', () => {
  const { unmappedSourceCodes } = mapCategories({
    sourceRows: [
      { code: 'CAT_A', value: 3 },
      { code: 'CAT_UNKNOWN', value: 12 }
    ],
    targetCodes
  });

  assert.deepEqual(unmappedSourceCodes, ['CAT_UNKNOWN']);
});

test('a zero-valued source code with no target is not reported', () => {
  const { unmappedSourceCodes } = mapCategories({
    sourceRows: [{ code: 'CAT_UNKNOWN', value: 0 }],
    targetCodes
  });

  assert.deepEqual(unmappedSourceCodes, []);
});

test('an unknown unmatched policy throws', () => {
  assert.throws(
    () => mapCategories({ sourceRows: [], targetCodes, unmatched: 'guess' }),
    RangeError
  );
});
