const asyncHandler = require('../middlewares/asyncHandler');
const { z } = require('zod');
const Batch = require('../models/batch.model');
const Candidate = require('../models/candidate.model');
const Decision = require('../models/decision.model');
const Audit = require('../models/audit.model');
const Certificate = require('../models/certificate.model');
const Delivery = require('../models/delivery.model');
const BatchRevision = require('../models/batchRevision.model');
const service = require('../services/batch.service');
const { batchScope, canEditBatch } = require('../services/access.service');
const { assert } = require('../utils/errors');
const { pagination } = require('../utils/pagination');

exports.listBatches = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const filter = batchScope(req.user);
  if (req.query.status)
    filter.status = z
      .enum([
        'draft',
        'district_review',
        'quality_review',
        'state_review',
        'returned',
        'rejected',
        'approved',
      ])
      .parse(req.query.status);
  const [batches, total] = await Promise.all([
    Batch.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Batch.countDocuments(filter),
  ]);
  res.json({ batches, page, total });
});

exports.getReviewInbox = asyncHandler(async (req, res) => {
  const { page, limit, skip } = pagination(req.query);
  const stages = { district: 'district_review', quality: 'quality_review', state: 'state_review' };
  const filter = { ...batchScope(req.user), status: stages[req.user.role] };
  if (req.user.role === 'district') filter.districtApprovals = { $ne: req.user.id };
  const [batches, total] = await Promise.all([
    Batch.find(filter).sort({ dueAt: 1 }).skip(skip).limit(limit),
    Batch.countDocuments(filter),
  ]);
  res.json({ batches, page, total });
});

exports.getBatch = asyncHandler(async (req, res) => {
  const batch = await service.getBatch(req.params.id, req.user);
  res.json({ batch });
});

exports.createBatch = asyncHandler(async (req, res) => {
  const batch = await service.createBatch(req.body, req.user);
  res.status(201).json({ batch });
});

exports.updateBatch = asyncHandler(async (req, res) => {
  const batch = await service.editBatch(req.params.id, req.body, req.user);
  res.json({ batch });
});

exports.listCandidates = asyncHandler(async (req, res) => {
  await service.getBatch(req.params.id, req.user);
  const { page, limit, skip } = pagination(req.query);
  const filter = { batchId: req.params.id };
  res.json({
    candidates: await Candidate.find(filter).sort({ candidateId: 1 }).skip(skip).limit(limit),
    total: await Candidate.countDocuments(filter),
    page,
  });
});

exports.importCandidates = asyncHandler(async (req, res) => {
  const batch = await service.getBatch(req.params.id, req.user);
  canEditBatch(req.user, batch);
  assert(req.file, 422, 'Attach a CSV or XLSX file using the file form field');
  const rows = await service.parseSpreadsheet(req.file);
  if (req.query.validateOnly === 'true')
    return res.json({ valid: true, count: rows.length, saved: false });
  const result = await service.replaceCandidates(req.params.id, rows, req.user);
  res.json(result);
});

exports.replaceCandidates = asyncHandler(async (req, res) => {
  const { candidates } = z
    .object({ candidates: z.array(z.unknown()) })
    .strict()
    .parse(req.body);
  const validatedCandidates = service.validateCandidates(candidates);
  const result = await service.replaceCandidates(req.params.id, validatedCandidates, req.user);
  res.json(result);
});

exports.submitBatch = asyncHandler(async (req, res) => {
  const batch = await service.submitBatch(req.params.id, req.user);
  res.json({ batch });
});

exports.reviewBatch = asyncHandler(async (req, res) => {
  const batch = await service.decide(req.params.id, req.body, req.user);
  res.json({ batch });
});

exports.getBatchHistory = asyncHandler(async (req, res) => {
  await service.getBatch(req.params.id, req.user);
  res.json({
    decisions: await Decision.find({ batchId: req.params.id }).sort({ createdAt: 1 }),
    audit: await Audit.find({ batchId: req.params.id }).sort({ createdAt: 1 }).limit(2000),
  });
});

exports.listBatchRevisions = asyncHandler(async (req, res) => {
  await service.getBatch(req.params.id, req.user);
  const { page, limit, skip } = pagination(req.query);
  res.json({
    revisions: await BatchRevision.find({ batchId: req.params.id })
      .sort({ revision: -1 })
      .skip(skip)
      .limit(limit),
    page,
  });
});

exports.listBatchCertificates = asyncHandler(async (req, res) => {
  await service.getBatch(req.params.id, req.user);
  const { page, limit, skip } = pagination(req.query);
  res.json({
    certificates: await Certificate.find({ batchId: req.params.id }).skip(skip).limit(limit),
    page,
    total: await Certificate.countDocuments({ batchId: req.params.id }),
  });
});

exports.listBatchDeliveries = asyncHandler(async (req, res) => {
  await service.getBatch(req.params.id, req.user);
  const { page, limit, skip } = pagination(req.query);
  res.json({
    deliveries: await Delivery.find({ batchId: req.params.id }).skip(skip).limit(limit),
    page,
    total: await Delivery.countDocuments({ batchId: req.params.id }),
  });
});
