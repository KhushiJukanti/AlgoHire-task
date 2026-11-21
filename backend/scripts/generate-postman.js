const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../postman');
fs.mkdirSync(root, { recursive: true });
const bearer = user => ({ type: 'bearer', bearer: [{ key: 'token', value: `{{${user}Token}}`, type: 'string' }] });
function request(name, method, route, user, body, script = '', description = '') {
  return { name, request: { method, header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
    auth: user ? bearer(user) : { type: 'noauth' }, url: route.startsWith('{{downloadUrl}}') ? route : `{{baseUrl}}${route}`,
    description, ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } } } : {}) },
    event: [{ listen: 'test', script: { type: 'text/javascript', exec: ["pm.test('Successful response', () => pm.expect(pm.response.code).to.be.within(200, 299));", ...script.split('\n').filter(Boolean)] } }] };
}
const auth = ['anika', 'dev', 'meera', 'kabir', 'neha', 'farah'].map(user => request(`Demo login - ${user}`, 'POST', '/api/auth/demo-login', null, { email: `${user}@certiflow.demo` }, `pm.collectionVariables.set('${user}Token', pm.response.json().token);`));
auth.unshift(request('List demo users', 'GET', '/api/auth/demo-users'));
auth.push(request('Password login - Anika', 'POST', '/api/auth/login', null, { email: 'anika@certiflow.demo', password: '{{demoPassword}}' }, "pm.collectionVariables.set('anikaToken', pm.response.json().token);"));
auth.push(request('Current user', 'GET', '/api/auth/me', 'anika'));
const saveBatch = "const b = pm.response.json().batch; if (b) { pm.collectionVariables.set('batchId', b._id); pm.collectionVariables.set('revision', b.revision); }";
const candidates = Array.from({ length: 60 }, (_, index) => ({ candidateId: `P${index + 1}`, name: `Candidate ${index + 1}`, phone: `+91900200${String(index + 1).padStart(4, '0')}`, courseCompletedOn: '2026-01-01' }));
const approvals = ['dev', 'meera', 'neha', 'farah'].map(user => {
  const item = request(`Approve - ${user}`, 'POST', '/api/batches/{{batchId}}/decisions', user, { action: 'approve', revision: 1 }, saveBatch);
  item.request.body.raw = '{\n  "action": "approve",\n  "revision": {{revision}}\n}'; return item;
});
const importFile = request('Import spreadsheet (replace roster)', 'POST', '/api/batches/{{batchId}}/candidates/import', 'anika', undefined, '', 'Select samples/candidates.csv or an XLSX file in the file field. Draft/returned batches only. Entire roster is replaced atomically.');
importFile.request.header = []; importFile.request.body = { mode: 'formdata', formdata: [{ key: 'file', type: 'file', src: [] }] };
const validateFile = JSON.parse(JSON.stringify(importFile)); validateFile.name = 'Validate spreadsheet only'; validateFile.request.url += '?validateOnly=true';
const returnExample = request('Send back - district officer Meera', 'POST', '/api/batches/{{batchId}}/decisions', 'meera', { action: 'return', revision: 1, reason: 'Correct the candidate details' });
returnExample.request.body.raw = returnExample.request.body.raw.replace('"revision": 1', '"revision": {{revision}}');
const rejectExample = request('Reject - district officer Dev', 'POST', '/api/batches/{{batchId}}/decisions', 'dev', { action: 'reject', revision: 1, reason: 'Assessment evidence is invalid' });
rejectExample.request.body.raw = rejectExample.request.body.raw.replace('"revision": 1', '"revision": {{revision}}');
const collection = {
  info: { name: 'CertiFlow Backend - JavaScript MVC', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json', description: 'Run npm run seed, npm start, and npm run worker. Run folders 01–03 in order. Folder 04: poll the certificate list until jobs finish, then verify/download. Other folders contain optional actions and negative-state scenarios; do not run every folder blindly. Login requests store each role token; batch submission stores batchId and revision. Credentials are demo-only.' },
  variable: ['baseUrl', 'demoPassword', 'batchId', 'revision', 'certificateId', 'verificationToken', 'downloadUrl', 'anikaToken', 'devToken', 'meeraToken', 'kabirToken', 'nehaToken', 'farahToken'].map(key => ({ key, value: key === 'baseUrl' ? 'http://localhost:7000' : key === 'demoPassword' ? 'CertiFlowDemo123!' : key === 'revision' ? '1' : '', type: 'string' })),
  item: [
    { name: '01 - Authentication', item: auth },
    { name: '02 - Create and submit 60-candidate batch', item: [
      request('Health', 'GET', '/health'), request('My centres', 'GET', '/api/centres', 'anika'),
      request('Create batch', 'POST', '/api/batches', 'anika', { title: 'Postman Digital Skills Batch', course: 'Digital Skills' }, saveBatch),
      request('Add 60 candidates (JSON)', 'PUT', '/api/batches/{{batchId}}/candidates', 'anika', { candidates }),
      request('Get candidates', 'GET', '/api/batches/{{batchId}}/candidates?limit=100', 'anika'),
      request('Submit batch', 'POST', '/api/batches/{{batchId}}/submit', 'anika', undefined, saveBatch),
    ] },
    { name: '03 - Approvals in order', item: approvals },
    { name: '04 - Certificates and delivery', item: [
      request('List certificates (poll until available)', 'GET', '/api/batches/{{batchId}}/certificates?limit=100', 'anika', undefined,
        "const c = pm.response.json().certificates?.[0]; if(c) { pm.collectionVariables.set('certificateId', c._id); pm.collectionVariables.set('verificationToken', c.verificationToken); }", 'Issuance runs asynchronously. Repeat until a certificate is present.'),
      request('List delivery statuses', 'GET', '/api/batches/{{batchId}}/deliveries?limit=100', 'anika'),
      request('Certificate details', 'GET', '/api/certificates/{{certificateId}}', 'anika'),
      request('Public verification - no login', 'GET', '/api/verify/{{verificationToken}}'),
      request('Authenticated PDF download', 'GET', '/api/certificates/{{certificateId}}/pdf', 'anika'),
      request('Create candidate download link', 'POST', '/api/certificates/{{certificateId}}/download-link', 'anika', undefined, "pm.collectionVariables.set('downloadUrl', pm.response.json().url);"),
      request('Candidate PDF download - signed link', 'GET', '{{downloadUrl}}'),
      request('Inspect mock WhatsApp message', 'GET', '/api/certificates/{{certificateId}}/mock-message', 'anika'),
      request('Batch audit and decisions', 'GET', '/api/batches/{{batchId}}/history', 'anika'),
      request('Submitted revision snapshots', 'GET', '/api/batches/{{batchId}}/revisions', 'anika'),
    ] },
    { name: '05 - Browse and review', item: [
      request('List batches', 'GET', '/api/batches?page=1&limit=20', 'anika'),
      request('Get batch', 'GET', '/api/batches/{{batchId}}', 'anika'),
      ...['dev', 'neha', 'farah'].map(user => request(`Review inbox - ${user}`, 'GET', '/api/batches/inbox', user)),
      request('State dashboard', 'GET', '/api/state/dashboard', 'farah'),
      request('Overdue escalations', 'GET', '/api/state/escalations', 'farah'),
      request('Queue status and failed jobs', 'GET', '/api/state/jobs', 'farah'),
    ] },
    { name: '06 - Optional draft edits and return/reject flows', item: [
      request('Create another draft', 'POST', '/api/batches', 'anika', { title: 'Correction Demo Batch', course: 'Digital Skills' }, saveBatch),
      importFile, validateFile,
      request('Edit draft or returned batch', 'PATCH', '/api/batches/{{batchId}}', 'anika', { title: 'Corrected Batch' }),
      request('Submit or resubmit (resets approvals)', 'POST', '/api/batches/{{batchId}}/submit', 'anika', undefined, saveBatch),
      returnExample, rejectExample,
    ] },
    { name: '07 - Optional recovery and revocation', item: [
      request('Retry failed delivery', 'POST', '/api/certificates/{{certificateId}}/retry-delivery', 'farah'),
      request('Retry failed issuance', 'POST', '/api/state/batches/{{batchId}}/retry-issuance', 'farah'),
      request('Revoke certificate', 'POST', '/api/certificates/{{certificateId}}/revoke', 'farah', { reason: 'Certificate was issued against invalid assessment evidence' }),
      request('Verify revoked certificate', 'GET', '/api/verify/{{verificationToken}}', null, undefined, "pm.test('Revoked immediately', () => pm.expect(pm.response.json().valid).to.eql(false));"),
    ] },
    { name: '08 - Live updates (long-lived SSE)', item: [request('Connect SSE - Anika', 'GET', '/api/events', 'anika', undefined, '', 'Keep open while another request changes a batch. Frontend uses fetch streaming with Authorization; reconnect and refetch on ready/reconnect.')] },
  ],
};
fs.writeFileSync(path.join(root, 'CertiFlow.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(root, 'CertiFlow.local.postman_environment.json'), JSON.stringify({ name: 'CertiFlow Local', values: [{ key: 'baseUrl', value: 'http://localhost:7000', enabled: true }, { key: 'demoPassword', value: 'CertiFlowDemo123!', enabled: true }], _postman_variable_scope: 'environment' }, null, 2) + '\n');
console.log('Generated Postman collection and local environment');
