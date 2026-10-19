const nodemailer = require('nodemailer');

let transporter = null;

// Initialize mail transporter with fallback
const initTransporter = async () => {
  // 1. Direct Gmail Service (using standard Gmail App Password)
  if (process.env.SMTP_SERVICE === 'gmail' || (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD)) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.SMTP_USER || process.env.GMAIL_USER,
        pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD,
      },
    });
    console.log('📧 Gmail SMTP configured for direct inbox delivery');
    return transporter;
  }

  // 2. Custom SMTP Host (SendGrid, Brevo, Resend, Mailgun, Amazon SES)
  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    console.log(`📧 Custom SMTP configured (${process.env.SMTP_HOST}) for real delivery`);
    return transporter;
  }

  // 3. Graceful development fallback (Ethereal test mailer - sandbox only)
  try {
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    console.log('📧 Ethereal sandbox initialized (Note: to receive emails in real inboxes, set SMTP_USER and SMTP_PASS)');
    return transporter;
  } catch {
    console.warn('⚠️ Mail transporter init skipped — will log emails to console');
    return null;
  }
};

initTransporter();

/**
 * Send settlement confirmation email
 */
const sendSettlementEmail = async ({ toEmail, toName, fromName, amount, groupName }) => {
  if (!toEmail) return;
  try {
    if (!transporter) await initTransporter();

    const title = groupName ? `Settlement in "${groupName}"` : 'Settlement with ' + fromName;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f0f0f; color: #ededed; border: 1px solid #222; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #10b981; margin: 0;">✂️ SplitEasy Settlement</h2>
          <p style="color: #888; font-size: 14px; margin-top: 4px;">${title}</p>
        </div>
        <div style="background: #181818; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 20px;">
          <div style="font-size: 13px; color: #aaa; text-transform: uppercase; letter-spacing: 1px;">Amount Settled</div>
          <div style="font-size: 32px; font-weight: bold; color: #10b981; margin: 8px 0;">₹${Number(amount).toFixed(2)}</div>
          <div style="font-size: 14px; color: #ddd;"><strong>${fromName}</strong> has recorded a settlement with <strong>${toName}</strong>.</div>
        </div>
        <p style="font-size: 13px; color: #666; text-align: center; margin: 0;">This is an automated notification from SplitEasy.</p>
      </div>
    `;

    if (transporter) {
      const info = await transporter.sendMail({
        from: '"SplitEasy" <no-reply@spliteasy.app>',
        to: toEmail,
        subject: `✅ [SplitEasy] Settlement Recorded: ₹${amount}`,
        html,
      });
      console.log(`✉️ Settlement email sent to ${toEmail}. Preview: ${nodemailer.getTestMessageUrl(info) || 'delivered'}`);
    } else {
      console.log(`✉️ [Simulated Email] To: ${toEmail} | Subject: Settlement Recorded ₹${amount}`);
    }
  } catch (err) {
    console.warn(`Could not send settlement email to ${toEmail}:`, err.message);
  }
};

/**
 * Send expense notification email
 */
const sendExpenseEmail = async ({ toEmail, toName, payerName, description, totalAmount, yourShare, groupName }) => {
  if (!toEmail) return;
  try {
    if (!transporter) await initTransporter();

    const title = groupName ? `New Expense in "${groupName}"` : 'New Shared Expense';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; background: #0f0f0f; color: #ededed; border: 1px solid #222; border-radius: 12px; padding: 24px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #10b981; margin: 0;">✂️ SplitEasy Expense</h2>
          <p style="color: #888; font-size: 14px; margin-top: 4px;">${title}</p>
        </div>
        <div style="background: #181818; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <div style="font-size: 18px; font-weight: bold; color: #fff; margin-bottom: 6px;">${description}</div>
          <div style="font-size: 13px; color: #888; margin-bottom: 16px;">Paid by ${payerName} (Total: ₹${Number(totalAmount).toFixed(2)})</div>
          <div style="border-top: 1px solid #2a2a2a; padding-top: 12px; display: flex; justify-content: space-between;">
            <span style="color: #aaa; font-size: 14px;">Your share:</span>
            <span style="color: #f43f5e; font-size: 16px; font-weight: bold;">₹${Number(yourShare).toFixed(2)}</span>
          </div>
        </div>
        <p style="font-size: 13px; color: #666; text-align: center; margin: 0;">This is an automated notification from SplitEasy.</p>
      </div>
    `;

    if (transporter) {
      const info = await transporter.sendMail({
        from: '"SplitEasy" <no-reply@spliteasy.app>',
        to: toEmail,
        subject: `💸 [SplitEasy] New Expense: ${description} (Your share: ₹${yourShare})`,
        html,
      });
      console.log(`✉️ Expense email sent to ${toEmail}. Preview: ${nodemailer.getTestMessageUrl(info) || 'delivered'}`);
    } else {
      console.log(`✉️ [Simulated Email] To: ${toEmail} | Subject: New Expense ${description}`);
    }
  } catch (err) {
    console.warn(`Could not send expense email to ${toEmail}:`, err.message);
  }
};

module.exports = { sendSettlementEmail, sendExpenseEmail };
