#!/usr/bin/env node

/**
 * Microsoft Graph email configuration test script.
 *
 * Usage:
 *   node scripts/test-email.js <your-email@example.com>
 */

require('dotenv').config({ path: '.env.local' });

function mask(value) {
  if (!value) return '';
  if (value.length <= 6) return '***';
  return `${value.slice(0, 3)}...${value.slice(-3)}`;
}

function firstEnv(...keys) {
  for (const key of keys) {
    if (process.env[key]) return process.env[key];
  }
  return undefined;
}

async function getAccessToken({ tenantId, clientId, clientSecret }) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
    scope: 'https://graph.microsoft.com/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || !payload.access_token) {
    const detail = payload.error_description || payload.error || response.statusText;
    throw new Error(`Token request failed (${response.status}): ${detail}`);
  }

  return payload.access_token;
}

async function sendTestEmail({ accessToken, sender, recipientEmail }) {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(sender)}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          subject: 'ReferConnect Microsoft Graph Email Test',
          body: {
            contentType: 'HTML',
            content: `
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
                    <strong>Your ReferConnect Microsoft Graph email configuration is working.</strong>
                  </div>
                  <p>This test verifies Entra app credentials, Graph Mail.Send permission, and the sender mailbox.</p>
                  <h3>Configuration</h3>
                  <ul>
                    <li><strong>Sender:</strong> ${sender}</li>
                    <li><strong>To:</strong> ${recipientEmail}</li>
                    <li><strong>App URL:</strong> ${process.env.NEXT_PUBLIC_APP_URL || 'not set'}</li>
                  </ul>
                </div>
                <div class="footer">
                  <p>Copyright ${new Date().getFullYear()} ReferConnect. All rights reserved.</p>
                </div>
              </body>
              </html>
            `,
          },
          toRecipients: [{ emailAddress: { address: recipientEmail } }],
        },
        saveToSentItems: process.env.MICROSOFT_GRAPH_SAVE_TO_SENT_ITEMS !== 'false',
      }),
    }
  );

  if (response.status !== 202) {
    const detail = await response.text().catch(() => response.statusText);
    throw new Error(`sendMail failed (${response.status}): ${detail || response.statusText}`);
  }
}

async function testEmailConfiguration() {
  console.log('\nTesting Microsoft Graph email configuration...\n');

  const tenantId = firstEnv('MICROSOFT_TENANT_ID', 'AZURE_TENANT_ID');
  const clientId = firstEnv('MICROSOFT_CLIENT_ID', 'AZURE_CLIENT_ID');
  const clientSecret = firstEnv('MICROSOFT_CLIENT_SECRET', 'AZURE_CLIENT_SECRET');
  const sender = firstEnv('MICROSOFT_GRAPH_SENDER', 'MICROSOFT_365_SENDER', 'EMAIL_FROM_ADDRESS');

  const requiredEnvVars = {
    MICROSOFT_TENANT_ID: tenantId,
    MICROSOFT_CLIENT_ID: clientId,
    MICROSOFT_CLIENT_SECRET: clientSecret,
    MICROSOFT_GRAPH_SENDER: sender,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };

  let hasErrors = false;

  console.log('Checking environment variables:\n');
  for (const [key, value] of Object.entries(requiredEnvVars)) {
    if (!value) {
      console.log(`  FAIL ${key} - NOT SET`);
      hasErrors = true;
    } else {
      const displayValue = key === 'MICROSOFT_CLIENT_SECRET' ? mask(value) : value;
      console.log(`  OK   ${key} - ${displayValue}`);
    }
  }

  if (hasErrors) {
    console.log('\nConfiguration error: missing required environment variables.\n');
    console.log('Add these to .env.local:');
    console.log('  MICROSOFT_TENANT_ID="your-tenant-id"');
    console.log('  MICROSOFT_CLIENT_ID="your-app-client-id"');
    console.log('  MICROSOFT_CLIENT_SECRET="your-app-client-secret"');
    console.log('  MICROSOFT_GRAPH_SENDER="noreply@n45tech.com"');
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

  console.log(`\nRequesting Graph token for tenant ${tenantId}...\n`);
  const accessToken = await getAccessToken({ tenantId, clientId, clientSecret });

  console.log(`Sending test email from ${sender} to ${recipientEmail}...\n`);
  await sendTestEmail({ accessToken, sender, recipientEmail });

  console.log('Email accepted by Microsoft Graph.');
  console.log(`  From: ${sender}`);
  console.log(`  To: ${recipientEmail}`);
  console.log('\nCheck your inbox and spam folder for the test email.\n');
}

testEmailConfiguration().catch((error) => {
  console.error('\nFailed to send email.');
  console.error(`  ${error.message}`);
  console.error('\nTips:');
  console.error('  - Confirm the Entra app has Application permission: Microsoft Graph -> Mail.Send.');
  console.error('  - Confirm admin consent has been granted for Mail.Send.');
  console.error('  - Confirm MICROSOFT_GRAPH_SENDER is a real Exchange Online mailbox.');
  console.error('  - If an Application Access Policy is configured, confirm this app can send as that mailbox.');
  process.exit(1);
});
