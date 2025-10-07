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

// Backwards-compatible sendEmail wrapper used by services
async function sendEmail(options) {
  // options may be: { to, subject, html, text } or { to, subject, template, data }
  if (!options || !options.to || !options.subject) {
    throw new Error('sendEmail requires at least to and subject');
  }

  let mailOpts = {
    to: options.to,
    subject: options.subject,
  };

  if (options.html) {
    mailOpts.html = options.html;
  } else if (options.text) {
    mailOpts.text = options.text;
  } else if (options.template && options.data) {
    // Very small templating fallback: interpolate {{key}} from data into template string name if provided
    // In production a proper templating engine would be used. Here we build a minimal HTML body.
    const d = options.data || {};
    const title = options.subject || d.subject || '';
    let body = `<div style="font-family: Arial, sans-serif; max-width:600px;margin:0 auto;">`;
    body += `<h2 style="color:#2563eb">${title}</h2>`;
    body += `<p>${d.invitation_message || d.message || ''}</p>`;
    if (d.invitation_url) {
      body += `<p><a href="${d.invitation_url}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open Invitation</a></p>`;
    }
    body += `<p style="color:#6b7280;font-size:13px">This is an automated message from the AI Dispute Resolver system.</p>`;
    body += `</div>`;
    mailOpts.html = body;
  } else {
    // Fallback text
    mailOpts.text = options.text || (options.template ? `You have a notification: ${options.subject}` : '');
  }

  const result = await sendMail(mailOpts);
  return result;
}

// also export sendEmail for existing code
module.exports.sendEmail = sendEmail;
