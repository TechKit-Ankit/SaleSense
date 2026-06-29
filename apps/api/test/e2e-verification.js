const { exec } = require('child_process');
const path = require('path');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runE2E() {
  console.log('Starting API server...');
  const workspaceRoot = path.join(__dirname, '../../..');
  const serverProcess = exec('npx dotenv-cli -e .env -- npx pnpm --filter api start', { cwd: workspaceRoot });
  
  serverProcess.stdout.on('data', data => {
    console.log(`Server: ${data}`);
  });

  serverProcess.stderr.on('data', data => {
    console.error(`Server Error: ${data}`);
  });

  console.log('Waiting for server to boot (15 seconds)...');
  await sleep(15000);

  try {
    console.log('1. Testing User Registration...');
    const regRes = await fetch('http://localhost:4000/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'E2E Test User',
        email: `e2e-${Date.now()}@test.com`,
        password: 'password123',
        storeName: 'My E2E Store'
      })
    });
    
    const regData = await regRes.json();
    if (!regData.success) throw new Error('Registration failed: ' + JSON.stringify(regData));
    const token = regData.data.accessToken;
    const storeId = regData.data.store.id;
    console.log('Registration OK. Store ID:', storeId);

    console.log('2. Testing Store Fetch...');
    const storeRes = await fetch('http://localhost:4000/api/v1/stores', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const storeData = await storeRes.json();
    if (!storeData.success || storeData.data.length === 0) throw new Error('Store fetch failed');
    console.log('Store Fetch OK. Name:', storeData.data[0].name);

    console.log('3. Testing Store Deletion Flow...');
    const delRes = await fetch(`http://localhost:4000/api/v1/stores/${storeId}/request-deletion`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'x-store-id': storeId
      }
    });
    const delData = await delRes.json();
    if (!delData.success || delData.data.status !== 'PENDING_DELETION') {
      throw new Error('Store deletion failed: ' + JSON.stringify(delData));
    }
    console.log('Store Deletion OK. Status is PENDING_DELETION.');

    console.log('ALL E2E VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (e) {
    console.error('E2E VERIFICATION FAILED:', e);
    process.exitCode = 1;
  } finally {
    console.log('Shutting down server...');
    exec(`taskkill /PID ${serverProcess.pid} /T /F`, () => {
      process.exit(process.exitCode || 0);
    });
  }
}

runE2E();
