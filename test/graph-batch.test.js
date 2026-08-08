import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateBatch, planFeedRefresh } from '../src/graph-batch.js';

const okEnvelope = {
  status: 200,
  responses: [
    { id: 'block_one', status: 200, body: { values: [[1, 2]] } },
    { id: 'block_two', status: 200, body: { values: [[3, 4]] } }
  ]
};

test('a fully successful batch returns every requested body', () => {
  const bodies = validateBatch({ envelope: okEnvelope, expectedIds: ['block_one', 'block_two'] });

  assert.deepEqual(bodies.block_one.values, [[1, 2]]);
  assert.deepEqual(bodies.block_two.values, [[3, 4]]);
});

test('a 200 envelope hiding a failed subrequest throws', () => {
  const envelope = {
    status: 200,
    responses: [
      { id: 'block_one', status: 200, body: { values: [[1, 2]] } },
      { id: 'block_two', status: 424, body: { error: 'dependent request failed' } }
    ]
  };

  assert.throws(
    () => validateBatch({ envelope, expectedIds: ['block_one', 'block_two'] }),
    /block_two failed with 424/
  );
});

test('a 200 envelope missing a subresponse throws', () => {
  const envelope = {
    status: 200,
    responses: [{ id: 'block_one', status: 200, body: { values: [[1, 2]] } }]
  };

  assert.throws(
    () => validateBatch({ envelope, expectedIds: ['block_one', 'block_two'] }),
    /missing subresponse: block_two/
  );
});

test('a non-200 envelope throws', () => {
  assert.throws(
    () => validateBatch({ envelope: { status: 503, responses: [] }, expectedIds: ['block_one'] }),
    /envelope returned 503/
  );
});

test('a healthy feed batch plans a clear followed by writes', () => {
  const plan = planFeedRefresh({ envelope: okEnvelope, feedIds: ['block_one', 'block_two'] });

  assert.equal(plan.clear, true);
  assert.equal(plan.writes.length, 2);
});

test('an empty dependent feed throws before any clear is planned', () => {
  const envelope = {
    status: 200,
    responses: [
      { id: 'block_one', status: 200, body: { values: [[1, 2]] } },
      { id: 'block_two', status: 200, body: { values: [] } }
    ]
  };

  let plan;

  assert.throws(() => {
    plan = planFeedRefresh({ envelope, feedIds: ['block_one', 'block_two'] });
  }, /refusing to clear/);

  assert.equal(plan, undefined);
});
