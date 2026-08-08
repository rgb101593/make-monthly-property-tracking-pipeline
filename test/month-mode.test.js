import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectMonthMode, NEW_MONTH, OVERWRITE, PRIOR_MONTH } from '../src/month-mode.js';

const base = { modelColumn: 20, firstDataColumn: 5 };

test('export month ahead of the model selects NEW_MONTH', () => {
  const result = selectMonthMode({
    ...base,
    modelMonth: { year: 2031, month: 6 },
    exportMonth: { year: 2031, month: 7 }
  });

  assert.equal(result.mode, NEW_MONTH);
  assert.equal(result.monthGap, 1);
  assert.equal(result.targetColumn, 21);
  assert.equal(result.headersToCreate, 1);
});

test('export month equal to the model selects OVERWRITE in place', () => {
  const result = selectMonthMode({
    ...base,
    modelMonth: { year: 2031, month: 6 },
    exportMonth: { year: 2031, month: 6 }
  });

  assert.equal(result.mode, OVERWRITE);
  assert.equal(result.monthGap, 0);
  assert.equal(result.targetColumn, base.modelColumn);
  assert.equal(result.headersToCreate, 0);
});

test('export month behind the model targets its own historical column', () => {
  const result = selectMonthMode({
    ...base,
    modelMonth: { year: 2031, month: 6 },
    exportMonth: { year: 2031, month: 4 }
  });

  assert.equal(result.mode, PRIOR_MONTH);
  assert.equal(result.monthGap, -2);
  assert.equal(result.targetColumn, 18);
  assert.notEqual(result.targetColumn, base.modelColumn);
});

test('a gap larger than one month creates every missing header', () => {
  const result = selectMonthMode({
    ...base,
    modelMonth: { year: 2031, month: 6 },
    exportMonth: { year: 2031, month: 11 }
  });

  assert.equal(result.mode, NEW_MONTH);
  assert.equal(result.headersToCreate, 5);
  assert.equal(result.targetColumn, 25);
});

test('a gap spanning a year boundary is counted in months', () => {
  const result = selectMonthMode({
    ...base,
    modelMonth: { year: 2031, month: 11 },
    exportMonth: { year: 2032, month: 2 }
  });

  assert.equal(result.monthGap, 3);
  assert.equal(result.targetColumn, 23);
});

test('a historical target left of the first data column throws', () => {
  assert.throws(
    () =>
      selectMonthMode({
        modelColumn: 7,
        firstDataColumn: 5,
        modelMonth: { year: 2031, month: 6 },
        exportMonth: { year: 2030, month: 6 }
      }),
    RangeError
  );
});
