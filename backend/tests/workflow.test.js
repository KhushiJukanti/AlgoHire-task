const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
process.env.JWT_SECRET = 'test-only-secret-with-more-than-thirty-two-characters';
process.env.DEMO_MODE = 'true';
process.env.MOCK_FAILURES = 'true';
process.env.NODE_ENV = 'test';
const { MongoMemoryReplSet } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const { config } = require('../src/config/env');
const { connectDatabase } = require('../src/config/database');
const { seed } = require('../scripts/seed');
const models = require('../src/models');
const { issueCertificates, downloadToken } = require('../src/services/certificate.service');
const { deliverCertificate } = require('../src/services/delivery.service');
const { escalateOverdue } = require('../src/services/escalation.service');
const { sessionToken } = require('../src/middlewares/auth');
const app = require('../src/app');
let replica, server, base;
const tokens = {}; const actors = {};

async function request(method, url, user, body) {
  const headers = {};
  if (user) headers.Authorization = `Bearer ${tokens[user] || user}`;
  if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(base + url, { method, headers, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
  const data = await response.json(); return { status: response.status, data, headers: response.headers };
}
function roster(count = 3) {
  return Array.from({ length: count }, (_, i) => ({ candidateId: `test-${i}`, name: `Candidate ${i}`, phone: `+91900100${String(i).padStart(4, '0')}`, courseCompletedOn: '2026-01-01' }));
}
async function batchWithCandidates(count = 3) {
  const created = await request('POST', '/api/batches', 'anika', { title: `Test batch ${Date.now()}`, course: 'Web Development' });
  assert.equal(created.status, 201, JSON.stringify(created.data)); const id = created.data.batch._id;
  assert.equal((await request('PUT', `/api/batches/${id}/candidates`, 'anika', { candidates: roster(count) })).status, 200);
  return id;
}
async function decision(id, user, action = 'approve', revision = 1, reason) {
  return request('POST', `/api/batches/${id}/decisions`, user, { action, revision, ...(reason ? { reason } : {}) });
}
before(async () => {
  replica = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  config.mongoUri = replica.getUri('certiflow_test'); await connectDatabase(); await seed();
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (const name of ['anika', 'dev', 'meera', 'kabir', 'neha', 'farah']) {
    const login = await request('POST', '/api/auth/demo-login', null, { email: `${name}@certiflow.demo` });
    assert.equal(login.status, 200); tokens[name] = login.data.token; actors[name] = login.data.user;
  }
}, { timeout: 120000 });
after(async () => {
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  await mongoose.disconnect(); if (replica) await replica.stop();
});

test('login, middleware, ownership, and acting-as-another-user protection', async () => {
  assert.equal((await request('GET', '/api/batches')).status, 401);
  assert.equal((await request('POST', '/api/auth/login', null, { email: 'anika@certiflow.demo', password: 'wrong' })).status, 401);
  assert.equal((await request('POST', '/api/auth/login', null, { email: 'anika@certiflow.demo', password: 'CertiFlowDemo123!' })).status, 200);
  const id = await batchWithCandidates();
  assert.equal((await request('POST', '/api/batches', 'dev', { title: 'Unauthorized', course: 'Skills' })).status, 403);
  assert.equal((await request('GET', '/api/batches/bad-id', 'anika')).status, 400);
  assert.equal((await request('GET', `/api/batches/${id}`, 'neha')).status, 403);
  const stranger = await models.User.create({ name: 'Other Centre', email: 'other@test.local', passwordHash: 'unused', role: 'centre', centreId: new mongoose.Types.ObjectId() });
  const token = sessionToken(String(stranger._id));
  assert.equal((await request('GET', `/api/batches/${id}/candidates`, token)).status, 403);
  await request('POST', `/api/batches/${id}/submit`, 'anika');
  assert.equal((await request('POST', `/api/batches/${id}/decisions`, 'dev', { action: 'approve', revision: 1, actorId: actors.meera.id })).status, 422);
  assert.equal((await decision(id, 'farah')).status, 403);
});

test('invalid spreadsheet rows leave previous candidates unchanged; valid CSV and XLSX import', async () => {
  const id = await batchWithCandidates();
  const original = await models.Candidate.find({ batchId: id }).distinct('_id');
  const bad = new FormData(); bad.append('file', new Blob([fs.readFileSync(path.join(__dirname, '../samples/invalid-candidates.csv'))]), 'invalid.csv');
  const result = await request('POST', `/api/batches/${id}/candidates/import`, 'anika', bad);
  assert.equal(result.status, 422); assert.equal(result.data.details.length, 2);
  assert.deepEqual((await models.Candidate.find({ batchId: id }).distinct('_id')).map(String), original.map(String));
  const good = new FormData(); good.append('file', new Blob([fs.readFileSync(path.join(__dirname, '../samples/candidates.csv'))]), 'valid.csv');
  assert.equal((await request('POST', `/api/batches/${id}/candidates/import?validateOnly=true`, 'anika', good)).data.saved, false);
  assert.equal((await request('POST', `/api/batches/${id}/candidates/import`, 'anika', good)).status, 200);
  const ExcelJS = require('exceljs'); const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Candidates');
  sheet.addRow(Object.keys(roster(1)[0])); sheet.addRow(Object.values(roster(1)[0]));
  const xlsx = new FormData(); xlsx.append('file', new Blob([await workbook.xlsx.writeBuffer()]), 'valid.xlsx');
  assert.equal((await request('POST', `/api/batches/${id}/candidates/import`, 'anika', xlsx)).data.count, 1);
});

test('two simultaneous district decisions advance once and duplicate votes are rejected', async () => {
  const id = await batchWithCandidates(); await request('POST', `/api/batches/${id}/submit`, 'anika');
  const responses = await Promise.all([decision(id, 'dev'), decision(id, 'meera')]);
  assert.deepEqual(responses.map(r => r.status), [200, 200]);
  const batch = await models.Batch.findById(id); assert.equal(batch.status, 'state_review'); assert.equal(batch.districtApprovals.length, 2);
  assert.equal(await models.Decision.countDocuments({ batchId: id }), 2);
  assert.equal((await decision(id, 'kabir')).status, 403);
  const other = await batchWithCandidates(); await request('POST', `/api/batches/${other}/submit`, 'anika');
  const duplicate = await Promise.all([decision(other, 'dev'), decision(other, 'dev')]);
  assert.deepEqual(duplicate.map(r => r.status).sort(), [200, 409]);
});

test('return requires a reason; resubmission resets approvals and rejects stale revisions', async () => {
  const id = await batchWithCandidates(); await request('POST', `/api/batches/${id}/submit`, 'anika'); await decision(id, 'dev');
  assert.equal((await decision(id, 'meera', 'return')).status, 422);
  assert.equal((await decision(id, 'meera', 'return', 1, 'Correct candidate details')).status, 200);
  await request('PATCH', `/api/batches/${id}`, 'anika', { title: 'Corrected batch' });
  const result = await request('POST', `/api/batches/${id}/submit`, 'anika');
  assert.equal(result.data.batch.revision, 2); assert.deepEqual(result.data.batch.districtApprovals, []);
  assert.equal((await decision(id, 'dev', 'approve', 1)).status, 409);
  assert.equal((await decision(id, 'dev', 'approve', 2)).status, 200);
  assert.equal(await models.Decision.countDocuments({ batchId: id, revision: 1 }), 2);
  const snapshots = await request('GET', `/api/batches/${id}/revisions`, 'anika');
  assert.equal(snapshots.data.revisions.length, 2);
  assert.equal(snapshots.data.revisions[0].title, 'Corrected batch');
  assert.notEqual(snapshots.data.revisions[1].title, 'Corrected batch');
});

test('60-candidate batch requires quality and state approval; issuance and delivery are idempotent', { timeout: 120000 }, async () => {
  const id = await batchWithCandidates(60); await request('POST', `/api/batches/${id}/submit`, 'anika');
  await Promise.all([decision(id, 'dev'), decision(id, 'meera')]);
  assert.equal((await models.Batch.findById(id)).status, 'quality_review');
  assert.equal((await decision(id, 'farah')).status, 403);
  assert.equal((await decision(id, 'neha')).status, 200);
  const finals = await Promise.all([decision(id, 'farah'), decision(id, 'farah')]);
  assert.equal(finals.filter(r => r.status === 200).length, 1);
  assert.equal(await models.Outbox.countDocuments({ key: `issue-${id}` }), 1);
  await Promise.all([issueCertificates(id), issueCertificates(id)]);
  const certificates = await models.Certificate.find({ batchId: id });
  assert.equal(certificates.length, 60); assert.equal(new Set(certificates.map(c => c.number)).size, 60);
  for (const certificate of certificates) {
    await assert.rejects(deliverCertificate(String(certificate._id)), /temporarily unavailable/);
    await assert.rejects(deliverCertificate(String(certificate._id)), /timed out/);
    await deliverCertificate(String(certificate._id)); await deliverCertificate(String(certificate._id));
  }
  assert.equal(await models.Delivery.countDocuments({ batchId: id, status: 'sent' }), 60);
  assert.equal(await models.MockMessage.countDocuments({ key: { $in: certificates.map(c => `certificate-${c._id}`) } }), 60);
  const certificate = certificates[0]; const verifyPath = `/api/verify/${certificate.verificationToken}`;
  const verified = await request('GET', verifyPath);
  assert.equal(verified.data.valid, true); assert.equal(verified.headers.get('cache-control'), 'no-store'); assert.equal(verified.data.phone, undefined);
  const pdf = await fetch(`${base}/api/certificates/download/${downloadToken(String(certificate._id))}`);
  assert.equal(pdf.status, 200); const pdfBytes = Buffer.from(await pdf.arrayBuffer()); assert.equal(pdfBytes.subarray(0, 4).toString(), '%PDF');
  fs.mkdirSync(path.join(__dirname, '../.cache'), { recursive: true }); fs.writeFileSync(path.join(__dirname, '../.cache/sample-certificate.pdf'), pdfBytes);
  assert.equal((await request('POST', `/api/certificates/${certificate._id}/revoke`, 'dev', { reason: 'Invalid record' })).status, 403);
  assert.equal((await request('POST', `/api/certificates/${certificate._id}/revoke`, 'farah', { reason: 'Invalid record' })).status, 200);
  assert.equal((await request('GET', verifyPath)).data.valid, false);
  const revokedDownload = await fetch(`${base}/api/certificates/download/${downloadToken(String(certificate._id))}`); assert.equal(revokedDownload.status, 410);
  assert.equal(await models.Audit.countDocuments({ batchId: id, action: 'certificate.revoked' }), 1);
});

test('overdue stages escalate once; moving forward resolves the escalation', async () => {
  const id = await batchWithCandidates(); await request('POST', `/api/batches/${id}/submit`, 'anika');
  await models.Batch.updateOne({ _id: id }, { $set: { dueAt: new Date(Date.now() - 60000) } });
  await Promise.all([escalateOverdue(), escalateOverdue()]);
  assert.equal(await models.Escalation.countDocuments({ batchId: id }), 1);
  assert.equal((await request('GET', '/api/state/escalations', 'anika')).status, 403);
  assert.equal((await request('GET', '/api/state/escalations', 'farah')).data.escalations.some(item => item.batchId === id), true);
  await decision(id, 'dev'); await decision(id, 'meera');
  assert.equal(await models.Escalation.countDocuments({ batchId: id, resolvedAt: null }), 0);
});

test('download links reject expired tokens, wrong audiences, and modified signatures', async () => {
  const jwt = require('jsonwebtoken');
  const certificate = await models.Certificate.findOne({ status: 'valid' });
  const expired = jwt.sign({ certificateId: String(certificate._id) }, config.jwtSecret, { expiresIn: -1, audience: 'certificate-download', issuer: 'certiflow' });
  assert.equal((await request('GET', `/api/certificates/download/${expired}`)).status, 401);
  assert.equal((await request('GET', `/api/certificates/download/${tokens.anika}`)).status, 401);
  const signed = downloadToken(String(certificate._id));
  assert.equal((await request('GET', `/api/certificates/download/${signed.slice(0, -8)}tampered`)).status, 401);
});

test('rejection is terminal; audit records include authenticated decision-maker', async () => {
  const id = await batchWithCandidates(); await request('POST', `/api/batches/${id}/submit`, 'anika');
  assert.equal((await decision(id, 'dev', 'reject', 1, 'Assessment evidence is invalid')).status, 200);
  assert.equal((await request('POST', `/api/batches/${id}/submit`, 'anika')).status, 409);
  const history = await request('GET', `/api/batches/${id}/history`, 'anika');
  assert.equal(history.data.decisions[0].actorId, actors.dev.id);
  assert.equal(history.data.audit.some(event => event.action === 'decision.reject' && event.actorName === 'Dev'), true);
});

test('SSE streams authorized change notifications', async () => {
  const abort = new AbortController();
  const response = await fetch(`${base}/api/events`, { headers: { Authorization: `Bearer ${tokens.anika}` }, signal: abort.signal });
  assert.equal(response.status, 200); const reader = response.body.getReader();
  assert.match(Buffer.from((await reader.read()).value).toString(), /event: ready/);
  await batchWithCandidates();
  const next = await reader.read(); assert.match(Buffer.from(next.value).toString(), /event: change/);
  abort.abort();
});
