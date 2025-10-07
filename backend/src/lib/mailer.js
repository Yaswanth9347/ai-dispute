// backend/src/lib/mailer.js
const nodemailer = require('nodemailer');

let transporterPromise = null;

async function getTransporter() {
  if (transporterPromise) return transporterPromise;
  transporterPromise = (async () => {
    const host = process.env.SMTP_HOST;
    if (!host) {
      // create Ethereal test account
      const testAccount = await nodemailer.createTestAccount();
      const t = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log('[mailer] using Ethereal test account — preview URLs will be in logs.');
      transporterPromise._ethereal = testAccount; // attach for preview
      return t;
    } else {
      const t = nodemailer.createTransport({
        host,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      return t;
    }
  })();
  return transporterPromise;
}

async function sendMail(opts) {
  const transporter = await getTransporter();
  const from = process.env.NOTIFY_FROM || 'AI Dispute <no-reply@example.com>';
  const info = await transporter.sendMail(Object.assign({ from }, opts));
  // If Ethereal, log preview URL
  if (transporterPromise && transporterPromise._ethereal) {
    const preview = nodemailer.getTestMessageUrl(info);
    console.log('[mailer] Preview URL:', preview);
    return { info, preview };
  }
  return { info };
}

module.exports = { sendMail, getTransporter };
