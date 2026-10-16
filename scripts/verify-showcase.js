const http = require('http');

function req(options, postData) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () =>
        resolve({ statusCode: res.statusCode, headers: res.headers, body: data })
      );
    });
    r.on('error', reject);
    if (postData) r.write(postData);
    r.end();
  });
}

async function run() {
  console.log('=== VERIFYING REACHINBOX SHOWCASE BACKEND ===\n');

  console.log('1. Health check...');
  const health = await req({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/health',
    method: 'GET',
  });
  console.log('  Health:', health.statusCode, health.body);

  console.log('\n2. Dev Login (Demo User)...');
  const login = await req(
    {
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/auth/dev-login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    '{}'
  );
  console.log('  Login Status:', login.statusCode);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  console.log('  Session Cookie Acquired:', cookie.substring(0, 35) + '...');

  console.log('\n3. /api/v1/auth/me...');
  const me = await req({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/auth/me',
    method: 'GET',
    headers: { Cookie: cookie },
  });
  console.log('  Me:', me.statusCode, me.body);

  console.log('\n4. Sent emails query...');
  const sentRes = await req({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/emails/sent',
    method: 'GET',
    headers: { Cookie: cookie },
  });
  console.log('  Sent status:', sentRes.statusCode);
  const sentData = JSON.parse(sentRes.body).data;
  console.log('  Sent count:', sentData.length);
  const emailId = sentData[0]?.id;

  if (emailId) {
    console.log('\n5. Email HTML Preview (Public Link):', emailId);
    const prevRes = await req({
      hostname: 'localhost',
      port: 4000,
      path: '/api/v1/emails/' + emailId + '/preview',
      method: 'GET',
    });
    console.log('  Preview HTTP Status:', prevRes.statusCode);
    const hasNotice =
      prevRes.body.includes('Demo Delivery') &&
      prevRes.body.includes('Simulated locally. No external email was sent.');
    console.log('  Contains Demo Notice:', hasNotice);
    console.log('  Contains Sender:', prevRes.body.includes('Oliver Brown'));
  }

  console.log('\n6. Search query for "reviewer"...');
  const searchRes = await req({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/emails/search?q=reviewer',
    method: 'GET',
    headers: { Cookie: cookie },
  });
  console.log('  Search status:', searchRes.statusCode);
  const searchJson = JSON.parse(searchRes.body);
  console.log('  Found matches:', searchJson.data?.length);
  if (searchJson.data && searchJson.data[0]) {
    console.log('  Matched recipient:', searchJson.data[0].recipientEmail);
    console.log('  Matched subject:', searchJson.data[0].subject);
  }

  console.log('\n7. Testing Rate Limiting and Local Slack Notification Simulation...');
  const path = require('path');
  const { PrismaClient } = require('@prisma/client');
  const dbFile = path.resolve(__dirname, '../prisma/showcase.db').replace(/\\/g, '/');
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${dbFile}` } },
  });
  
  const senders = await prisma.sender.findMany();
  const demoSender = senders[0];

  // Count emails already sent this hour for this sender
  const hourStart = new Date();
  hourStart.setUTCMinutes(0, 0, 0);
  const sentThisHour = await prisma.emailJob.count({
    where: {
      senderId: demoSender.id,
      status: 'SENT',
      sentAt: { gte: hourStart },
    },
  });

  // Set maxEmailsPerHour equal to sentThisHour (quota reached)
  const quotaLimit = Math.max(1, sentThisHour);
  await prisma.sender.update({
    where: { id: demoSender.id },
    data: { maxEmailsPerHour: quotaLimit },
  });
  console.log(`  Set sender ${demoSender.email} maxEmailsPerHour to ${quotaLimit} (already sent this hour: ${sentThisHour})`);

  // Now schedule an extra email which MUST hit the hourly rate limit
  const rlSched = await req({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/schedules',
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
    },
  }, JSON.stringify({
    senderId: demoSender.id,
    subject: 'Rate Limit Test Subject',
    body: '<p>This should be deferred due to hourly limit.</p>',
    startAt: new Date().toISOString(),
    recipients: ['deferred.recipient.' + Date.now() + '@example.com'],
  }));
  console.log('  Rate limit test schedule created:', rlSched.statusCode);

  console.log('  Waiting 4s for showcase scheduler to evaluate rate limit...');
  await new Promise((r) => setTimeout(r, 4000));

  // Check if job is RATE_LIMITED
  const rateLimitedJob = await prisma.emailJob.findFirst({
    where: { subject: 'Rate Limit Test Subject' },
    orderBy: { createdAt: 'desc' },
  });
  console.log('  Job status:', rateLimitedJob?.status, '(Expected: RATE_LIMITED)');
  console.log('  Job deferred scheduledAt:', rateLimitedJob?.scheduledAt);

  // Check Slack notifications endpoint
  const notifsRes = await req({
    hostname: 'localhost',
    port: 4000,
    path: '/api/v1/integrations/slack/notifications',
    method: 'GET',
    headers: { Cookie: cookie },
  });
  console.log('  Notifications status:', notifsRes.statusCode);
  const notifs = JSON.parse(notifsRes.body).data;
  console.log('  Notification events count:', notifs?.length);
  if (notifs && notifs[0]) {
    console.log('  Event Title:', notifs[0].title);
    console.log('  Simulation Notice:', notifs[0].notice);
    console.log('  Is Simulation:', notifs[0].isSimulation);
  }

  // Restore maxEmailsPerHour to 200
  await prisma.sender.update({
    where: { id: demoSender.id },
    data: { maxEmailsPerHour: 200 },
  });
  await prisma.$disconnect();

  console.log('\n✅ ALL BACKEND SHOWCASE VERIFICATION CHECKS COMPLETED!');
}

run().catch((e) => {
  console.error('❌ Verification failed:', e);
  process.exit(1);
});
