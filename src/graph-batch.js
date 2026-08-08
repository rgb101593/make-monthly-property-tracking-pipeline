export function validateBatch({ envelope, expectedIds }) {
  if (envelope.status !== 200) {
    throw new Error(`batch envelope returned ${envelope.status}`);
  }

  const byId = new Map((envelope.responses ?? []).map((r) => [r.id, r]));
  const bodies = {};

  for (const id of expectedIds) {
    const response = byId.get(id);
    if (!response) {
      throw new Error(`missing subresponse: ${id}`);
    }
    if (response.status >= 400) {
      throw new Error(`subresponse ${id} failed with ${response.status}`);
    }
    bodies[id] = response.body;
  }

  return bodies;
}

export function planFeedRefresh({ envelope, feedIds }) {
  const bodies = validateBatch({ envelope, expectedIds: feedIds });

  for (const id of feedIds) {
    const rows = bodies[id]?.values ?? [];
    if (rows.length === 0) {
      throw new Error(`feed ${id} returned no rows; refusing to clear the destination`);
    }
  }

  return {
    clear: true,
    writes: feedIds.map((id) => ({ id, values: bodies[id].values }))
  };
}
