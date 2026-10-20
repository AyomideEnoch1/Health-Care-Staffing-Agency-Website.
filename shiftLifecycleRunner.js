'use strict';
/**
 * Standalone Shift Lifecycle Runner
 * Divine Fingers Healthcare Services Inc.
 *
 * Runs the recurring shift progression daemon (clock-ins, auto-completes, shift timeouts).
 * Uses MySQL named advisory locking (GET_LOCK) to ensure that only ONE daemon process
 * executes across the entire server cluster.
 */

require('dotenv').config();
const { acquireSingleton, releaseSingleton } = require('./utils/singleton');
const { startShiftLifecycleDaemon } = require('./utils/shiftLifecycle');

const LOCK_NAME = 'shiftLifecycle';

(async () => {
  console.log('[Shift Lifecycle Runner] Attempting to acquire cluster singleton lock...');
  const acquired = await acquireSingleton(LOCK_NAME);

  if (!acquired) {
    console.log('[Shift Lifecycle Runner] Another process is already running this daemon. Exiting.');
    process.exit(0);
  }

  console.log('✅ [Shift Lifecycle Runner] Singleton lock acquired. Starting lifecycle daemon (60s loop)...');
  startShiftLifecycleDaemon(60000);
})().catch((err) => {
  console.error('[FATAL] Shift Lifecycle Runner failed:', err);
  process.exit(1);
});

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    console.log(`[Shift Lifecycle Runner] Received ${sig}, releasing lock and shutting down...`);
    await releaseSingleton(LOCK_NAME);
    process.exit(0);
  });
}
