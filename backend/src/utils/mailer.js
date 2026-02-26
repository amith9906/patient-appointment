const nodemailer = require('nodemailer');
const { Resend } = require('resend');

const hasSmtpConfig = () => (
  !!process.env.SMTP_HOST
  && !!process.env.SMTP_PORT
  && !!process.env.SMTP_USER
  && !!process.env.SMTP_PASS
);

const getTransporter = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT || 587) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const formatFromAddress = () => process.env.FROM_EMAIL || process.env.SMTP_USER || 'onboarding@resend.dev';

const logDevMessage = (subject, to, html, text) => {
  console.log(`[DEV EMAIL] ${subject} → ${Array.isArray(to) ? to.join(',') : to}`);
  if (text) {
    console.log(text);
    return;
  }
  if (html) {
    console.log(html.replace(/\s+/g, ' ').trim());
  }
};

const sendEmailNotification = async ({ to, subject, html, text }) => {
try {
    if (!to) throw new Error('Recipient email address is required');
    const recipient = Array.isArray(to) ? to : [to];
    const from = formatFromAddress();
    if (resendClient) {
      const payload = {
        from,
        to: recipient,
        subject,
        html,
      };
      if (text) payload.text = text;
      const result = await resendClient.emails.send(payload);
      return { delivered: true, mode: 'resend', id: result.id };
    }
    if (hasSmtpConfig()) {
      const transporter = getTransporter();
      await transporter.sendMail({
        from,
        to: recipient,
        subject,
        html,
        text,
      });
      return { delivered: true, mode: 'smtp' };
    }
    logDevMessage(subject, recipient, html, text);
    return { delivered: false, mode: 'dev-log' };
} catch (error) {
  return { delivered: false, mode: 'dev-log', error: error.message };
}
};

exports.sendEmailNotification = sendEmailNotification;

exports.sendPasswordOtpEmail = async (toEmail, otp, userName = 'User') => sendEmailNotification({
  to: toEmail,
  subject: 'MediSchedule Password Reset OTP',
  html: `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#0f172a">
      <h2 style="margin:0 0 12px">Password Reset Request</h2>
      <p>Hello ${userName},</p>
      <p>Your OTP for password reset is:</p>
      <div style="font-size:28px;font-weight:700;letter-spacing:6px;background:#eff6ff;color:#1d4ed8;padding:10px 14px;display:inline-block;border-radius:8px">
        ${otp}
      </div>
      <p style="margin-top:14px">This OTP is valid for 10 minutes.</p>
      <p>If you did not request this, please ignore this email.</p>
    </div>
  `,
});
