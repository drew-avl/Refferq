#!/usr/bin/env node

/**
 * SMTP email configuration test script.
 *
 * Usage:
 *   node scripts/test-email.js <your-email@example.com>
 */

require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

function mask(value) {
  if (!value) return '';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

async function testEmailConfiguration() {
  console.log('\nTesting SMTP email configuration...\n');

  const smtpHost = process.env.SMTP_HOST || 'smtp.office365.com';
  const smtpPort = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const fromEmail =
    process.env.SMTP_FROM_EMAIL ||
    process.env.SMTP_FROM ||
    smtpUser ||
    'ReferConnect <noreply@referconnect.com>';

  const requiredEnvVars = {
    SMTP_HOST: smtpHost,
    SMTP_PORT: String(smtpPort),
    SMTP_USER: smtpUser,
    SMTP_PASSWORD: smtpPassword,
    SMTP_FROM_EMAIL: fromEmail,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  let hasErrors = false;

  console.log('Checking environment variables:\n');
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      console.log(`  FAIL ${key} - NOT SET`);
      hasErrors = true;
    } else {
      const displayValue = key === 'SMTP_PASSWORD' ? mask(value) : value;
      console.log(`  OK   ${key} - ${displayValue}`);
    }
  }

  if (hasErrors) {
    console.log('\nConfiguration error: missing required environment variables.\n');
    console.log('Add these to .env.local:');
    console.log('  SMTP_HOST="smtp.office365.com"');
    console.log('  SMTP_PORT="587"');
    console.log('  SMTP_USER="notifications@yourdomain.com"');
    console.log('  SMTP_PASSWORD="your-mailbox-password-or-app-password"');
    console.log('  SMTP_FROM_EMAIL="ReferConnect <notifications@yourdomain.com>"');
    console.log('  NEXT_PUBLIC_APP_URL="http://localhost:3000"');
    process.exit(1);
  }

  const recipientEmail = process.argv[2];
  if (!recipientEmail) {
    console.log('\nError: provide a recipient email address.');
    console.log('Usage: node scripts/test-email.js <your-email@example.com>');
    process.exit(1);
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(recipientEmail)) {
    console.log(`\nInvalid email format: ${recipientEmail}`);
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
    requireTLS: process.env.SMTP_REQUIRE_TLS !== 'false' && smtpPort !== 465,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

  console.log(`\nSending test email to: ${recipientEmail}\n`);

  try {
    const result = await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject: 'ReferConnect SMTP Configuration Test',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Email Test</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #0f766e; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 10px 10px; }
            .success-box { background: #dcfce7; border: 1px solid #86efac; color: #166534; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Email Configuration Test</h1>
          </div>
          <div class="content">
            <h2>Success</h2>
            <div class="success-box">
              <strong>Your ReferConnect SMTP configuration is working.</strong>
            </div>
            <p>This test verifies SMTP host, credentials, sender, and TLS settings.</p>
            <h3>Configuration</h3>
            <ul>
              <li><strong>Host:</strong> ${smtpHost}</li>
              <li><strong>Port:</strong> ${smtpPort}</li>
              <li><strong>From:</strong> ${fromEmail}</li>
              <li><strong>To:</strong> ${recipientEmail}</li>
              <li><strong>App URL:</strong> ${process.env.NEXT_PUBLIC_APP_URL}</li>
            </ul>
          </div>
          <div class="footer">
            <p>Copyright ${new Date().getFullYear()} ReferConnect. All rights reserved.</p>
          </div>
        </body>
        </html>
      `,
    });

    console.log('Email sent successfully.');
    console.log(`  Message ID: ${result.messageId || 'N/A'}`);
    console.log(`  From: ${fromEmail}`);
    console.log(`  To: ${recipientEmail}`);
    console.log('\nCheck your inbox and spam folder for the test email.\n');
  } catch (error) {
    console.log('Failed to send email.\n');
    console.log(`  ${error.message}`);
    console.log('\nTips:');
    console.log('  - Confirm SMTP AUTH is enabled for the Microsoft 365 mailbox.');
    console.log('  - Use smtp.office365.com, port 587, and STARTTLS.');
    console.log('  - Confirm the From address matches or is allowed by the mailbox.');
    process.exit(1);
  }
}

testEmailConfiguration().catch((error) => {
  console.error('\nUnexpected error:', error);
  process.exit(1);
});
