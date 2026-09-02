const pool = require('../db');
const adminEvents = require('./events');

/**
 * Parses start and end Date objects from a shift record.
 */
function parseShiftWindow(shift) {
  const baseDateStr = shift.shift_date || (shift.created_at ? new Date(shift.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
  const shiftText = (shift.shift_type || '').toLowerCase();

  let startHour = 7, startMin = 0;
  let endHour = 15, endMin = 0;
  let isOvernight = false;

  const timeMatch = shiftText.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    startHour = parseInt(timeMatch[1], 10);
    startMin = parseInt(timeMatch[2], 10);
    endHour = parseInt(timeMatch[3], 10);
    endMin = parseInt(timeMatch[4], 10);
    if (endHour <= startHour) isOvernight = true;
  } else if (shiftText.includes('evening')) {
    startHour = 15; endHour = 23;
  } else if (shiftText.includes('night') || shiftText.includes('overnight')) {
    startHour = 23; endHour = 7;
    isOvernight = true;
  } else if (shiftText.includes('surge') || shiftText.includes('24h')) {
    startHour = 0; endHour = 23; endMin = 59;
  }

  const startDate = new Date(`${baseDateStr}T${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}:00`);
  const endDate = new Date(startDate);
  if (isOvernight) {
    endDate.setDate(endDate.getDate() + 1);
  }
  endDate.setHours(endHour, endMin, 0, 0);

  return { startDate, endDate };
}

/**
 * Runs automated evaluation for all active and dispatched shifts.
 */
async function evaluateShiftLifecycles() {
  try {
    const [activeShifts] = await pool.query(`
      SELECT id, request_code, facility_name, unit_department, role_requested, shift_type,
             status, assigned_staff_id, created_at, clock_in_time, clock_out_time
      FROM staffing_requests
      WHERE status IN ('dispatched', 'confirmed', 'in_session')
    `);

    if (!activeShifts || activeShifts.length === 0) return;

    const now = new Date();

    for (const shift of activeShifts) {
      const { startDate, endDate } = parseShiftWindow(shift);

      // 1. Check if shift should transition to 'in_session'
      if (now >= startDate && now < endDate && (shift.status === 'dispatched' || shift.status === 'confirmed')) {
        console.log(`[SHIFT AUTOMATION] 🟢 Transitioning ${shift.request_code} at ${shift.facility_name} to IN_SESSION`);
        
        await pool.query(
          `UPDATE staffing_requests 
           SET status = 'in_session', 
               clock_in_time = COALESCE(clock_in_time, NOW()) 
           WHERE id = ?`,
          [shift.id]
        );

        adminEvents.emit('status:changed', {
          entity: 'staffing_requests',
          id: shift.id,
          status: 'in_session',
          clock_in_time: new Date().toISOString()
        });
      }

      // 2. Check if shift has concluded -> transition to 'completed'
      else if (now >= endDate && (shift.status === 'dispatched' || shift.status === 'confirmed' || shift.status === 'in_session')) {
        console.log(`[SHIFT AUTOMATION] ✅ Transitioning ${shift.request_code} at ${shift.facility_name} to COMPLETED`);

        await pool.query(
          `UPDATE staffing_requests 
           SET status = 'completed', 
               clock_out_time = COALESCE(clock_out_time, NOW()) 
           WHERE id = ?`,
          [shift.id]
        );

        // Increment staff completed shifts counter if staff assigned
        if (shift.assigned_staff_id) {
          await pool.query(
            `UPDATE staff_roster 
             SET shifts_completed = COALESCE(shifts_completed, 0) + 1,
                 status = 'available'
             WHERE id = ?`,
            [shift.assigned_staff_id]
          );
        }

        adminEvents.emit('status:changed', {
          entity: 'staffing_requests',
          id: shift.id,
          status: 'completed',
          clock_out_time: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    console.error('[SHIFT LIFECYCLE ERROR]:', err.message);
  }
}

/**
 * Start automated shift progression background scheduler.
 */
let timer = null;
function startShiftLifecycleDaemon(intervalMs = 60000) {
  if (timer) clearInterval(timer);
  evaluateShiftLifecycles(); // Run initial evaluation immediately
  timer = setInterval(evaluateShiftLifecycles, intervalMs);
  console.log(`⏱️ Shift Lifecycle Automation Daemon active (checking every ${intervalMs / 1000}s)`);
}

module.exports = {
  parseShiftWindow,
  evaluateShiftLifecycles,
  startShiftLifecycleDaemon
};
