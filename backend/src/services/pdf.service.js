const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const { config } = require('../config/env');

async function renderPdf(certificate, res) {
  const qr = await QRCode.toBuffer(
    `${config.publicUrl}/api/verify/${certificate.verificationToken}`,
    { width: 160, margin: 1 },
  );
  const document = new PDFDocument({
    size: 'A4', layout: 'landscape',
    margins: { top: 48, left: 48, right: 48, bottom: 30 },
  });
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${certificate.number}.pdf"`,
    'Cache-Control': 'no-store',
  });
  document.on('error', (error) => res.destroy(error));
  document.pipe(res);
  document.rect(24, 24, 793, 547).lineWidth(2).stroke('#1d4ed8');
  document.fillColor('#1e3a8a').fontSize(16).text('PRAGATI SKILLS MISSION', { align: 'center' });
  document.moveDown().fontSize(28).text('Certificate of Completion', { align: 'center' });
  document
    .moveDown()
    .fillColor('#334155')
    .fontSize(12)
    .text('This certifies that', { align: 'center' });
  document
    .moveDown(0.5)
    .fillColor('#0f172a')
    .fontSize(24)
    .text(certificate.name, { align: 'center' });
  document
    .moveDown(0.5)
    .fontSize(14)
    .text(`successfully completed ${certificate.course}`, { align: 'center' });
  document
    .moveDown(0.5)
    .fontSize(12)
    .text(`${certificate.centreName} | Completed: ${certificate.courseCompletedOn}`, {
      align: 'center',
    });
  document.fontSize(9).text(`Certificate: ${certificate.number}`, 48, 420, { width: 550 });
  document.text(`Issued: ${certificate.issuedAt.toISOString().slice(0, 10)}`, 48, 440);
  document.text('Scan the QR code to check the current validity of this certificate.', 48, 460, {
    width: 500,
  });
  document.image(qr, 640, 375, { width: 130 });
  if (config.showVerificationToken) {
    document.fillColor('#334155').font('Helvetica-Bold').fontSize(8)
      .text('Verification token (local testing)', 525, 513, { width: 275, align: 'center' });
    document.font('Courier').fontSize(7)
      .text(certificate.verificationToken, 525, 527, { width: 275, align: 'center' });
    document.font('Helvetica').fontSize(7)
      .text('Paste this token into Public Verify to check validity.', 525, 540, { width: 275, align: 'center' });
  }
  document.end();
}

module.exports = { renderPdf };
