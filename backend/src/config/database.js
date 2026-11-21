const mongoose = require('mongoose');
const { config } = require('./env');
const { models } = require('../models');
async function connectDatabase() {
  await mongoose.connect(config.mongoUri, {
    serverSelectionTimeoutMS: 10000,
  });
  const hello = await mongoose.connection.db.admin().command({
    hello: 1,
  });
  if (!hello.setName && hello.msg !== 'isdbgrid')
    throw new Error('MongoDB must support transactions: use Atlas or a replica set');
  await Promise.all(models.map((model) => model.init()));
}

module.exports = { connectDatabase };
