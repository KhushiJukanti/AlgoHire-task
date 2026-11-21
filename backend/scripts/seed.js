const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { config, validateConfig } = require('../src/config/env');
const { connectDatabase } = require('../src/config/database');
const { Centre, User, Batch, Candidate } = require('../src/models');
const { createBatch, replaceCandidates, submitBatch } = require('../src/services/batch.service');

async function seed() {
  if (!config.demo) throw new Error('Demo seed requires DEMO_MODE=true outside production');
  const passwordHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'CertiFlowDemo123!', 12);
  const centre = await Centre.findOneAndUpdate({ code: 'PRAGATI-001' }, { $setOnInsert: { name: 'Pragati Hyderabad Training Centre', code: 'PRAGATI-001', districtId: 'hyderabad' } }, { upsert: true, returnDocument: 'after' });
  const users = [ ['Anika', 'centre'], ['Dev', 'district'], ['Meera', 'district'], ['Kabir', 'district'], ['Neha', 'quality'], ['Farah', 'state'] ];
  for (const [name, role] of users) {
    await User.updateOne({ email: `${name.toLowerCase()}@certiflow.demo` }, { $setOnInsert: { name, role, passwordHash, email: `${name.toLowerCase()}@certiflow.demo`, centreId: role === 'centre' ? centre._id : undefined, districtId: ['centre', 'district'].includes(role) ? 'hyderabad' : undefined } }, { upsert: true });
  }
  const anika = await User.findOne({ email: 'anika@certiflow.demo' });
  const actor = { id: String(anika._id), name: anika.name, role: anika.role, centreId: String(centre._id), districtId: 'hyderabad' };
  for (const [title, count, submit] of [['Demo: Web Development - 3 candidates', 3, false], ['Demo: Digital Skills - 60 candidates', 60, true]]) {
    if (await Batch.exists({ title, centreId: centre._id })) continue;
    const batch = await createBatch({ title, course: 'Digital Skills' }, actor);
    await replaceCandidates(String(batch._id), Array.from({ length: count }, (_, index) => ({ candidateId: `demo-${index + 1}`, name: `Demo Candidate ${index + 1}`, phone: `+91900000${String(index + 1).padStart(4, '0')}`, courseCompletedOn: '2026-01-01' })), actor);
    if (submit) await submitBatch(String(batch._id), actor);
  }
  return { users: users.map(([name, role]) => ({ name, role, email: `${name.toLowerCase()}@certiflow.demo` })), centreId: String(centre._id) };
}
if (require.main === module) (async () => {
  validateConfig(); await connectDatabase(); console.log(JSON.stringify(await seed(), null, 2)); await mongoose.disconnect();
})().catch(error => { console.error('Seed failed:', error.message); process.exit(1); });
module.exports = { seed };
