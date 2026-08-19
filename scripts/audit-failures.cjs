const fs = require('fs');
const path = require('path');

const logPath = path.resolve(__dirname, '../playback-failures.json');

if (fs.existsSync(logPath)) {
  const failures = JSON.parse(fs.readFileSync(logPath, 'utf8'));
  console.log(`[Playback Audit] Found ${failures.length} recorded playback/proxy failures.`);
  
  // Group errors by type to expose patterns (e.g., 500 status crashes vs HLS timeouts)
  const summary = failures.reduce((acc, curr) => {
    acc[curr.type] = (acc[curr.type] || 0) + 1;
    return acc;
  }, {});

  console.table(summary);
} else {
  console.log('[Playback Audit] No playback failures recorded in this session.');
}
