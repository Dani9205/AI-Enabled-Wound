const sendEmailCode = async ({ to, code, purpose }) => {
  const nodemailer = require('nodemailer');
  const subject =
    purpose === 'reset_password'
      ? 'Your password reset code'
      : purpose === 'signup'
        ? 'Your account verification code'
        : 'Your sign in verification code';
  const text = `Your 6 digit verification code is ${code}.
   This code will expire in 10 minutes.`;

  if (!process.env.MAIL_HOST || !process.env.MAIL_USER || !process.env.MAIL_PASS) {
    throw new Error('MAIL_HOST, MAIL_USER and MAIL_PASS are required to send email');
  }

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT || 587),
    secure: process.env.MAIL_SECURE === 'true',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    text,
  });
};

module.exports = {
  sendEmailCode,
};
