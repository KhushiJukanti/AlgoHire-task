const fs = require('node:fs');
const { renderPdf } = require('../src/services/pdf.service');
const { config } = require('../src/config/env');
(async () => {
for (const production of [false, true]) {
 config.showVerificationToken = !production;
 const output = fs.createWriteStream(__dirname + '/check-' + (production ? 'production' : 'local') + '.pdf');
 output.set = () => {};
 await renderPdf({ number:'CF-TEST', verificationToken:'abcdef0123456789'.repeat(3), name:'Asha Rao', course:'Web Development', centreName:'Pragati Hyderabad Training Centre', courseCompletedOn:'2026-01-01', issuedAt:new Date() }, output);
 await new Promise(resolve => output.on('finish', resolve));
}
})();
