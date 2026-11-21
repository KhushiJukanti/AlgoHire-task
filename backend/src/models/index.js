// Collect models here for database initialization and existing service imports.
const User = require('./user.model');
const Centre = require('./centre.model');
const Batch = require('./batch.model');
const Candidate = require('./candidate.model');
const Decision = require('./decision.model');
const Certificate = require('./certificate.model');
const Delivery = require('./delivery.model');
const MockMessage = require('./mockMessage.model');
const Audit = require('./audit.model');
const Outbox = require('./outbox.model');
const Escalation = require('./escalation.model');
const BatchRevision = require('./batchRevision.model');

const models = [
  User,
  Centre,
  Batch,
  Candidate,
  Decision,
  Certificate,
  Delivery,
  MockMessage,
  Audit,
  Outbox,
  Escalation,
  BatchRevision,
];

module.exports = {
  User,
  Centre,
  Batch,
  Candidate,
  Decision,
  Certificate,
  Delivery,
  MockMessage,
  Audit,
  Outbox,
  Escalation,
  BatchRevision,
  models,
};
