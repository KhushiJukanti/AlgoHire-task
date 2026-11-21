const { renderPdf } = require('../services/pdf.service');
const asyncHandler = require('../middlewares/asyncHandler');
const Certificate = require('../models/certificate.model');
const Delivery = require('../models/delivery.model');
const MockMessage = require('../models/mockMessage.model');
const Audit = require('../models/audit.model');
const Outbox = require('../models/outbox.model');
const service = require('../services/certificate.service');
const { getQueue } = require('../jobs/queue');
const { config } = require('../config/env');
const { assert, ApiError } = require('../utils/errors');

exports.verifyCertificate = asyncHandler(async (req, res) => {
  res.set('Cache-Control', 'no-store');
  assert(/^[a-f0-9]{48}$/.test(req.params.token), 404, 'Certificate not found');
  const certificate = await Certificate.findOne({ verificationToken: req.params.token });
  assert(certificate, 404, 'Certificate not found');
  res.json({
    valid: certificate.status === 'valid',
    status: certificate.status,
    number: certificate.number,
    holderName: certificate.name
      .split(/\s+/)
      .map((part) => part[0] + '***')
      .join(' '),
    course: certificate.course,
    centreName: certificate.centreName,
    issuedAt: certificate.issuedAt,
    revokedAt: certificate.revokedAt,
  });
});

exports.getCertificate = asyncHandler(async (req, res) => {
  const certificate = await service.authorizedCertificate(req.params.id, req.user);
  res.json({ certificate });
});

exports.createDownloadLink = asyncHandler(async (req, res) => {
  const certificate = await service.authorizedCertificate(req.params.id, req.user);
  assert(certificate.status === 'valid', 410, 'Certificate has been revoked');
  res.json({
    expiresIn: '7 days',
    url: `${config.publicUrl}/api/certificates/download/${service.downloadToken(String(certificate._id))}`,
  });
});

exports.downloadWithToken = asyncHandler(async (req, res) => {
  const certificate = await service.certificateByDownloadToken(req.params.token);
  return renderPdf(certificate, res);
});

exports.downloadPdf = asyncHandler(async (req, res) => {
  const certificate = await service.authorizedCertificate(req.params.id, req.user);
  assert(certificate.status === 'valid', 410, 'Certificate has been revoked');
  return renderPdf(certificate, res);
});

exports.revokeCertificate = asyncHandler(async (req, res) => {
  const certificate = await service.revokeCertificate(req.params.id, req.body, req.user);
  res.json({ certificate });
});

exports.retryDelivery = asyncHandler(async (req, res) => {
  const certificate = await service.authorizedCertificate(req.params.id, req.user);
  assert(certificate.status === 'valid', 409, 'Cannot deliver a revoked certificate');
  const delivery = await Delivery.findOne({ certificateId: certificate._id });
  assert(delivery && delivery.status !== 'sent', 409, 'Certificate was already delivered');
  try {
    const job = await getQueue().getJob(`deliver-${certificate._id}`);
    if (job) {
      assert((await job.getState()) === 'failed', 409, 'Delivery is already queued or active');
      await job.retry('failed', { resetAttemptsMade: true });
    } else
      await Outbox.updateOne(
        { key: `deliver-${certificate._id}` },
        { $unset: { dispatchedAt: 1 } },
      );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'Queue unavailable; try again shortly');
  }
  await Delivery.updateOne(
    { certificateId: certificate._id, status: { $nin: ['sent', 'cancelled'] } },
    { $set: { status: 'pending' } },
  );
  await Audit.create({
    batchId: certificate.batchId,
    actorId: req.user.id,
    actorName: req.user.name,
    action: 'delivery.retry-requested',
    details: { certificateId: certificate._id },
  });
  res.status(202).json({ message: 'Delivery retry requested' });
});

exports.getMockMessage = asyncHandler(async (req, res) => {
  assert(config.demo, 404, 'Not found');
  await service.authorizedCertificate(req.params.id, req.user);
  const message = await MockMessage.findOne({ key: `certificate-${req.params.id}` });
  assert(message, 404, 'Mock provider has not accepted this message yet');
  res.json({ message });
});
