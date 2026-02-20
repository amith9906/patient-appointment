const nodemailer = require('nodemailer');

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

exports.sendPasswordOtpEmail = async (toEmail, otp, userName = 'User') => {
  if (!hasSmtpConfig()) {
    console.log(`[DEV OTP] Password reset OTP for ${toEmail}: ${otp}`);
    return { delivered: false, mode: 'dev-log' };
  }

  const transporter = getTransporter();
  const from = process.env.FROM_EMAIL || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
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

  return { delivered: true, mode: 'smtp' };
};
