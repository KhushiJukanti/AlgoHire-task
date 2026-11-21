const { assert } = require('../utils/errors');
function batchScope(actor) {
  if (actor.role === 'centre')
    return {
      centreId: actor.centreId,
    };
  if (actor.role === 'district')
    return {
      districtId: actor.districtId,
    };
  if (actor.role === 'quality')
    return {
      candidateCount: {
        $gt: 50,
      },
    };
  return {};
}
function canReadBatch(actor, batch) {
  if (actor.role === 'centre')
    assert(String(batch.centreId) === actor.centreId, 403, 'Batch belongs to another centre');
  if (actor.role === 'district')
    assert(batch.districtId === actor.districtId, 403, 'Batch belongs to another district');
  if (actor.role === 'quality')
    assert(batch.candidateCount > 50, 403, 'Batch does not require quality review');
}
function canEditBatch(actor, batch) {
  assert(actor.role === 'centre', 403, 'Only the training centre may edit a batch');
  canReadBatch(actor, batch);
  assert(
    ['draft', 'returned'].includes(batch.status),
    409,
    'Only draft or returned batches can be edited',
  );
}

module.exports = { batchScope, canReadBatch, canEditBatch };
