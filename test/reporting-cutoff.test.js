import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cutoffMonth, resolveEffectiveMonth } from '../src/reporting-cutoff.js';

test('before the mid-month boundary the cutoff is two months back', () => {
  assert.deepEqual(cutoffMonth({ year: 2031, month: 6, day: 14 }), { year: 2031, month: 4 });
});

test('on the mid-month boundary the cutoff moves to the previous month', () => {
  assert.deepEqual(cutoffMonth({ year: 2031, month: 6, day: 15 }), { year: 2031, month: 5 });
});

test('the cutoff wraps across a year boundary', () => {
  assert.deepEqual(cutoffMonth({ year: 2031, month: 1, day: 3 }), { year: 2030, month: 11 });
});

test('a future-dated export month is clamped to the latest reportable month', () => {
  const effective = resolveEffectiveMonth({
    businessDate: { year: 2031, month: 6, day: 20 },
    availableMonths: [
      { year: 2031, month: 3 },
      { year: 2031, month: 4 },
      { year: 2031, month: 5 },
      { year: 2031, month: 6 }
    ]
  });

  assert.deepEqual(effective, { year: 2031, month: 5 });
});

test('the same export before the boundary clamps one month further back', () => {
  const effective = resolveEffectiveMonth({
    businessDate: { year: 2031, month: 6, day: 9 },
    availableMonths: [
      { year: 2031, month: 3 },
      { year: 2031, month: 4 },
      { year: 2031, month: 5 },
      { year: 2031, month: 6 }
    ]
  });

  assert.deepEqual(effective, { year: 2031, month: 4 });
});

test('a month at or below the cutoff passes through unchanged', () => {
  const effective = resolveEffectiveMonth({
    businessDate: { year: 2031, month: 6, day: 20 },
    availableMonths: [{ year: 2031, month: 4 }]
  });

  assert.deepEqual(effective, { year: 2031, month: 4 });
});

test('an export with no reportable month throws instead of writing', () => {
  assert.throws(
    () =>
      resolveEffectiveMonth({
        businessDate: { year: 2031, month: 6, day: 20 },
        availableMonths: [
          { year: 2031, month: 6 },
          { year: 2031, month: 7 }
        ]
      }),
    RangeError
  );
});
