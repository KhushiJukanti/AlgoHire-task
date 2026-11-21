const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { config } = require('../config/env');
let queue;
let connection;
function getQueue() {
  if (!queue) {
    connection = new IORedis(config.redisUrl, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
    });
    connection.on('error', () => {});
    queue = new Queue(config.queueName, { connection });
    queue.on('error', () => {});
  }
  return queue;
}
async function closeQueue() {
  if (queue) await queue.close();
  if (connection) connection.disconnect();
  queue = undefined;
  connection = undefined;
}
module.exports = { getQueue, closeQueue };
