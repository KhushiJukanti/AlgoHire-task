const mongoose = require('mongoose');
const { parse } = require('csv-parse/sync');
const ExcelJS = require('exceljs');
const { BatchRevision } = require('../models');
const { z } = require('zod');
const { Batch, Candidate, Centre, Decision, Audit, Outbox, Escalation } = require('../models');
const { canReadBatch, canEditBatch } = require('./access.service');
const { ApiError, assert } = require('../utils/errors');
const { config } = require('../config/env');
const batchInput = z
  .object({
    title: z.string().trim().min(3).max(120),
    course: z.string().trim().min(2).max(120),
  })
  .strict();
const candidateInput = z
  .object({
    candidateId: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[A-Za-z0-9_-]+$/),
    name: z.string().trim().min(2).max(120),
    phone: z
      .string()
      .trim()
      .regex(/^\+[1-9]\d{7,14}$/, 'Use international format, e.g. +919876543210'),
    courseCompletedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
      .refine((value) => {
        const date = new Date(value);
        return (
          !Number.isNaN(date.getTime()) &&
          date.toISOString().slice(0, 10) === value &&
          date <= new Date()
        );
      }, 'Use a valid completion date that is not in the future'),
  })
  .strict();
async function getBatch(id, actor) {
  const batch = await Batch.findById(id);
  assert(batch, 404, 'Batch not found');
  canReadBatch(actor, batch);
  return batch;
}
async function createBatch(input, actor) {
  const data = batchInput.parse(input);
  const centre = await Centre.findById(actor.centreId);
  assert(centre, 403, 'No centre assigned');
  return mongoose.connection.transaction(async (session) => {
    const [batch] = await Batch.create(
      [
        {
          ...data,
          centreId: centre._id,
          districtId: centre.districtId,
          createdBy: actor.id,
        },
      ],
      {
        session,
      },
    );
    await Audit.create(
      [
        {
          batchId: batch._id,
          actorId: actor.id,
          actorName: actor.name,
          action: 'batch.created',
          revision: 0,
        },
      ],
      {
        session,
      },
    );
    return batch;
  });
}
async function editBatch(id, input, actor) {
  const data = batchInput
    .partial()
    .refine((value) => Object.keys(value).length > 0, 'At least one field is required')
    .parse(input);
  return mongoose.connection.transaction(async (session) => {
    const batch = await Batch.findById(id).session(session);
    assert(batch, 404, 'Batch not found');
    canEditBatch(actor, batch);
    Object.assign(batch, data);
    batch.version++;
    await batch.save({
      session,
    });
    await Audit.create(
      [
        {
          batchId: id,
          actorId: actor.id,
          actorName: actor.name,
          action: 'batch.edited',
          revision: batch.revision,
          details: data,
        },
      ],
      {
        session,
      },
    );
    return batch;
  });
}
async function parseSpreadsheet(file) {
  let rows;
  try {
    if (file.originalname.toLowerCase().endsWith('.csv')) {
      rows = parse(file.buffer, {
        columns: (headers) => {
          assert(new Set(headers).size === headers.length, 422, 'Duplicate column headings');
          return headers;
        },
        bom: true,
        skip_empty_lines: true,
        trim: true,
        max_record_size: 10000,
      });
    } else if (file.originalname.toLowerCase().endsWith('.xlsx')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const sheet = workbook.worksheets[0];
      assert(sheet && sheet.rowCount <= 501, 422, 'Use one sheet with 1–500 candidate rows');
      const headers = sheet
        .getRow(1)
        .values.slice(1)
        .map((v) => String(v).trim());
      assert(new Set(headers).size === headers.length, 422, 'Duplicate column headings');
      rows = [];
      sheet.eachRow((row, index) => {
        if (index === 1) return;
        const record = {};
        headers.forEach((header, column) => {
          const cell = row.getCell(column + 1);
          record[header] =
            cell.value instanceof Date ? cell.value.toISOString().slice(0, 10) : cell.text.trim();
        });
        rows.push(record);
      });
    } else throw new ApiError(422, 'Upload a .csv or .xlsx file');
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(422, 'Cannot parse spreadsheet. Check the file format and column headings.');
  }
  return validateCandidates(rows);
}
function validateCandidates(rows) {
  assert(
    Array.isArray(rows) && rows.length > 0 && rows.length <= 500,
    422,
    'Provide between 1 and 500 candidates',
  );
  const errors = [];
  const seen = new Set();
  const candidates = [];
  rows.forEach((row, index) => {
    const result = candidateInput.safeParse(row);
    if (!result.success) {
      errors.push({
        row: index + 2,
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return;
    }
    const key = result.data.candidateId.toLowerCase();
    if (seen.has(key))
      errors.push({
        row: index + 2,
        errors: [
          {
            field: 'candidateId',
            message: 'Duplicate candidate ID in this batch',
          },
        ],
      });
    seen.add(key);
    candidates.push({
      ...result.data,
      candidateId: key,
    });
  });
  if (errors.length) throw new ApiError(422, 'Spreadsheet rejected; no candidates saved', errors);
  return candidates;
}
async function replaceCandidates(id, rows, actor) {
  return mongoose.connection.transaction(async (session) => {
    const batch = await Batch.findById(id).session(session);
    assert(batch, 404, 'Batch not found');
    canEditBatch(actor, batch);
    batch.candidateCount = rows.length;
    batch.version++;
    await batch.save({
      session,
    });
    await Candidate.deleteMany({
      batchId: id,
    }).session(session);
    await Candidate.insertMany(
      rows.map((row) => ({
        ...row,
        batchId: id,
      })),
      {
        session,
      },
    );
    await Audit.create(
      [
        {
          batchId: id,
          actorId: actor.id,
          actorName: actor.name,
          action: 'candidates.replaced',
          revision: batch.revision,
          details: {
            count: rows.length,
          },
        },
      ],
      {
        session,
      },
    );
    return {
      count: rows.length,
      batch,
    };
  });
}
function enterStage(batch, status) {
  batch.status = status;
  batch.stageEnteredAt = new Date();
  batch.version++;
  batch.dueAt = status.endsWith('_review')
    ? new Date(Date.now() + config.slaHours * 3600000)
    : undefined;
}
async function submitBatch(id, actor) {
  return mongoose.connection.transaction(async (session) => {
    const batch = await Batch.findById(id).session(session);
    assert(batch, 404, 'Batch not found');
    canEditBatch(actor, batch);
    assert(batch.candidateCount > 0, 422, 'Import candidates before submitting');
    batch.revision++;
    batch.districtApprovals = [];
    batch.returnReason = undefined;
    batch.submittedAt = new Date();
    const snapshot = await Candidate.find({ batchId: id }).session(session).lean();
    await BatchRevision.create(
      [
        {
          batchId: id,
          revision: batch.revision,
          title: batch.title,
          course: batch.course,
          submittedBy: actor.id,
          candidates: snapshot.map(({ candidateId, name, phone, courseCompletedOn }) => ({
            candidateId,
            name,
            phone,
            courseCompletedOn,
          })),
        },
      ],
      { session },
    );
    enterStage(batch, 'district_review');
    await batch.save({
      session,
    });
    await Audit.create(
      [
        {
          batchId: id,
          actorId: actor.id,
          actorName: actor.name,
          action: 'batch.submitted',
          revision: batch.revision,
          details: {
            approvalPolicy: 'All earlier approvals are superseded',
          },
        },
      ],
      {
        session,
      },
    );
    return batch;
  });
}
const decisionInput = z
  .object({
    action: z.enum(['approve', 'reject', 'return']),
    reason: z.string().trim().max(1000).optional(),
    revision: z.number().int().positive(),
  })
  .strict()
  .refine((data) => data.action === 'approve' || !!data.reason, {
    message: 'A reason is required for rejection or return',
    path: ['reason'],
  });
async function decide(id, input, actor) {
  const data = decisionInput.parse(input);
  return mongoose.connection.transaction(async (session) => {
    const batch = await Batch.findById(id).session(session);
    assert(batch, 404, 'Batch not found');
    canReadBatch(actor, batch);
    const requiredRole = {
      district_review: 'district',
      quality_review: 'quality',
      state_review: 'state',
    };
    assert(
      requiredRole[batch.status] === actor.role,
      403,
      'This approval step is not assigned to your role',
    );
    assert(batch.revision === data.revision, 409, 'Batch was resubmitted; reload before deciding');
    const stage = batch.status;
    assert(
      !(await Decision.exists({
        batchId: id,
        revision: batch.revision,
        stage,
        actorId: actor.id,
      }).session(session)),
      409,
      'You already decided on this stage and revision',
    );
    await Decision.create(
      [
        {
          batchId: id,
          revision: batch.revision,
          stage,
          actorId: actor.id,
          actorName: actor.name,
          action: data.action,
          reason: data.reason,
        },
      ],
      {
        session,
      },
    );
    if (data.action === 'return') {
      enterStage(batch, 'returned');
      batch.returnReason = data.reason;
    } else if (data.action === 'reject') enterStage(batch, 'rejected');
    else if (stage === 'district_review') {
      batch.districtApprovals.push(actor.id);
      batch.version++;
      if (batch.districtApprovals.length >= 2)
        enterStage(batch, batch.candidateCount > 50 ? 'quality_review' : 'state_review');
    } else if (stage === 'quality_review') enterStage(batch, 'state_review');
    else {
      enterStage(batch, 'approved');
      batch.approvedAt = new Date();
      await Outbox.create(
        [
          {
            key: `issue-${id}`,
            type: 'issue',
            entityId: id,
          },
        ],
        {
          session,
        },
      );
    }
    await batch.save({
      session,
    });
    if (batch.status !== stage)
      await Escalation.updateMany(
        {
          batchId: id,
          resolvedAt: null,
        },
        {
          $set: {
            resolvedAt: new Date(),
          },
        },
        {
          session,
        },
      );
    await Audit.create(
      [
        {
          batchId: id,
          actorId: actor.id,
          actorName: actor.name,
          action: `decision.${data.action}`,
          revision: batch.revision,
          details: {
            stage,
            nextStage: batch.status,
            reason: data.reason,
          },
        },
      ],
      {
        session,
      },
    );
    return batch;
  });
}

module.exports = {
  batchInput,
  getBatch,
  createBatch,
  editBatch,
  parseSpreadsheet,
  validateCandidates,
  replaceCandidates,
  enterStage,
  submitBatch,
  decisionInput,
  decide,
};
