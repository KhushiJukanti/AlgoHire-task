const mongoose = require('mongoose');
const { randomBytes, randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { Batch, Candidate, Certificate, Centre, Delivery, Outbox, Audit } = require('../models');
const { config } = require('../config/env');
const { assert, ApiError } = require('../utils/errors');
const { getBatch } = require('./batch.service');
async function issueCertificates(batchId) {
  const batch = await Batch.findById(batchId);
  assert(batch?.status === 'approved', 409, 'Batch has not received final approval');
  const centre = await Centre.findById(batch.centreId);
  const candidates = await Candidate.find({
    batchId,
  });
  for (const candidate of candidates) {
    try {
      await mongoose.connection.transaction(async (session) => {
        if (
          await Certificate.exists({
            candidateId: candidate._id,
          }).session(session)
        )
          return;
        const [certificate] = await Certificate.create(
          [
            {
              batchId,
              candidateId: candidate._id,
              number: `CF-${randomUUID().toUpperCase()}`,
              verificationToken: randomBytes(24).toString('hex'),
              name: candidate.name,
              course: batch.course,
              centreName: centre?.name,
              courseCompletedOn: candidate.courseCompletedOn,
              issuedAt: new Date(),
            },
          ],
          {
            session,
          },
        );
        await Delivery.create(
          [
            {
              certificateId: certificate._id,
              batchId,
            },
          ],
          {
            session,
          },
        );
        await Outbox.create(
          [
            {
              key: `deliver-${certificate._id}`,
              type: 'deliver',
              entityId: certificate._id,
            },
          ],
          {
            session,
          },
        );
        await Audit.create(
          [
            {
              batchId,
              actorName: 'issuance-worker',
              action: 'certificate.issued',
              revision: batch.revision,
              details: {
                certificateId: certificate._id,
                number: certificate.number,
              },
            },
          ],
          {
            session,
          },
        );
      });
    } catch (error) {
      if (
        error.code !== 11000 ||
        !(await Certificate.exists({
          candidateId: candidate._id,
        }))
      )
        throw error;
    }
  }
  return Certificate.countDocuments({
    batchId,
  });
}
function downloadToken(certificateId) {
  return jwt.sign(
    {
      certificateId,
    },
    config.jwtSecret,
    {
      expiresIn: '7d',
      audience: 'certificate-download',
      issuer: 'certiflow',
    },
  );
}
async function certificateByDownloadToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      audience: 'certificate-download',
      issuer: 'certiflow',
    });
  } catch {
    throw new ApiError(401, 'Invalid or expired download link');
  }
  const certificate = await Certificate.findById(payload.certificateId);
  assert(certificate, 404, 'Certificate not found');
  assert(certificate.status === 'valid', 410, 'Certificate has been revoked');
  return certificate;
}
async function authorizedCertificate(id, actor) {
  const certificate = await Certificate.findById(id);
  assert(certificate, 404, 'Certificate not found');
  await getBatch(String(certificate.batchId), actor);
  return certificate;
}
async function revokeCertificate(id, input, actor) {
  const { reason } = z
    .object({
      reason: z.string().trim().min(3).max(1000),
    })
    .strict()
    .parse(input);
  return mongoose.connection.transaction(async (session) => {
    const certificate = await Certificate.findById(id).session(session);
    assert(certificate, 404, 'Certificate not found');
    if (certificate.status === 'revoked') return certificate;
    certificate.status = 'revoked';
    certificate.revokedAt = new Date();
    certificate.revokedBy = actor.id;
    certificate.revokeReason = reason;
    await certificate.save({
      session,
    });
    await Delivery.updateOne(
      {
        certificateId: id,
        status: {
          $ne: 'sent',
        },
      },
      {
        $set: {
          status: 'cancelled',
        },
      },
      {
        session,
      },
    );
    await Audit.create(
      [
        {
          batchId: certificate.batchId,
          actorId: actor.id,
          actorName: actor.name,
          action: 'certificate.revoked',
          details: {
            certificateId: id,
            reason,
          },
        },
      ],
      {
        session,
      },
    );
    return certificate;
  });
}

module.exports = {
  issueCertificates,
  downloadToken,
  certificateByDownloadToken,
  authorizedCertificate,
  revokeCertificate,
};
