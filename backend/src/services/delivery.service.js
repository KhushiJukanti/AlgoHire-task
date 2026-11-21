const mongoose = require('mongoose');
const { Certificate, Candidate, Delivery, MockMessage, Audit } = require('../models');
const { config } = require('../config/env');
const { downloadToken } = require('./certificate.service');
const { assert } = require('../utils/errors');

// The mock persists the provider's acceptance before simulating a lost response.
// Looking up the same idempotency key reconciles this ambiguous outcome on retry.
async function mockSend(key, phone, downloadUrl, attempt) {
  const existing = await MockMessage.findOne({ key });
  if (existing) return existing;
  if (config.mockFailures && attempt === 1)
    throw new Error('Mock provider temporarily unavailable');
  const message = await MockMessage.findOneAndUpdate(
    { key },
    { $setOnInsert: { key, phone, downloadUrl, acceptedAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  if (config.mockFailures && attempt === 2)
    throw new Error('Mock provider accepted message but response timed out');
  return message;
}

async function deliverCertificate(certificateId) {
  const certificate = await Certificate.findById(certificateId);
  assert(certificate, 404, 'Certificate not found');
  if (certificate.status === 'revoked') {
    await Delivery.updateOne(
      { certificateId, status: { $ne: 'sent' } },
      { $set: { status: 'cancelled' } },
    );
    return;
  }
  let delivery = await Delivery.findOne({ certificateId });
  assert(delivery, 404, 'Delivery not found');
  if (delivery.status === 'sent' || delivery.status === 'cancelled') return;
  delivery = await Delivery.findOneAndUpdate(
    { certificateId, status: { $nin: ['sent', 'cancelled'] } },
    { $inc: { attempts: 1 }, $set: { status: 'retrying' } },
    { returnDocument: 'after' },
  );
  if (!delivery) return;
  try {
    const candidate = await Candidate.findById(certificate.candidateId);
    assert(candidate, 404, 'Candidate not found');
    const link = `${config.publicUrl}/api/certificates/download/${downloadToken(certificateId)}`;
    const message = await mockSend(
      `certificate-${certificateId}`,
      candidate.phone,
      link,
      delivery.attempts,
    );
    await mongoose.connection.transaction(async (session) => {
      const result = await Delivery.updateOne(
        { certificateId, status: { $nin: ['sent', 'cancelled'] } },
        {
          $set: {
            status: 'sent',
            sentAt: message.acceptedAt,
            providerMessageId: String(message._id),
          },
          $unset: { lastError: 1 },
        },
        { session },
      );
      if (result.modifiedCount)
        await Audit.create(
          [
            {
              batchId: certificate.batchId,
              actorName: 'delivery-worker',
              action: 'certificate.delivered',
              details: { certificateId, attempts: delivery.attempts },
            },
          ],
          { session },
        );
    });
  } catch (error) {
    await Delivery.updateOne(
      { certificateId, status: { $nin: ['sent', 'cancelled'] } },
      { $set: { lastError: error.message } },
    );
    throw error;
  }
}
module.exports = { mockSend, deliverCertificate };
