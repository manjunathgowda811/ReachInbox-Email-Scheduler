const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const dbPath = path.join(rootDir, 'prisma', 'showcase.db');
const schemaPath = path.join(rootDir, 'prisma', 'schema.sqlite.prisma');

console.log('🔍 Checking local showcase SQLite database...');

let needsPush = false;
if (!fs.existsSync(dbPath)) {
  needsPush = true;
} else {
  const stat = fs.statSync(dbPath);
  if (stat.size === 0) needsPush = true;
}

if (needsPush) {
  console.log('⚡ Initializing local SQLite database schema for Showcase Mode...');
  try {
    execSync('npx prisma db push --schema=prisma/schema.sqlite.prisma', {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        DATABASE_URL: 'file:./showcase.db',
      },
    });
    console.log('✅ Local showcase SQLite database is ready at prisma/showcase.db');
  } catch (err) {
    console.error('❌ Failed to initialize SQLite database:', err.message);
    process.exit(1);
  }
} else {
  console.log('✅ Local showcase SQLite database exists at prisma/showcase.db');
}
