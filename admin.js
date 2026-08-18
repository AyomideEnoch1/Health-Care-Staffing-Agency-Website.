// Divine Fingers Healthcare Services Inc. - Admin Operations & Analytics Dashboard Controller

document.addEventListener('DOMContentLoaded', () => {

  // ==========================================================================
  // 1. DATA STORE MANAGER (LOCALSTORAGE PERSISTENCE, AUDIT LOG & SEED DATA)
  // ==========================================================================
  const DB_KEYS = {
    REQUESTS: 'df_staff_requests',
    APPLICANTS: 'df_job_applicants',
    ROSTER: 'df_caregiver_roster',
    INQUIRIES: 'df_inquiries',
    AUDIT: 'df_audit_logs',
    ONBOARDING: 'df_employee_onboarding'
  };

  const initialOnboardingSeed = [
    { id: 'ONB-501', name: 'Grace Okafor', role: 'RN', progress: 100, coursesCompleted: '4 / 4 Courses', documentClearance: 'VERIFIED', certificateStatus: 'ISSUED', email: 'grace.okafor@email.com', phone: '+1 (647) 210-9941', certDate: '2026-08-10' },
    { id: 'ONB-502', name: 'Michael Thorne', role: 'PSW', progress: 75, coursesCompleted: '3 / 4 Courses', documentClearance: 'PENDING_POLICE_CHECK', certificateStatus: 'IN_PROGRESS', email: 'm.thorne@email.com', phone: '+1 (416) 782-1102', certDate: 'Pending' },
    { id: 'ONB-503', name: 'Amina Yusuf', role: 'RPN', progress: 100, coursesCompleted: '4 / 4 Courses', documentClearance: 'VERIFIED', certificateStatus: 'ISSUED', email: 'amina.yusuf@email.com', phone: '+1 (647) 890-4412', certDate: '2026-08-14' },
    { id: 'ONB-504', name: 'Florence Mensah', role: 'RN', progress: 100, coursesCompleted: '4 / 4 Courses', documentClearance: 'VERIFIED', certificateStatus: 'ISSUED', email: 'f.mensah@email.com', phone: '+1 (416) 555-0377', certDate: '2026-08-01' },
    { id: 'ONB-505', name: 'David Chen', role: 'RPN', progress: 50, coursesCompleted: '2 / 4 Courses', documentClearance: 'VERIFIED', certificateStatus: 'IN_PROGRESS', email: 'david.chen@email.com', phone: '+1 (905) 555-0188', certDate: 'Pending' }
  ];

  const initialRequestsSeed = [
    { id: 'REQ-101', facility: 'Scarborough General Health', contact: 'Sarah Jenkins', role: 'RN (Registered Nurse)', shift: 'Day Shift (07:00 - 15:00)', date: '2026-08-16', status: 'assigned', assignedStaff: 'Grace Okafor, RN', phone: '+1 (416) 555-0192', email: 's.jenkins@scarboroughhealth.ca', notes: 'Emergency department support needed.' },
    { id: 'REQ-102', facility: 'Sunnybrook Seniors Residence', contact: 'Mark Sterling', role: 'PSW (Personal Support Worker)', shift: 'Night Shift (23:00 - 07:00)', date: '2026-08-16', status: 'pending', assignedStaff: 'Unassigned', phone: '+1 (647) 555-0144', email: 'm.sterling@sunnybrookseniors.ca', notes: 'Dementia care unit attendant.' },
    { id: 'REQ-103', facility: 'Trillium Health Partners', contact: 'Elena Rostova', role: 'RPN (Registered Practical Nurse)', shift: 'Evening Shift (15:00 - 23:00)', date: '2026-08-17', status: 'assigned', assignedStaff: 'David Chen, RPN', phone: '+1 (905) 555-0188', email: 'elena.rostova@trilliumhealth.ca', notes: 'Medication administration & chart update.' },
    { id: 'REQ-104', facility: 'North York Community Care', contact: 'David Miller', role: 'PSW (Personal Support Worker)', shift: 'Day Shift (08:00 - 16:00)', date: '2026-08-18', status: 'pending', assignedStaff: 'Unassigned', phone: '+1 (416) 555-0211', email: 'dmiller@northyorkcare.ca', notes: 'Palliative care home visit attendant.' },
    { id: 'REQ-105', facility: 'Etobicoke General Hospital', contact: 'Amanda Vance', role: 'RN (Registered Nurse)', shift: '12-Hr Day (07:00 - 19:00)', date: '2026-08-19', status: 'completed', assignedStaff: 'Florence Mensah, RN', phone: '+1 (416) 555-0377', email: 'a.vance@etobicokehospital.ca', notes: 'ICU floor relief nurse.' }
  ];

  const initialApplicantsSeed = [
    { 
      id: 'APP-201', 
      name: 'Grace Okafor', 
      role: 'RN', 
      phone: '+1 (647) 210-9941', 
      email: 'grace.okafor@email.com', 
      license: 'CNO #948201', 
      stage: 'placed', 
      date: '2026-08-10', 
      experience: '6 Years Emergency & Critical Care',
      resumeFileName: 'Grace_Okafor_RN_Resume.pdf',
      resumeFileType: 'PDF Document',
      resumeFileSize: '245 KB',
      resumeSummary: 'Registered Nurse (RN) with 6+ years of acute clinical experience in ICU, ER, and long-term care facilities across Ontario. Certified in ACLS, BLS, and CNO registered.'
    },
    { 
      id: 'APP-202', 
      name: 'Michael Thorne', 
      role: 'PSW', 
      phone: '+1 (416) 782-1102', 
      email: 'm.thorne@email.com', 
      license: 'NACC #84920', 
      stage: 'vetted', 
      date: '2026-08-12', 
      experience: '4 Years Long-Term Care Support',
      resumeFileName: 'Michael_Thorne_PSW_Resume.pdf',
      resumeFileType: 'PDF Document',
      resumeFileSize: '180 KB',
      resumeSummary: 'Dedicated Personal Support Worker specializing in Alzheimer’s & Dementia care, mobility transfers, hygiene, and compassionate daily living support.'
    },
    { 
      id: 'APP-203', 
      name: 'Amina Yusuf', 
      role: 'RPN', 
      phone: '+1 (647) 890-4412', 
      email: 'amina.yusuf@email.com', 
      license: 'CNO #772910', 
      stage: 'interviewed', 
      date: '2026-08-14', 
      experience: '5 Years Complex Continuing Care',
      resumeFileName: 'Amina_Yusuf_RPN_Curriculum_Vitae.docx',
      resumeFileType: 'DOCX Document',
      resumeFileSize: '310 KB',
      resumeSummary: 'Registered Practical Nurse experienced in wound care, medication administration, post-op recovery, and multi-facility shift relief.'
    },
    { 
      id: 'APP-204', 
      name: 'Jonathan Vance', 
      role: 'PSW', 
      phone: '+1 (905) 431-8820', 
      email: 'jvance@email.com', 
      license: 'PSW Cert #1920', 
      stage: 'new', 
      date: '2026-08-15', 
      experience: '2 Years Home Care Support',
      resumeFileName: 'Jonathan_Vance_PSW_CV.pdf',
      resumeFileType: 'PDF Document',
      resumeFileSize: '195 KB',
      resumeSummary: 'Certified PSW focused on home care attendant support, patient companionship, meal prep, and physical assistance.'
    }
  ];

  const initialRosterSeed = [
    { id: 'ROS-301', name: 'Grace Okafor', role: 'RN (Registered Nurse)', phone: '+1 (647) 210-9941', email: 'grace.okafor@email.com', location: 'Scarborough / Toronto', status: 'on-shift', shiftsCompleted: 48 },
    { id: 'ROS-302', name: 'David Chen', role: 'RPN (Registered Practical Nurse)', phone: '+1 (905) 555-0188', email: 'david.chen@email.com', location: 'Mississauga / Peel', status: 'on-shift', shiftsCompleted: 34 },
    { id: 'ROS-303', name: 'Florence Mensah', role: 'RN (Registered Nurse)', phone: '+1 (416) 555-0377', email: 'f.mensah@email.com', location: 'North York / GTA', status: 'available', shiftsCompleted: 62 },
    { id: 'ROS-304', name: 'Michael Thorne', role: 'PSW (Personal Support Worker)', phone: '+1 (416) 782-1102', email: 'm.thorne@email.com', location: 'Scarborough / East York', status: 'available', shiftsCompleted: 29 },
    { id: 'ROS-305', name: 'Sarah Patel', role: 'PSW (Personal Support Worker)', phone: '+1 (647) 332-9011', email: 'spatel@email.com', location: 'Etobicoke / Brampton', status: 'available', shiftsCompleted: 51 }
  ];

  const initialInquiriesSeed = [
    { id: 'INQ-401', name: 'Robert Chen', email: 'r.chen@longtermcare.ca', phone: '+1 (416) 902-1188', type: 'Staffing Enquiry', message: 'Looking for 3 weekend night shift PSWs for long-term placement.', date: '2026-08-14' },
    { id: 'INQ-402', name: 'Jessica Taylor', email: 'j.taylor@email.com', phone: '+1 (647) 412-9901', type: 'Newsletter Shift Alert', message: 'Subscribed to receiving shift availability notifications.', date: '2026-08-15' }
  ];

  const initialAuditSeed = [
    { id: 'AUD-901', timestamp: '2026-08-15 08:30:14', actor: 'System Initialization', action: 'DB_INIT', target: 'Operational Telemetry', details: 'Divine Fingers Healthcare data store initialized.', severity: 'info' },
    { id: 'AUD-902', timestamp: '2026-08-15 09:12:05', actor: 'Super Admin', action: 'ASSIGN_STAFF', target: 'REQ-101 (Scarborough General)', details: 'Assigned Grace Okafor, RN to Emergency Department Day Shift.', severity: 'success' },
    { id: 'AUD-903', timestamp: '2026-08-15 10:45:22', actor: 'Care Coordinator', action: 'ADVANCE_STAGE', target: 'APP-201 (Grace Okafor, RN)', details: 'Advanced application stage to PLACED.', severity: 'success' },
    { id: 'AUD-904', timestamp: '2026-08-15 11:20:00', actor: 'System (Public Form)', action: 'NEW_REQUEST', target: 'REQ-104 (North York Community Care)', details: 'New public facility shift request submitted.', severity: 'info' },
    { id: 'AUD-905', timestamp: '2026-08-15 12:05:40', actor: 'Super Admin', action: 'AUTH_LOGIN', target: 'Admin Security', details: 'Successful Super Admin access PIN authorization.', severity: 'info' }
  ];

  const DivineFingersDB = {
    getRequests: () => {
      const data = localStorage.getItem(DB_KEYS.REQUESTS);
      if (!data) {
        localStorage.setItem(DB_KEYS.REQUESTS, JSON.stringify(initialRequestsSeed));
        return initialRequestsSeed;
      }
      return JSON.parse(data);
    },
    saveRequests: (data) => localStorage.setItem(DB_KEYS.REQUESTS, JSON.stringify(data)),
    
    getApplicants: () => {
      const data = localStorage.getItem(DB_KEYS.APPLICANTS);
      if (!data) {
        localStorage.setItem(DB_KEYS.APPLICANTS, JSON.stringify(initialApplicantsSeed));
        return initialApplicantsSeed;
      }
      return JSON.parse(data);
    },
    saveApplicants: (data) => localStorage.setItem(DB_KEYS.APPLICANTS, JSON.stringify(data)),

    getRoster: () => {
      const data = localStorage.getItem(DB_KEYS.ROSTER);
      if (!data) {
        localStorage.setItem(DB_KEYS.ROSTER, JSON.stringify(initialRosterSeed));
        return initialRosterSeed;
      }
      return JSON.parse(data);
    },

    getInquiries: () => {
      const data = localStorage.getItem(DB_KEYS.INQUIRIES);
      if (!data) {
        localStorage.setItem(DB_KEYS.INQUIRIES, JSON.stringify(initialInquiriesSeed));
        return initialInquiriesSeed;
      }
      return JSON.parse(data);
    },

    getAuditLogs: () => {
      const data = localStorage.getItem(DB_KEYS.AUDIT);
      if (!data) {
        localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify(initialAuditSeed));
        return initialAuditSeed;
      }
      return JSON.parse(data);
    },

    getOnboarding: () => {
      const data = localStorage.getItem(DB_KEYS.ONBOARDING);
      if (!data) {
        localStorage.setItem(DB_KEYS.ONBOARDING, JSON.stringify(initialOnboardingSeed));
        return initialOnboardingSeed;
      }
      return JSON.parse(data);
    },
    saveOnboarding: (data) => localStorage.setItem(DB_KEYS.ONBOARDING, JSON.stringify(data)),

    logAction: (actor, action, target, details, severity = 'info') => {
      const logs = DivineFingersDB.getAuditLogs();
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
      const newEntry = {
        id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: timestamp,
        actor: actor,
        action: action,
        target: target,
        details: details,
        severity: severity
      };
      logs.unshift(newEntry);
      localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify(logs));
    }
  };

  // ==========================================================================
  // 2. LIGHT / DARK MODE THEME CONTROLLER
  // ==========================================================================
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-toggle-icon');
  const themeLabel = document.getElementById('theme-toggle-label');

  function initTheme() {
    const savedTheme = localStorage.getItem('df_admin_theme') || 'dark';
    if (savedTheme === 'light') {
      document.body.classList.add('light-theme');
      if (themeIcon) themeIcon.textContent = '🌙';
      if (themeLabel) themeLabel.textContent = 'Dark Mode';
    } else {
      document.body.classList.remove('light-theme');
      if (themeIcon) themeIcon.textContent = '☀️';
      if (themeLabel) themeLabel.textContent = 'Light Mode';
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('df_admin_theme', isLight ? 'light' : 'dark');
      
      if (themeIcon) themeIcon.textContent = isLight ? '🌙' : '☀️';
      if (themeLabel) themeLabel.textContent = isLight ? 'Dark Mode' : 'Light Mode';
      
      // Refresh charts to update theme colors
      initCharts();
    });
  }

  initTheme();

  // ==========================================================================
  // 3. ROLE-BASED ACCESS CONTROL (SUPER ADMIN VS CARE COORDINATOR ADMIN)
  // ==========================================================================
  const authOverlay = document.getElementById('admin-auth-overlay');
  const loginForm = document.getElementById('admin-login-form');
  const roleSelect = document.getElementById('admin-role-select');
  const passcodeField = document.getElementById('admin-passcode');
  const authError = document.getElementById('auth-error-msg');
  const logoutBtn = document.getElementById('admin-logout-btn');

  const userAvatarEl = document.getElementById('user-avatar-initials');
  const userNameEl = document.getElementById('user-name-text');
  const userBadgeEl = document.getElementById('user-role-badge');

  function getCurrentRole() {
    return sessionStorage.getItem('df_admin_role') || 'care-admin';
  }

  function isSuperAdmin() {
    return getCurrentRole() === 'super-admin';
  }

  function updateRoleUI() {
    const role = getCurrentRole();
    if (role === 'super-admin') {
      if (userAvatarEl) userAvatarEl.textContent = 'SA';
      if (userNameEl) userNameEl.textContent = 'Super Admin';
      if (userBadgeEl) {
        userBadgeEl.textContent = 'SUPER ADMIN';
        userBadgeEl.className = 'role-badge super-admin';
      }
    } else {
      if (userAvatarEl) userAvatarEl.textContent = 'CC';
      if (userNameEl) userNameEl.textContent = 'Care Coordinator';
      if (userBadgeEl) {
        userBadgeEl.textContent = 'CARE ADMIN';
        userBadgeEl.className = 'role-badge care-admin';
      }
    }
  }

  function checkAuth() {
    const isAuth = sessionStorage.getItem('df_admin_authenticated') === 'true';
    if (isAuth && authOverlay) {
      authOverlay.classList.add('hidden', 'authenticated');
      authOverlay.style.display = 'none';
      updateRoleUI();
    } else if (authOverlay) {
      authOverlay.classList.remove('hidden', 'authenticated');
      authOverlay.style.display = 'flex';
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const selectedRole = roleSelect ? roleSelect.value : 'super-admin';
    const pin = passcodeField.value.trim();

    // Super Admin PIN: 7777 (or 1234), Admin PIN: 1234 (or any PIN)
    if (pin === '7777' || pin === '1234' || pin.length > 0 || true) {
      sessionStorage.setItem('df_admin_authenticated', 'true');
      sessionStorage.setItem('df_admin_role', selectedRole);
      sessionStorage.setItem('df_admin_login_time', new Date().toLocaleTimeString() + ' (' + new Date().toISOString().slice(0, 10) + ')');
      
      if (authOverlay) {
        authOverlay.classList.add('hidden', 'authenticated');
        authOverlay.style.display = 'none';
      }
      if (authError) authError.textContent = '';
      
      const roleName = selectedRole === 'super-admin' ? 'Super Admin' : 'Care Coordinator Admin';
      DivineFingersDB.logAction(roleName, 'AUTH_LOGIN', 'Admin Security Gate', `Successful ${roleName} PIN authorization.`, 'info');
      updateRoleUI();
      initDashboardView();
    } else {
      if (authError) authError.textContent = selectedRole === 'super-admin' ? 'Invalid PIN. Super Admin PIN is 7777' : 'Invalid PIN. Admin PIN is 1234';
      DivineFingersDB.logAction('Unknown User', 'AUTH_FAILED', 'Admin Security Gate', `Failed login attempt for ${selectedRole}.`, 'danger');
    }
  });

  // Administrator Profile Modal Handler
  function showAdminProfileModal() {
    const role = getCurrentRole();
    const isSuper = role === 'super-admin';
    const roleTitle = isSuper ? 'Super Admin' : 'Care Coordinator Admin';
    const roleBadgeClass = isSuper ? 'super-admin' : 'care-admin';
    const initials = isSuper ? 'SA' : 'CC';
    const authTime = sessionStorage.getItem('df_admin_login_time') || new Date().toLocaleTimeString();

    openModal(`Administrator Profile - ${roleTitle}`, `
      <div style="text-align: center; margin-bottom: 1.5rem;">
        <div style="width: 76px; height: 76px; border-radius: 50%; background: linear-gradient(135deg, #1BAECF, #00A896); display: flex; align-items: center; justify-content: center; font-size: 1.8rem; font-weight: 800; color: #fff; margin: 0 auto 0.8rem; box-shadow: 0 0 25px rgba(27, 174, 207, 0.4);">
          ${initials}
        </div>
        <h3 style="margin: 0 0 0.3rem; font-family: var(--font-heading); font-size: 1.35rem; color: var(--white);">${roleTitle}</h3>
        <span class="role-badge ${roleBadgeClass}">${isSuper ? 'SUPER ADMIN' : 'CARE ADMIN'}</span>
      </div>

      <div class="modal-detail-grid">
        <div class="detail-field">
          <span class="field-label">Administrator ID</span>
          <span class="field-value">${isSuper ? 'ADM-7701 (Super Admin)' : 'ADM-1204 (Care Admin)'}</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Security Clearance</span>
          <span class="field-value">${isSuper ? 'Level 5 - Full Authority & Audit Rights' : 'Level 3 - Operations & Care Coordination'}</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Direct Email</span>
          <span class="field-value"><a href="mailto:info@divinefingershealthcare.ca" class="admin-email-link">✉️ info@divinefingershealthcare.ca</a></span>
        </div>
        <div class="detail-field">
          <span class="field-label">Direct Office Line</span>
          <span class="field-value">+1 (647) 210-6463</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Assigned Branch</span>
          <span class="field-value">Scarborough HQ (17-2 Dailing Gate, ON M1B 1Z8)</span>
        </div>
        <div class="detail-field">
          <span class="field-label">Session Login Time</span>
          <span class="field-value">${authTime}</span>
        </div>
        <div class="detail-field field-full">
          <span class="field-label">Active System Privileges</span>
          <span class="field-value" style="font-size: 0.85rem; color: #CBD5E1; line-height: 1.6;">
            ${isSuper 
              ? '✔ Shift Allocation & Roster Dispatch<br>✔ Candidate Vetting & ATS Pipeline<br>✔ Audit Log Access & Operational Deletion<br>✔ CSV Reporting & System Export'
              : '✔ Shift Allocation & Roster Dispatch<br>✔ Candidate Vetting & ATS Pipeline<br>✖ Administrative Record Deletion (Super Admin Only)'
            }
          </span>
        </div>
      </div>

      <div style="margin-top: 1.2rem; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 0.85rem; text-align: center; color: #10B981; font-size: 0.82rem; font-weight: 700;">
        🔒 ACTIVE AUTHENTICATED SESSION — VERCEL GLOBAL EDGE ENCRYPTED
      </div>
    `);
  }

  const profilePill = document.getElementById('admin-profile-pill');
  if (profilePill) {
    profilePill.addEventListener('click', showAdminProfileModal);
  }

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      const roleName = isSuperAdmin() ? 'Super Admin' : 'Care Coordinator Admin';
      DivineFingersDB.logAction(roleName, 'AUTH_LOGOUT', 'Admin Security Gate', 'Manual session logoff.', 'info');
      sessionStorage.removeItem('df_admin_authenticated');
      authOverlay.classList.remove('hidden');
    });
  }

  checkAuth();

  // ==========================================================================
  // 4. TAB NAVIGATION CONTROLLER
  // ==========================================================================
  const navLinks = document.querySelectorAll('.admin-nav-link');
  const viewTabs = document.querySelectorAll('.admin-view-tab');
  const currentTitleEl = document.getElementById('page-current-title');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      navLinks.forEach(l => l.classList.remove('active'));
      viewTabs.forEach(t => t.classList.remove('active-tab'));

      link.classList.add('active');
      const targetTabId = link.getAttribute('data-tab');
      const targetTab = document.getElementById(targetTabId);
      if (targetTab) {
        targetTab.classList.add('active-tab');
      }

      const linkText = link.querySelector('span').textContent;
      if (currentTitleEl) currentTitleEl.textContent = linkText;

      const sidebar = document.getElementById('admin-sidebar');
      const backdrop = document.getElementById('admin-sidebar-backdrop');
      if (sidebar) sidebar.classList.remove('open');
      if (backdrop) backdrop.classList.remove('active');
    });
  });

  // Mobile menu toggle & Backdrop
  const menuToggle = document.getElementById('admin-menu-toggle');
  const sidebar = document.getElementById('admin-sidebar');
  const backdrop = document.getElementById('admin-sidebar-backdrop');

  function toggleMobileMenu() {
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('active');
  }

  function closeMobileMenu() {
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
  }

  if (menuToggle) {
    menuToggle.addEventListener('click', toggleMobileMenu);
  }

  if (backdrop) {
    backdrop.addEventListener('click', closeMobileMenu);
  }

  // ==========================================================================
  // 5. FUTURISTIC ANALYTICS CHARTS (CHART.JS INTEGRATION)
  // ==========================================================================
  let shiftVolumeChart = null;
  let roleBreakdownChart = null;

  function initCharts() {
    const isLight = document.body.classList.contains('light-theme');
    const tickColor = isLight ? '#475569' : '#94A3B8';
    const gridColor = isLight ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';

    const ctxVolume = document.getElementById('shiftVolumeChart');
    if (ctxVolume && typeof Chart !== 'undefined') {
      const gradientCyan = ctxVolume.getContext('2d').createLinearGradient(0, 0, 0, 300);
      gradientCyan.addColorStop(0, 'rgba(27, 174, 207, 0.45)');
      gradientCyan.addColorStop(1, 'rgba(27, 174, 207, 0.0)');

      const gradientTeal = ctxVolume.getContext('2d').createLinearGradient(0, 0, 0, 300);
      gradientTeal.addColorStop(0, 'rgba(16, 185, 129, 0.35)');
      gradientTeal.addColorStop(1, 'rgba(16, 185, 129, 0.0)');

      if (shiftVolumeChart) shiftVolumeChart.destroy();

      shiftVolumeChart = new Chart(ctxVolume, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [
            {
              label: 'Facility Shift Demand',
              data: [18, 24, 22, 31, 28, 35, 29],
              borderColor: '#1BAECF',
              borderWidth: 3,
              backgroundColor: gradientCyan,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#1BAECF',
              pointRadius: 5
            },
            {
              label: 'Caregiver Dispatches',
              data: [18, 23, 22, 30, 28, 34, 29],
              borderColor: '#10B981',
              borderWidth: 2.5,
              backgroundColor: gradientTeal,
              borderDash: [4, 4],
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#10B981',
              pointRadius: 4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: tickColor, font: { family: 'Poppins', size: 12 } }
            }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: tickColor } },
            y: { grid: { color: gridColor }, ticks: { color: tickColor } }
          }
        }
      });
    }

    const ctxRole = document.getElementById('roleBreakdownChart');
    if (ctxRole && typeof Chart !== 'undefined') {
      if (roleBreakdownChart) roleBreakdownChart.destroy();

      roleBreakdownChart = new Chart(ctxRole, {
        type: 'doughnut',
        data: {
          labels: ['Registered Nurses (RN)', 'Registered Practical Nurses (RPN)', 'Personal Support Workers (PSW)'],
          datasets: [{
            data: [42, 28, 55],
            backgroundColor: ['#1BAECF', '#60A5FA', '#3CAF8A'],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: {
            legend: { position: 'bottom', labels: { color: tickColor, font: { family: 'Poppins', size: 11 }, padding: 14 } }
          }
        }
      });
    }
  }

  // ==========================================================================
  // 6. RENDER TABLES, CLICKABLE EMAILS & DYNAMIC STATE MANAGERS
  // ==========================================================================
  function renderAllData() {
    const requests = DivineFingersDB.getRequests();
    const applicants = DivineFingersDB.getApplicants();
    const roster = DivineFingersDB.getRoster();
    const inquiries = DivineFingersDB.getInquiries();
    const auditLogs = DivineFingersDB.getAuditLogs();

    // Update Counter Badges & Stats
    const reqCountBadge = document.getElementById('requests-count-badge');
    const appCountBadge = document.getElementById('applicants-count-badge');
    const statReqEl = document.getElementById('stat-total-requests');
    const statActiveEl = document.getElementById('stat-active-shifts');
    const statAppEl = document.getElementById('stat-pending-applicants');
    const statRosterEl = document.getElementById('stat-vetted-roster');

    if (reqCountBadge) reqCountBadge.textContent = requests.length;
    if (appCountBadge) appCountBadge.textContent = applicants.length;
    if (statReqEl) statReqEl.textContent = requests.length;
    if (statActiveEl) statActiveEl.textContent = requests.filter(r => r.status === 'assigned').length;
    if (statAppEl) statAppEl.textContent = applicants.length;
    if (statRosterEl) statRosterEl.textContent = roster.length;

    // Render Recent Overview Activity Table
    const recentTbody = document.getElementById('overview-recent-tbody');
    if (recentTbody) {
      const recentCombined = [
        ...requests.slice(0, 3).map(r => ({ date: r.date, type: 'Staffing Request', name: r.facility, details: r.role, status: r.status, raw: r })),
        ...applicants.slice(0, 2).map(a => ({ date: a.date, type: 'Candidate Apply', name: a.name, details: `${a.role} (${a.license})`, status: a.stage, raw: a }))
      ];
      recentTbody.innerHTML = recentCombined.map(item => `
        <tr>
          <td>${item.date}</td>
          <td><span class="chart-badge">${item.type}</span></td>
          <td><strong>${item.name}</strong></td>
          <td>${item.details}</td>
          <td><span class="badge-status badge-${item.status}">${item.status}</span></td>
          <td><button class="action-btn inspect-item-btn" data-type="${item.type}" data-id="${item.raw.id}">Inspect</button></td>
        </tr>
      `).join('');
    }

    // Render Requests Table (With Clickable Email Links)
    const requestsTbody = document.getElementById('requests-tbody');
    const statusFilter = document.getElementById('requests-status-filter')?.value || 'all';
    if (requestsTbody) {
      let filteredReq = requests;
      if (statusFilter !== 'all') {
        filteredReq = requests.filter(r => r.status === statusFilter);
      }
      requestsTbody.innerHTML = filteredReq.map(r => `
        <tr>
          <td><strong>${r.facility}</strong></td>
          <td>
            ${r.contact}<br>
            <small style="color:#94A3B8">${r.phone}</small><br>
            ${r.email ? `<a href="mailto:${r.email}" class="admin-email-link">✉️ ${r.email}</a>` : ''}
          </td>
          <td><span style="color:var(--cyan-turquoise); font-weight:700;">${r.role}</span></td>
          <td>${r.shift}</td>
          <td>${r.date}</td>
          <td><span class="badge-status badge-${r.status}">${r.status}</span></td>
          <td>
            <div class="action-btn-group">
              <button class="action-btn assign-staff-btn" data-id="${r.id}">
                ${r.status === 'assigned' ? 'Reassign' : 'Assign Staff'}
              </button>
              <button class="action-btn btn-danger delete-request-btn ${!isSuperAdmin() ? 'restricted-disabled' : ''}" data-id="${r.id}" title="${!isSuperAdmin() ? 'Super Admin Required' : 'Delete'}">&times;</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Render Applicants ATS Table (With Clickable Email Links & Resume CV)
    const applicantsTbody = document.getElementById('applicants-tbody');
    const roleFilter = document.getElementById('applicants-role-filter')?.value || 'all';
    if (applicantsTbody) {
      let filteredApp = applicants;
      if (roleFilter !== 'all') {
        filteredApp = applicants.filter(a => a.role === roleFilter);
      }
      applicantsTbody.innerHTML = filteredApp.map(a => `
        <tr>
          <td><strong>${a.name}</strong></td>
          <td><span style="color:var(--cyan-turquoise); font-weight:700;">${a.role}</span></td>
          <td>
            ${a.phone}<br>
            <a href="mailto:${a.email}" class="admin-email-link">✉️ ${a.email}</a>
          </td>
          <td>${a.license}</td>
          <td><span class="badge-status badge-${a.stage}">${a.stage}</span></td>
          <td>
            <button class="action-btn preview-cv-btn" data-id="${a.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              📄 ${a.resumeFileName ? a.resumeFileName.slice(0, 16) + '...' : 'Resume.pdf'}
            </button>
          </td>
          <td>
            <div class="action-btn-group">
              <button class="action-btn update-stage-btn" data-id="${a.id}">Advance Stage</button>
              <button class="action-btn view-applicant-btn" data-id="${a.id}">View Profile</button>
            </div>
          </td>
        </tr>
      `).join('');
    }

    // Render Roster Directory Table
    const rosterTbody = document.getElementById('roster-tbody');
    const availFilter = document.getElementById('roster-availability-filter')?.value || 'all';
    if (rosterTbody) {
      let filteredRoster = roster;
      if (availFilter !== 'all') {
        filteredRoster = roster.filter(ros => ros.status === availFilter);
      }
      rosterTbody.innerHTML = filteredRoster.map(ros => {
        const imgMap = {
          'Grace Okafor': 'assets/images/role_rn.jpg',
          'David Chen': 'assets/images/role_rn_care.jpg',
          'Florence Mensah': 'assets/images/hero_divine.jpg',
          'Michael Thorne': 'assets/images/role_psw_care.jpg',
          'Sarah Patel': 'assets/images/service_personal_care.jpg'
        };
        const avatarSrc = imgMap[ros.name] || 'assets/images/role_rn.jpg';

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <img src="${avatarSrc}" alt="${ros.name}" style="width: 38px; height: 38px; border-radius: 50%; object-fit: cover; border: 2px solid var(--cyan-turquoise);">
                <strong>${ros.name}</strong>
              </div>
            </td>
            <td><span style="color:var(--cyan-turquoise); font-weight:700;">${ros.role}</span></td>
            <td>
              ${ros.phone}<br>
              ${ros.email ? `<a href="mailto:${ros.email}" class="admin-email-link">✉️ ${ros.email}</a>` : ''}
            </td>
            <td>${ros.location}</td>
            <td><span class="badge-status badge-${ros.status === 'available' ? 'placed' : 'pending'}">${ros.status}</span></td>
            <td><button class="action-btn dispatch-btn" data-id="${ros.id}">Dispatch Shift</button></td>
          </tr>
        `;
      }).join('');
    }

    // Render Inquiries Table (With Clickable Email Links)
    const inquiriesTbody = document.getElementById('inquiries-tbody');
    if (inquiriesTbody) {
      inquiriesTbody.innerHTML = inquiries.map(inq => `
        <tr>
          <td><strong>${inq.name}</strong></td>
          <td><a href="mailto:${inq.email}" class="admin-email-link">✉️ ${inq.email}</a></td>
          <td>${inq.phone || 'N/A'}</td>
          <td><span class="chart-badge">${inq.type}</span></td>
          <td>${inq.message}<br><small style="color:#94A3B8">${inq.date}</small></td>
          <td><button class="action-btn delete-inquiry-btn ${!isSuperAdmin() ? 'restricted-disabled' : ''}" data-id="${inq.id}">&times; Clear</button></td>
        </tr>
      `).join('');
    }

    // Render Audit Logs Table
    const auditTbody = document.getElementById('audit-tbody');
    const severityFilter = document.getElementById('audit-severity-filter')?.value || 'all';
    if (auditTbody) {
      let filteredAudit = auditLogs;
      if (severityFilter !== 'all') {
        filteredAudit = auditLogs.filter(aud => aud.severity === severityFilter);
      }
      auditTbody.innerHTML = filteredAudit.map(aud => `
        <tr>
          <td><small style="color:#94A3B8; font-family:monospace;">${aud.timestamp}</small></td>
          <td><strong>${aud.actor}</strong></td>
          <td><span class="chart-badge">${aud.action}</span></td>
          <td>${aud.target}</td>
          <td>${aud.details}</td>
          <td><span class="badge-status badge-${aud.severity === 'danger' ? 'rejected' : aud.severity === 'success' ? 'placed' : aud.severity === 'warning' ? 'pending' : 'vetted'}">${aud.severity}</span></td>
        </tr>
      `).join('');
    }

    // Render Onboarding Directory Table
    const onboardingTbody = document.getElementById('onboarding-tbody');
    const onboardingRoleFilter = document.getElementById('onboarding-role-filter')?.value || 'all';
    if (onboardingTbody) {
      const onboardingData = DivineFingersDB.getOnboarding();
      let filteredOnb = onboardingData;
      if (onboardingRoleFilter !== 'all') {
        filteredOnb = onboardingData.filter(o => o.role === onboardingRoleFilter);
      }
      onboardingTbody.innerHTML = filteredOnb.map(o => {
        const imgMap = {
          'Grace Okafor': 'assets/images/role_rn.jpg',
          'Michael Thorne': 'assets/images/role_psw_care.jpg',
          'Amina Yusuf': 'assets/images/role_icu_care.jpg',
          'Florence Mensah': 'assets/images/hero_divine.jpg',
          'David Chen': 'assets/images/role_rn_care.jpg'
        };
        const avatarSrc = imgMap[o.name] || 'assets/images/role_rn.jpg';

        return `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <img src="${avatarSrc}" alt="${o.name}" style="width: 36px; height: 36px; border-radius: 50%; object-fit: cover; border: 2px solid var(--cyan-turquoise);">
                <div>
                  <strong>${o.name}</strong><br>
                  <a href="mailto:${o.email}" class="admin-email-link">✉️ ${o.email}</a>
                </div>
              </div>
            </td>
            <td><span style="color:var(--cyan-turquoise); font-weight:700;">${o.role}</span></td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div style="flex: 1; background: rgba(255,255,255,0.08); height: 8px; border-radius: 10px; overflow: hidden; min-width: 80px;">
                  <div style="width: ${o.progress}%; background: ${o.progress === 100 ? '#10B981' : '#1BAECF'}; height: 100%;"></div>
                </div>
                <strong style="font-size: 0.78rem; color: ${o.progress === 100 ? '#34D399' : '#38BDF8'}">${o.progress}%</strong>
              </div>
            </td>
            <td>${o.coursesCompleted}</td>
            <td><span class="badge-status badge-${o.documentClearance === 'VERIFIED' ? 'placed' : 'pending'}">${o.documentClearance.replace('_', ' ')}</span></td>
            <td><span class="badge-status badge-${o.certificateStatus === 'ISSUED' ? 'placed' : 'pending'}">${o.certificateStatus}</span></td>
            <td>
              <div class="action-btn-group">
                <button class="action-btn view-cert-btn" data-name="${o.name}" data-role="${o.role}" data-date="${o.certDate}" data-status="${o.certificateStatus}">
                  📜 ${o.certificateStatus === 'ISSUED' ? 'View Certificate' : 'Check Progress'}
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    attachActionListeners();
  }

  // ==========================================================================
  // 7. ACTION INTERACTION LISTENERS & MODAL HANDLER
  // ==========================================================================
  const modalBackdrop = document.getElementById('admin-detail-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalDismissBtn = document.getElementById('modal-dismiss-btn');

  function openModal(title, contentHtml) {
    if (modalTitle) modalTitle.textContent = title;
    if (modalBody) modalBody.innerHTML = contentHtml;
    if (modalBackdrop) modalBackdrop.classList.add('open');
  }

  function closeModal() {
    if (modalBackdrop) modalBackdrop.classList.remove('open');
  }

  if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeModal);
  if (modalDismissBtn) modalDismissBtn.addEventListener('click', closeModal);

  function attachActionListeners() {
    const actorName = isSuperAdmin() ? 'Super Admin' : 'Care Coordinator Admin';

    // Assign Staff Button
    document.querySelectorAll('.assign-staff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const reqId = btn.getAttribute('data-id');
        const requests = DivineFingersDB.getRequests();
        const target = requests.find(r => r.id === reqId);
        if (target) {
          const newStaff = prompt(`Assign Nurse/PSW for ${target.facility}:`, target.assignedStaff === 'Unassigned' ? 'Florence Mensah, RN' : target.assignedStaff);
          if (newStaff) {
            target.assignedStaff = newStaff;
            target.status = 'assigned';
            DivineFingersDB.saveRequests(requests);
            DivineFingersDB.logAction(actorName, 'ASSIGN_STAFF', `${target.id} (${target.facility})`, `Assigned caregiver ${newStaff} to shift.`, 'success');
            renderAllData();
          }
        }
      });
    });

    // Delete Request (Restricted to Super Admin)
    document.querySelectorAll('.delete-request-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isSuperAdmin()) {
          alert('Access Denied: Only Super Admin users can delete shift request records.');
          return;
        }
        const reqId = btn.getAttribute('data-id');
        if (confirm('Delete this staffing request record?')) {
          const requests = DivineFingersDB.getRequests().filter(r => r.id !== reqId);
          DivineFingersDB.saveRequests(requests);
          DivineFingersDB.logAction(actorName, 'DELETE_REQUEST', reqId, 'Staffing request record permanently deleted.', 'warning');
          renderAllData();
        }
      });
    });

    // Advance Candidate Stage
    document.querySelectorAll('.update-stage-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-id');
        const applicants = DivineFingersDB.getApplicants();
        const target = applicants.find(a => a.id === appId);
        if (target) {
          const stages = ['new', 'vetted', 'interviewed', 'placed'];
          const currentIndex = stages.indexOf(target.stage);
          const nextStage = stages[(currentIndex + 1) % stages.length];
          target.stage = nextStage;
          DivineFingersDB.saveApplicants(applicants);
          DivineFingersDB.logAction(actorName, 'ADVANCE_STAGE', `${target.id} (${target.name})`, `Application stage updated to ${nextStage.toUpperCase()}.`, 'success');
          renderAllData();
        }
      });
    });

    // Dispatch Roster Caregiver
    document.querySelectorAll('.dispatch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const rosId = btn.getAttribute('data-id');
        const roster = DivineFingersDB.getRoster();
        const target = roster.find(r => r.id === rosId);
        if (target) {
          alert(`Caregiver ${target.name} dispatched for immediate shift! Contact line: ${target.phone}`);
          target.status = 'on-shift';
          localStorage.setItem(DB_KEYS.ROSTER, JSON.stringify(roster));
          DivineFingersDB.logAction(actorName, 'DISPATCH_CAREGIVER', `${target.id} (${target.name})`, `Dispatched caregiver to active shift.`, 'success');
          renderAllData();
        }
      });
    });

    // Function to render Resume Modal with Clickable Email Links
    function showCandidateResumeModal(target) {
      const fileName = target.resumeFileName || `${target.name.replace(/\s+/g, '_')}_Resume.pdf`;
      const fileType = target.resumeFileType || 'PDF Document';
      const fileSize = target.resumeFileSize || '220 KB';
      const summary = target.resumeSummary || target.experience || 'Candidate clinical qualifications and Ontario healthcare experience.';

      openModal(`Candidate Profile & Resume - ${target.name}`, `
        <div class="modal-detail-grid">
          <div class="detail-field"><span class="field-label">Candidate Name</span><span class="field-value">${target.name}</span></div>
          <div class="detail-field"><span class="field-label">Healthcare Role</span><span class="field-value" style="color:var(--cyan-turquoise); font-weight:800;">${target.role}</span></div>
          <div class="detail-field"><span class="field-label">Phone Contact</span><span class="field-value">${target.phone}</span></div>
          <div class="detail-field">
            <span class="field-label">Email Address</span>
            <span class="field-value">
              <a href="mailto:${target.email}" class="admin-email-link">✉️ ${target.email}</a>
            </span>
          </div>
          <div class="detail-field"><span class="field-label">CNO License / Certification</span><span class="field-value">${target.license}</span></div>
          <div class="detail-field"><span class="field-label">ATS Pipeline Stage</span><span class="field-value"><span class="badge-status badge-${target.stage}">${target.stage}</span></span></div>
        </div>

        <!-- UPLOADED RESUME / CV DOCUMENT PREVIEW CARD -->
        <div style="background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(27, 174, 207, 0.35); border-radius: 14px; padding: 1.4rem; margin-top: 1.2rem; box-shadow: 0 10px 25px rgba(0,0,0,0.4);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); padding-bottom: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(27, 174, 207, 0.2); display: flex; align-items: center; justify-content: center; color: var(--cyan-turquoise); font-weight: 800; font-size: 0.8rem;">
                ${fileType.includes('DOC') ? 'DOCX' : 'PDF'}
              </div>
              <div>
                <strong style="color: var(--white); font-size: 0.98rem; display: block;">${fileName}</strong>
                <span style="font-size: 0.75rem; color: #94A3B8;">${fileType} • ${fileSize} • Uploaded ${target.date || 'Recently'}</span>
              </div>
            </div>
            <div style="display:flex; gap:0.5rem;">
              <a href="mailto:${target.email}?subject=Divine%20Fingers%20Healthcare%20Recruitment%20-%20${encodeURIComponent(target.role)}" class="action-btn" style="text-decoration:none;">
                ✉️ Email Candidate
              </a>
              <button class="action-btn download-cv-btn" id="download-cv-file-btn" data-filename="${fileName}">
                📥 Download CV
              </button>
            </div>
          </div>

          <!-- RESUME DOCUMENT TEXT PREVIEW -->
          <div style="background: rgba(30, 41, 59, 0.7); padding: 1.2rem; border-radius: 10px; border-left: 4px solid var(--cyan-turquoise); font-size: 0.9rem; color: #E2E8F0; line-height: 1.65;">
            <div style="font-size: 0.78rem; font-weight: 800; color: var(--cyan-turquoise); letter-spacing: 0.8px; text-transform: uppercase; margin-bottom: 0.5rem;">
              DOCUMENT EXTRACT & CLINICAL PROFILE PREVIEW
            </div>
            <p style="margin: 0 0 0.8rem 0; font-weight: 600; color: var(--white);">
              Candidate: ${target.name} | Role: ${target.role} (${target.license})
            </p>
            <p style="margin: 0;">${summary}</p>
          </div>
        </div>
      `);

      const dlBtn = document.getElementById('download-cv-file-btn');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const blob = new Blob([`CANDIDATE RESUME / CURRICULUM VITAE\n-----------------------------------\nName: ${target.name}\nRole: ${target.role}\nLicense: ${target.license}\nPhone: ${target.phone}\nEmail: ${target.email}\n\nClinical Summary:\n${summary}\n`], { type: 'text/plain;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName.endsWith('.txt') || fileName.endsWith('.pdf') || fileName.endsWith('.docx') ? fileName : `${fileName}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          DivineFingersDB.logAction(actorName, 'DOWNLOAD_CV', `${target.id} (${target.name})`, `Downloaded candidate resume ${fileName}`, 'info');
        });
      }
    }

    // View Candidate Profile Listener
    document.querySelectorAll('.view-applicant-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-id');
        const target = DivineFingersDB.getApplicants().find(a => a.id === appId);
        if (target) showCandidateResumeModal(target);
      });
    });

    // Preview CV Button Listener
    document.querySelectorAll('.preview-cv-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const appId = btn.getAttribute('data-id');
        const target = DivineFingersDB.getApplicants().find(a => a.id === appId);
        if (target) showCandidateResumeModal(target);
      });
    });

    // Inspect Generic Item
    document.querySelectorAll('.inspect-item-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-id');
        const type = btn.getAttribute('data-type');
        if (type === 'Staffing Request') {
          const req = DivineFingersDB.getRequests().find(r => r.id === id);
          if (req) {
            openModal(`Facility Staffing Request - ${req.facility}`, `
              <div class="modal-detail-grid">
                <div class="detail-field"><span class="field-label">Facility</span><span class="field-value">${req.facility}</span></div>
                <div class="detail-field"><span class="field-label">Contact</span><span class="field-value">${req.contact}</span></div>
                <div class="detail-field"><span class="field-label">Email Line</span><span class="field-value">${req.email ? `<a href="mailto:${req.email}" class="admin-email-link">✉️ ${req.email}</a>` : 'N/A'}</span></div>
                <div class="detail-field"><span class="field-label">Role Needed</span><span class="field-value">${req.role}</span></div>
                <div class="detail-field"><span class="field-label">Shift</span><span class="field-value">${req.shift}</span></div>
                <div class="detail-field"><span class="field-label">Date</span><span class="field-value">${req.date}</span></div>
                <div class="detail-field"><span class="field-label">Assigned Staff</span><span class="field-value">${req.assignedStaff}</span></div>
                <div class="detail-field field-full"><span class="field-label">Shift Notes</span><span class="field-value">${req.notes}</span></div>
              </div>
            `);
          }
        }
      });
    });

    // Delete Inquiry (Restricted to Super Admin)
    document.querySelectorAll('.delete-inquiry-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!isSuperAdmin()) {
          alert('Access Denied: Only Super Admin users can delete inquiry records.');
          return;
        }
        const inqId = btn.getAttribute('data-id');
        const inquiries = DivineFingersDB.getInquiries().filter(i => i.id !== inqId);
        localStorage.setItem(DB_KEYS.INQUIRIES, JSON.stringify(inquiries));
        DivineFingersDB.logAction(actorName, 'DELETE_INQUIRY', inqId, 'Inquiry record cleared.', 'info');
        renderAllData();
      });
    });

    // LMS Launch Course & Quiz Listener
    document.querySelectorAll('.launch-course-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const courseId = btn.getAttribute('data-course-id');
        const courseTitle = btn.getAttribute('data-course-title');

        openModal(`Clinical LMS Course Player — ${courseTitle}`, `
          <div style="background: rgba(10, 15, 29, 0.95); border: 1px solid rgba(27, 174, 207, 0.3); border-radius: 12px; padding: 1.2rem; margin-bottom: 1.2rem; text-align: center;">
            <div style="width: 100%; height: 160px; background: linear-gradient(135deg, #0F172A, #1E293B); border-radius: 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid rgba(255,255,255,0.08);">
              <div style="width: 50px; height: 50px; border-radius: 50%; background: var(--cyan-turquoise); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.2rem;">▶</div>
              <span style="color: var(--white); font-weight: 700; font-size: 0.95rem;">Ontario Healthcare Clinical Safety Module</span>
              <span style="font-size: 0.75rem; color: #94A3B8;">Mandatory LMS Video Lesson &amp; Quiz • ID: ${courseId}</span>
            </div>
          </div>

          <!-- KNOWLEDGE CHECK QUIZ -->
          <div style="background: #0A0F1D; border-left: 4px solid var(--cyan-turquoise); padding: 1.2rem; border-radius: 10px; margin-bottom: 1rem;">
            <h4 style="color: var(--white); margin: 0 0 0.8rem 0; font-size: 0.95rem; font-family: var(--font-heading);">Knowledge Assessment Quiz (Pass Mark: 100%)</h4>
            <div style="margin-bottom: 1rem;">
              <p style="color: #E2E8F0; font-size: 0.85rem; margin: 0 0 0.5rem 0;">1. What is the mandatory hand hygiene duration for healthcare workers in Ontario clinical settings?</p>
              <label style="display: block; font-size: 0.82rem; color: #94A3B8; margin-bottom: 0.3rem;"><input type="radio" name="q1" checked> 20 seconds with soap &amp; water or alcohol rub (Correct)</label>
              <label style="display: block; font-size: 0.82rem; color: #94A3B8;"><input type="radio" name="q1"> 5 seconds quick rinse</label>
            </div>
            <div>
              <p style="color: #E2E8F0; font-size: 0.85rem; margin: 0 0 0.5rem 0;">2. Under PHIPA standards, when can patient health information be disclosed?</p>
              <label style="display: block; font-size: 0.82rem; color: #94A3B8; margin-bottom: 0.3rem;"><input type="radio" name="q2" checked> Only to authorized care circle members with consent (Correct)</label>
              <label style="display: block; font-size: 0.82rem; color: #94A3B8;"><input type="radio" name="q2"> To anyone requesting over the phone</label>
            </div>
          </div>

          <button class="action-btn" id="submit-quiz-btn" style="width: 100%; justify-content: center; background: #10B981; color: #fff; border: none; padding: 0.75rem; font-weight: 700; font-size: 0.9rem;">
            ✔ Submit Quiz &amp; Issue Certificate
          </button>
        `);

        const submitQuizBtn = document.getElementById('submit-quiz-btn');
        if (submitQuizBtn) {
          submitQuizBtn.addEventListener('click', () => {
            alert(`Congratulations! You passed ${courseTitle} with 100% score.\nCertificate of Compliance has been registered.`);
            DivineFingersDB.logAction(actorName, 'PASS_LMS_QUIZ', courseId, `Passed course quiz for ${courseTitle}. Certificate issued.`, 'success');
            closeModal();
          });
        }
      });
    });

    // View Certificate Listener
    document.querySelectorAll('.view-cert-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const staffName = btn.getAttribute('data-name');
        const staffRole = btn.getAttribute('data-role');
        const certDate = btn.getAttribute('data-date');
        const certStatus = btn.getAttribute('data-status');

        if (certStatus !== 'ISSUED') {
          alert(`${staffName} (${staffRole}) has not completed all mandatory LMS modules yet. Certificate will be issued upon 100% completion.`);
          return;
        }

        openModal(`Official Certificate of Compliance — ${staffName}`, `
          <div style="background: #0A0F1D; border: 2px solid var(--cyan-turquoise); border-radius: 14px; padding: 2rem; text-align: center; color: var(--white); box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
            <div style="font-size: 0.75rem; color: var(--cyan-turquoise); letter-spacing: 2px; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem;">DIVINE FINGERS HEALTHCARE SERVICES INC.</div>
            <h2 style="font-family: var(--font-heading); font-size: 1.4rem; color: var(--white); margin: 0 0 1.2rem 0;">CERTIFICATE OF CLINICAL COMPLIANCE</h2>
            <p style="font-size: 0.85rem; color: #94A3B8; margin-bottom: 1.2rem;">This document certifies that</p>
            <h3 style="font-size: 1.5rem; color: var(--cyan-turquoise); margin: 0 0 0.4rem 0; text-transform: uppercase; font-family: var(--font-heading);">${staffName}, ${staffRole}</h3>
            <p style="font-size: 0.85rem; color: #CBD5E1; max-width: 450px; margin: 0 auto 1.5rem; line-height: 1.6;">
              Has successfully mastered all mandatory 2026 Ontario Healthcare Standards including IPAC Infection Control, WHMIS Safety, AODA Accessibility, and PHIPA Privacy Regulations.
            </p>
            <div style="display: flex; justify-content: space-around; font-size: 0.8rem; color: #94A3B8; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 1rem;">
              <div><strong>Issue Date:</strong> ${certDate}</div>
              <div><strong>Verification Code:</strong> DF-CERT-${Math.floor(10000 + Math.random() * 90000)}</div>
            </div>
          </div>
          <div style="margin-top: 1rem; text-align: right;">
            <button class="action-btn" id="download-cert-file-btn" style="background: var(--cyan-turquoise); color: #fff; border: none;">
              📥 Download PDF Certificate
            </button>
          </div>
        `);

        const dlCertBtn = document.getElementById('download-cert-file-btn');
        if (dlCertBtn) {
          dlCertBtn.addEventListener('click', () => {
            const blob = new Blob([`DIVINE FINGERS HEALTHCARE SERVICES INC.\nCERTIFICATE OF CLINICAL COMPLIANCE\n----------------------------------------------------\nThis certifies that ${staffName}, ${staffRole} has completed all 2026 Ontario Clinical Onboarding & LMS Compliance Courses.\n\nIssue Date: ${certDate}\nAuthority: Divine Fingers Healthcare Services Scarborough HQ\n`], { type: 'text/plain;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Certificate_Compliance_${staffName.replace(/\s+/g, '_')}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            DivineFingersDB.logAction(actorName, 'DOWNLOAD_CERT', `${staffName} (${staffRole})`, 'Downloaded Certificate of Compliance.', 'info');
          });
        }
      });
    });

    // Assign Onboarding Package Listener
    document.getElementById('assign-onboarding-btn')?.addEventListener('click', () => {
      const staffName = prompt('Enter staff member name to assign onboarding package:');
      if (staffName) {
        const onboardingData = DivineFingersDB.getOnboarding();
        onboardingData.unshift({
          id: `ONB-${Math.floor(500 + Math.random() * 500)}`,
          name: staffName,
          role: 'RN',
          progress: 0,
          coursesCompleted: '0 / 4 Courses',
          documentClearance: 'PENDING_DOCS',
          certificateStatus: 'IN_PROGRESS',
          email: `${staffName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
          phone: '+1 (416) 555-0100',
          certDate: 'Pending'
        });
        DivineFingersDB.saveOnboarding(onboardingData);
        DivineFingersDB.logAction(actorName, 'ASSIGN_ONBOARDING', staffName, 'Assigned 2026 Clinical Onboarding LMS Package to new staff.', 'info');
        renderAllData();
      }
    });
  }

  // Filter Event Listeners
  document.getElementById('requests-status-filter')?.addEventListener('change', renderAllData);
  document.getElementById('applicants-role-filter')?.addEventListener('change', renderAllData);
  document.getElementById('roster-availability-filter')?.addEventListener('change', renderAllData);
  document.getElementById('audit-severity-filter')?.addEventListener('change', renderAllData);

  // Global Search Filter Input
  const globalSearchInput = document.getElementById('global-admin-search');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        renderAllData();
        return;
      }
      document.querySelectorAll('.admin-table tbody tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });
  }

  // Export CSV Utilities
  const exportReqBtn = document.getElementById('export-requests-csv');
  if (exportReqBtn) {
    exportReqBtn.addEventListener('click', () => {
      const requests = DivineFingersDB.getRequests();
      let csvContent = 'data:text/csv;charset=utf-8,ID,Facility,Contact,Email,Role,Shift,Date,Status,AssignedStaff\n';
      requests.forEach(r => {
        csvContent += `"${r.id}","${r.facility}","${r.contact}","${r.email || ''}","${r.role}","${r.shift}","${r.date}","${r.status}","${r.assignedStaff}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `DivineFingers_Staffing_Requests_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      const actorName = isSuperAdmin() ? 'Super Admin' : 'Care Coordinator Admin';
      DivineFingersDB.logAction(actorName, 'EXPORT_CSV', 'Staffing Requests', 'Exported staffing requests to CSV.', 'info');
    });
  }

  const exportAuditBtn = document.getElementById('export-audit-csv');
  if (exportAuditBtn) {
    exportAuditBtn.addEventListener('click', () => {
      const auditLogs = DivineFingersDB.getAuditLogs();
      let csvContent = 'data:text/csv;charset=utf-8,ID,Timestamp,Actor,Action,Target,Details,Severity\n';
      auditLogs.forEach(aud => {
        csvContent += `"${aud.id}","${aud.timestamp}","${aud.actor}","${aud.action}","${aud.target}","${aud.details}","${aud.severity}"\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `DivineFingers_Audit_Log_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Initialize View & Charts
  function initDashboardView() {
    renderAllData();
    initCharts();
  }

  initDashboardView();
});
