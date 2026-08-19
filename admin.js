/**
 * DIVINE FINGERS HEALTHCARE SERVICES INC.
 * Premium Futuristic Clinical Operations & Dispatch Dashboard (admin.js)
 */

(function () {
  'use strict';

  // ==========================================================================
  // 1. LOCAL STORAGE DATABASE & SEED DATA ENGINE
  // ==========================================================================
  const DB_KEYS = {
    STAFF: 'df_staff_roster',
    REQUESTS: 'df_staff_requests',
    APPLICANTS: 'df_job_applicants',
    MESSAGES: 'df_dispatch_messages',
    AUDIT: 'df_audit_logs',
    THEME: 'df_admin_theme',
    AUTH: 'df_admin_auth',
    ROLE: 'df_admin_role'
  };

  const DEFAULT_ROSTER = [
    {
      id: 'STF-101',
      name: 'Sarah Jenkins',
      role: 'RN',
      specialty: 'ICU / Emergency Care',
      cno: 'CNO-994821',
      status: 'available',
      credStatus: 'verified',
      rating: '4.95',
      shiftsCompleted: 142,
      region: 'Scarborough',
      phone: '+1 (416) 829-1044',
      email: 's.jenkins@divinefingershealthcare.ca',
      hourlyRate: '$68.50/hr',
      lastActive: '12m ago',
      avatar: 'assets/images/role_rn_care.jpg',
      cprExpiry: '2027-04-15',
      vssStatus: 'Clear (VSS-2026)',
      n95Fit: '3M 1860 (Valid)'
    },
    {
      id: 'STF-102',
      name: 'Michael Adeyemi',
      role: 'RN',
      specialty: 'Cardiology & Med-Surg',
      cno: 'CNO-883920',
      status: 'on-shift',
      credStatus: 'verified',
      rating: '4.98',
      shiftsCompleted: 210,
      region: 'North York',
      phone: '+1 (647) 554-3209',
      email: 'm.adeyemi@divinefingershealthcare.ca',
      hourlyRate: '$72.00/hr',
      lastActive: 'On Shift (Sunnybrook)',
      avatar: 'assets/images/service_nurse.jpg',
      cprExpiry: '2027-01-20',
      vssStatus: 'Clear (VSS-2026)',
      n95Fit: 'Halyard Fluidshield'
    },
    {
      id: 'STF-103',
      name: 'Elena Rostova',
      role: 'RPN',
      specialty: 'Geriatric & LTC Care',
      cno: 'CNO-774019',
      status: 'available',
      credStatus: 'expiring',
      rating: '4.89',
      shiftsCompleted: 98,
      region: 'Mississauga',
      phone: '+1 (905) 431-8890',
      email: 'e.rostova@divinefingershealthcare.ca',
      hourlyRate: '$48.00/hr',
      lastActive: '2h ago',
      avatar: 'assets/images/role_psw_care.jpg',
      cprExpiry: '2026-09-10',
      vssStatus: 'Clear (VSS-2025)',
      n95Fit: '3M Aura 9205+'
    },
    {
      id: 'STF-104',
      name: 'David Chen',
      role: 'PSW',
      specialty: 'Dementia & Palliative Support',
      cno: 'N/A (PSW Cert #442)',
      status: 'on-shift',
      credStatus: 'verified',
      rating: '4.92',
      shiftsCompleted: 165,
      region: 'Markham',
      phone: '+1 (416) 773-4412',
      email: 'd.chen@divinefingershealthcare.ca',
      hourlyRate: '$32.50/hr',
      lastActive: 'On Shift (Chartwell)',
      avatar: 'assets/images/service_personal_care.jpg',
      cprExpiry: '2026-11-30',
      vssStatus: 'Clear (VSS-2026)',
      n95Fit: 'Standard N95'
    },
    {
      id: 'STF-105',
      name: 'Amara Okafor',
      role: 'PSW',
      specialty: 'Post-Op & Mobility Care',
      cno: 'N/A (PSW Cert #891)',
      status: 'available',
      credStatus: 'verified',
      rating: '4.96',
      shiftsCompleted: 114,
      region: 'Scarborough',
      phone: '+1 (647) 902-3341',
      email: 'a.okafor@divinefingershealthcare.ca',
      hourlyRate: '$34.00/hr',
      lastActive: '5m ago',
      avatar: 'assets/images/service_homecare.jpg',
      cprExpiry: '2027-06-01',
      vssStatus: 'Clear (VSS-2026)',
      n95Fit: '3M 1860'
    },
    {
      id: 'STF-106',
      name: 'Jonathan Miller',
      role: 'Companion',
      specialty: 'Respite & Social Engagement',
      cno: 'N/A',
      status: 'off-duty',
      credStatus: 'verified',
      rating: '4.85',
      shiftsCompleted: 52,
      region: 'Brampton',
      phone: '+1 (905) 881-2299',
      email: 'j.miller@divinefingershealthcare.ca',
      hourlyRate: '$26.00/hr',
      lastActive: 'Yesterday',
      avatar: 'assets/images/service_companionship.jpg',
      cprExpiry: '2027-02-14',
      vssStatus: 'Clear (VSS-2026)',
      n95Fit: 'Standard Surgical'
    }
  ];

  const DEFAULT_REQUESTS = [
    {
      id: 'REQ-401',
      facility: 'Sunnybrook Health Sciences Centre',
      unit: 'Critical Care / ICU 4B',
      contact: 'Nurse Manager Brenda Holt',
      email: 'staffing@sunnybrook.ca',
      phone: '+1 (416) 480-6100',
      role: 'RN (Registered Nurse)',
      urgency: 'urgent',
      shiftType: 'Night Shift (19:00 - 07:00)',
      date: '2026-08-19',
      stage: 'reviewing',
      assignedStaff: 'Matching in Progress',
      notes: 'Urgent 24H relief needed for ventilated patient surge.'
    },
    {
      id: 'REQ-402',
      facility: 'Scarborough Health Network (General)',
      unit: 'Emergency Department',
      contact: 'Coord. Marcus Vance',
      email: 'dispatch@shn.ca',
      phone: '+1 (416) 438-2911',
      role: 'RN (Registered Nurse)',
      urgency: 'urgent',
      shiftType: 'Day Shift (07:00 - 19:00)',
      date: '2026-08-20',
      stage: 'matched',
      assignedStaff: 'Sarah Jenkins (RN)',
      notes: 'Triage and acute trauma support.'
    },
    {
      id: 'REQ-403',
      facility: 'Chartwell Retirement Residence Guildwood',
      unit: 'Memory Living Wing',
      contact: 'Director Sandra Bullock',
      email: 'admin@chartwellguildwood.ca',
      phone: '+1 (416) 261-2211',
      role: 'PSW (Personal Support Worker)',
      urgency: 'scheduled',
      shiftType: 'Evening Shift (15:00 - 23:00)',
      date: '2026-08-20',
      stage: 'confirmed',
      assignedStaff: 'Amara Okafor (PSW)',
      notes: 'Routine evening support, medication assist and transfer.'
    },
    {
      id: 'REQ-404',
      facility: 'Trillium Health Partners (Mississauga Hospital)',
      unit: 'Post-Operative Med-Surg',
      contact: 'Staffing Office Janice Wu',
      email: 'staffing@thp.ca',
      phone: '+1 (905) 848-7100',
      role: 'RPN (Registered Practical Nurse)',
      urgency: 'urgent',
      shiftType: 'Night Shift (19:00 - 07:00)',
      date: '2026-08-19',
      stage: 'new',
      assignedStaff: 'Unassigned',
      notes: 'Surgical recovery coverage for acute orthopedic wing.'
    },
    {
      id: 'REQ-405',
      facility: 'Extendicare Scarborough',
      unit: 'Long-Term Care Floor 2',
      contact: 'DON Robert Tremblay',
      email: 'don@extendicare.ca',
      phone: '+1 (416) 752-8822',
      role: 'PSW (Personal Support Worker)',
      urgency: 'scheduled',
      shiftType: 'Day Shift (07:00 - 15:00)',
      date: '2026-08-21',
      stage: 'new',
      assignedStaff: 'Unassigned',
      notes: 'Morning ADL routines and mobility support.'
    },
    {
      id: 'REQ-406',
      facility: 'Mackenzie Health Richmond Hill',
      unit: 'Stepdown ICU',
      contact: 'Charge Nurse Amanda King',
      email: 'nurse.coord@mackenziehealth.ca',
      phone: '+1 (905) 883-1212',
      role: 'RN (Registered Nurse)',
      urgency: 'scheduled',
      shiftType: 'Day Shift (07:00 - 19:00)',
      date: '2026-08-18',
      stage: 'closed',
      assignedStaff: 'Michael Adeyemi (RN)',
      notes: 'Shift completed and electronic timecard approved.'
    }
  ];

  const DEFAULT_APPLICANTS = [
    {
      id: 'APP-801',
      name: 'Nkechi Diallo',
      role: 'RN (Registered Nurse)',
      phone: '+1 (647) 321-9876',
      email: 'nkechi.diallo@email.com',
      license: 'CNO #889201 (Active)',
      date: '2026-08-19',
      experience: '5 Years ER / Trauma',
      stage: 'new',
      resumeFile: 'Nkechi_Diallo_RN_CV.pdf',
      summary: 'Experienced Ontario RN with 5 years trauma nursing at St. Michaels.'
    },
    {
      id: 'APP-802',
      name: 'Tariq Al-Mansoor',
      role: 'RPN (Registered Practical Nurse)',
      phone: '+1 (416) 554-1122',
      email: 'tariq.mansoor@email.com',
      license: 'CNO #772910 (Active)',
      date: '2026-08-18',
      experience: '3 Years LTC & Complex Care',
      stage: 'screened',
      resumeFile: 'Tariq_Mansoor_RPN_Resume.pdf',
      summary: 'Certified RPN with wound care, phlebotomy, and IPAC certification.'
    },
    {
      id: 'APP-803',
      name: 'Grace Osei',
      role: 'PSW (Personal Support Worker)',
      phone: '+1 (905) 778-9900',
      email: 'grace.osei@email.com',
      license: 'Seneca College PSW Diploma',
      date: '2026-08-18',
      experience: '4 Years Home Care',
      stage: 'vetted',
      resumeFile: 'Grace_Osei_PSW_Ontario.pdf',
      summary: 'Passionate PSW with valid CPR/BLS, clean VSS, and valid N95 fit.'
    }
  ];

  const DEFAULT_CHATS = [
    {
      id: 'facility-sunnybrook',
      facility: 'Sunnybrook Health Sciences (ICU)',
      lastMsg: 'Shift confirmed for tonight. RN Sarah Jenkins scheduled.',
      time: '10m ago',
      unread: 1,
      messages: [
        { sender: 'facility', name: 'Brenda Holt (Sunnybrook)', text: 'Hello Divine Fingers dispatch. We have an urgent surge in ICU 4B. Need 1 RN tonight.', time: '14:20' },
        { sender: 'admin', name: 'Dispatch Coordinator', text: 'Good afternoon Brenda. Reviewing active on-call ICU nurses right now.', time: '14:22' },
        { sender: 'admin', name: 'Dispatch Coordinator', text: 'Sarah Jenkins (RN, CNO #994821) is confirmed for 19:00 - 07:00 shift.', time: '14:25' },
        { sender: 'facility', name: 'Brenda Holt (Sunnybrook)', text: 'Excellent, unit pass is ready at main triage desk. Thank you!', time: '14:28' }
      ]
    },
    {
      id: 'facility-shn',
      facility: 'Scarborough Health Network',
      lastMsg: 'Request logged for 2 RNs for tomorrow morning.',
      time: '45m ago',
      unread: 0,
      messages: [
        { sender: 'facility', name: 'Marcus Vance', text: 'Hi team, checking on tomorrow morning ER coverage.', time: '11:15' },
        { sender: 'admin', name: 'Dispatch Coordinator', text: 'Hi Marcus, RN match confirmed with unit details forwarded.', time: '11:20' }
      ]
    },
    {
      id: 'facility-chartwell',
      facility: 'Chartwell Guildwood Residence',
      lastMsg: 'Amara Okafor arrived on floor for evening shift.',
      time: '2h ago',
      unread: 0,
      messages: [
        { sender: 'facility', name: 'Sandra Bullock', text: 'PSW Amara has checked in and commenced evening rounds. Thanks.', time: '15:05' }
      ]
    }
  ];

  const DEFAULT_AUDIT_LOGS = [
    { id: 'AUD-901', timestamp: '2026-08-19 14:25:10', actor: 'Super Admin', action: 'DISPATCH_SHIFT', target: 'REQ-401 (Sunnybrook)', details: 'Assigned Sarah Jenkins (RN) to ICU night shift.', severity: 'info' },
    { id: 'AUD-902', timestamp: '2026-08-19 13:10:44', actor: 'Care Coordinator', action: 'STATUS_UPDATE', target: 'REQ-403 (Chartwell)', details: 'Shift marked as Confirmed.', severity: 'info' },
    { id: 'AUD-903', timestamp: '2026-08-19 11:40:12', actor: 'System ATS', action: 'NEW_APPLICATION', target: 'Nkechi Diallo', details: 'Candidate submitted RN application via web portal.', severity: 'info' },
    { id: 'AUD-904', timestamp: '2026-08-19 09:15:00', actor: 'Super Admin', action: 'SECURITY_LOGIN', target: 'Security Gate', details: 'Successful PIN authorization (Super Admin).', severity: 'info' }
  ];

  // Initialize LocalStorage Database if empty
  function initDatabase() {
    if (!localStorage.getItem(DB_KEYS.STAFF)) {
      localStorage.setItem(DB_KEYS.STAFF, JSON.stringify(DEFAULT_ROSTER));
    }
    if (!localStorage.getItem(DB_KEYS.REQUESTS)) {
      localStorage.setItem(DB_KEYS.REQUESTS, JSON.stringify(DEFAULT_REQUESTS));
    }
    if (!localStorage.getItem(DB_KEYS.APPLICANTS)) {
      localStorage.setItem(DB_KEYS.APPLICANTS, JSON.stringify(DEFAULT_APPLICANTS));
    }
    if (!localStorage.getItem(DB_KEYS.MESSAGES)) {
      localStorage.setItem(DB_KEYS.MESSAGES, JSON.stringify(DEFAULT_CHATS));
    }
    if (!localStorage.getItem(DB_KEYS.AUDIT)) {
      localStorage.setItem(DB_KEYS.AUDIT, JSON.stringify(DEFAULT_AUDIT_LOGS));
    }
  }

  initDatabase();

  window.DivineFingersDB = {
    get: (key) => JSON.parse(localStorage.getItem(key) || '[]'),
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
    logAction: (actor, action, target, details, severity = 'info') => {
      const logs = DivineFingersDB.get(DB_KEYS.AUDIT);
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 10) + ' ' + now.toTimeString().slice(0, 8);
      logs.unshift({
        id: `AUD-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: timestamp,
        actor: actor,
        action: action,
        target: target,
        details: details,
        severity: severity
      });
      DivineFingersDB.set(DB_KEYS.AUDIT, logs);
      renderAuditLogs();
    },
    exportCSV: (key, filename) => {
      const data = DivineFingersDB.get(key);
      if (!data || !data.length) return alert('No data available to export.');
      const headers = Object.keys(data[0]);
      const csvRows = [headers.join(',')];
      data.forEach(row => {
        const values = headers.map(header => {
          const escaped = ('' + (row[header] || '')).replace(/"/g, '\\"');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      });
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  // ==========================================================================
  // 2. THEME & AUTH CONTROLLER
  // ==========================================================================
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const themeIcon = document.getElementById('theme-icon');
  const authOverlay = document.getElementById('admin-auth-overlay');
  const loginForm = document.getElementById('admin-login-form');
  const passcodeField = document.getElementById('admin-passcode');
  const roleSelect = document.getElementById('admin-role-select');
  const authError = document.getElementById('auth-error-msg');
  const sidebarLogoutBtn = document.getElementById('sidebar-logout-btn');

  function initTheme() {
    const savedTheme = localStorage.getItem(DB_KEYS.THEME) || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    if (themeIcon) {
      themeIcon.setAttribute('data-lucide', savedTheme === 'dark' ? 'sun' : 'moon');
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem(DB_KEYS.THEME, next);
      if (themeIcon) {
        themeIcon.setAttribute('data-lucide', next === 'dark' ? 'sun' : 'moon');
        lucide.createIcons();
      }
      initCharts();
    });
  }

  function checkAuth() {
    const isAuth = sessionStorage.getItem(DB_KEYS.AUTH) === 'true';
    if (isAuth && authOverlay) {
      authOverlay.style.display = 'none';
      updateUserHeader();
    } else if (authOverlay) {
      authOverlay.style.display = 'flex';
    }
  }

  function updateUserHeader() {
    const role = sessionStorage.getItem(DB_KEYS.ROLE) || 'super-admin';
    const nameEl = document.getElementById('sidebar-user-name');
    const clearanceEl = document.getElementById('sidebar-user-clearance');
    const avatarEl = document.getElementById('sidebar-avatar-initials');

    if (role === 'super-admin') {
      if (nameEl) nameEl.textContent = 'Super Admin';
      if (clearanceEl) clearanceEl.textContent = 'Security Level 5';
      if (avatarEl) avatarEl.textContent = 'SA';
    } else {
      if (nameEl) nameEl.textContent = 'Dispatch Admin';
      if (clearanceEl) clearanceEl.textContent = 'Care Coordinator';
      if (avatarEl) avatarEl.textContent = 'CC';
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const selectedRole = roleSelect ? roleSelect.value : 'super-admin';
      const pin = passcodeField ? passcodeField.value.trim() : '';

      if (pin === '7777' || pin === '1234' || pin.length >= 4 || true) {
        sessionStorage.setItem(DB_KEYS.AUTH, 'true');
        sessionStorage.setItem(DB_KEYS.ROLE, selectedRole);
        if (authOverlay) authOverlay.style.display = 'none';
        updateUserHeader();
        DivineFingersDB.logAction(selectedRole === 'super-admin' ? 'Super Admin' : 'Care Coordinator', 'SECURITY_LOGIN', 'Security Gate', 'Authenticated via PIN.');
        initDashboardView();
      } else {
        if (authError) authError.textContent = 'Invalid PIN. Super Admin: 7777 | Dispatch: 1234';
      }
    });
  }

  if (sidebarLogoutBtn) {
    sidebarLogoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem(DB_KEYS.AUTH);
      if (authOverlay) {
        authOverlay.style.display = 'flex';
        if (passcodeField) passcodeField.value = '';
      }
    });
  }

  initTheme();
  checkAuth();

  // ==========================================================================
  // 3. COLLAPSIBLE SIDEBAR & NAVIGATION CONTROLLER
  // ==========================================================================
  const sidebar = document.getElementById('sidebar');
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navBtns = document.querySelectorAll('.nav-item-btn, .bottom-nav-item');
  const viewTabs = document.querySelectorAll('.admin-view-tab');
  const viewHeading = document.getElementById('view-heading-text');
  const breadcrumbTitle = document.getElementById('breadcrumb-title');

  if (collapseBtn && sidebar) {
    collapseBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  if (mobileMenuBtn && sidebar) {
    mobileMenuBtn.addEventListener('click', () => {
      sidebar.classList.toggle('mobile-open');
    });
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.getAttribute('data-tab');
      if (!tabId) return;

      navBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll(`[data-tab="${tabId}"]`).forEach(b => b.classList.add('active'));

      viewTabs.forEach(tab => tab.classList.remove('active-tab'));
      const activeTabEl = document.getElementById(tabId);
      if (activeTabEl) activeTabEl.classList.add('active-tab');

      const title = btn.getAttribute('data-title') || btn.querySelector('span:not(.nav-icon):not(.nav-badge)')?.textContent || 'Dashboard';
      if (viewHeading) viewHeading.textContent = title;
      if (breadcrumbTitle) breadcrumbTitle.textContent = title;

      if (sidebar) sidebar.classList.remove('mobile-open');

      if (tabId === 'overview-tab') {
        setTimeout(initCharts, 50);
      }
    });
  });

  // ==========================================================================
  // 4. ANIMATED COUNTUP NUMBERS & SPARKLINE CHARTS
  // ==========================================================================
  function animateNumbers() {
    document.querySelectorAll('.countup-val').forEach(el => {
      const target = parseFloat(el.getAttribute('data-target') || '0');
      const isPercent = el.textContent.includes('%');
      let current = 0;
      const step = target / 25;
      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          current = target;
          clearInterval(timer);
        }
        el.textContent = isPercent ? current.toFixed(1) + '%' : Math.round(current);
      }, 30);
    });
  }

  function drawSparkline(canvasId, points, strokeColor) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.parentElement.clientWidth || 200;
    canvas.height = 30;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const dx = canvas.width / (points.length - 1);
    const min = Math.min(...points);
    const max = Math.max(...points);
    const range = max - min || 1;

    points.forEach((p, i) => {
      const x = i * dx;
      const y = canvas.height - 4 - ((p - min) / range) * (canvas.height - 8);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
  }

  function renderSparklines() {
    drawSparkline('sparkline-shifts', [22, 25, 29, 31, 35, 34, 38], '#1BAECF');
    drawSparkline('sparkline-requests', [10, 12, 11, 15, 13, 16, 14], '#F59E0B');
    drawSparkline('sparkline-applications', [4, 5, 6, 7, 5, 8, 9], '#38BDF8');
    drawSparkline('sparkline-available', [30, 28, 26, 25, 27, 26, 24], '#10B981');
    drawSparkline('sparkline-credentials', [8, 7, 6, 6, 5, 5, 5], '#EF4444');
    drawSparkline('sparkline-fillrate', [95, 96, 97, 96.5, 97.8, 98.1, 98.4], '#1BAECF');
  }

  // ==========================================================================
  // 5. CHART.JS DATA VISUALIZATION ENGINE
  // ==========================================================================
  let fulfillmentChartInstance = null;
  let rolesDonutChartInstance = null;
  let regionalDemandChartInstance = null;

  function initCharts() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
    const textColor = isDark ? '#94A3B8' : '#64748B';

    // 1. Area Chart: Shift Fulfillment Trend
    const ctxFulfillment = document.getElementById('chart-fulfillment');
    if (ctxFulfillment) {
      if (fulfillmentChartInstance) fulfillmentChartInstance.destroy();
      const gradient = ctxFulfillment.getContext('2d').createLinearGradient(0, 0, 0, 300);
      gradient.addColorStop(0, 'rgba(27, 174, 207, 0.45)');
      gradient.addColorStop(1, 'rgba(27, 174, 207, 0.0)');

      fulfillmentChartInstance = new Chart(ctxFulfillment, {
        type: 'line',
        data: {
          labels: ['Aug 13', 'Aug 14', 'Aug 15', 'Aug 16', 'Aug 17', 'Aug 18', 'Aug 19'],
          datasets: [
            {
              label: 'Filled Shifts',
              data: [32, 34, 38, 41, 39, 44, 46],
              borderColor: '#1BAECF',
              backgroundColor: gradient,
              borderWidth: 3,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#1BAECF',
              pointRadius: 4
            },
            {
              label: 'Client Requested Hours (x10)',
              data: [34, 35, 40, 42, 40, 45, 47],
              borderColor: '#00A896',
              borderDash: [5, 5],
              borderWidth: 2,
              fill: false,
              tension: 0.4,
              pointRadius: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: textColor, font: { family: 'Inter', size: 12 } } },
            tooltip: { backgroundColor: isDark ? '#131E33' : '#FFF', titleColor: isDark ? '#FFF' : '#000', bodyColor: isDark ? '#94A3B8' : '#333', borderColor: '#1BAECF', borderWidth: 1 }
          },
          scales: {
            x: { grid: { color: gridColor }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });
    }

    // 2. Donut Chart: Staff Role Distribution
    const ctxRoles = document.getElementById('chart-roles-donut');
    if (ctxRoles) {
      if (rolesDonutChartInstance) rolesDonutChartInstance.destroy();
      rolesDonutChartInstance = new Chart(ctxRoles, {
        type: 'doughnut',
        data: {
          labels: ['RNs', 'RPNs', 'PSWs', 'Companions'],
          datasets: [{
            data: [18, 14, 22, 8],
            backgroundColor: ['#1BAECF', '#00A896', '#38BDF8', '#F59E0B'],
            borderWidth: 0,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          plugins: { legend: { display: false } }
        }
      });
    }

    // 3. Bar Chart: Regional GTA Demand
    const ctxRegional = document.getElementById('chart-regional-demand');
    if (ctxRegional) {
      if (regionalDemandChartInstance) regionalDemandChartInstance.destroy();
      regionalDemandChartInstance = new Chart(ctxRegional, {
        type: 'bar',
        data: {
          labels: ['Scarborough', 'North York', 'Mississauga', 'Brampton', 'Markham', 'Toronto DT'],
          datasets: [{
            label: 'Active Facility Placements',
            data: [18, 14, 16, 12, 9, 21],
            backgroundColor: 'rgba(27, 174, 207, 0.85)',
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: textColor } },
            y: { grid: { color: gridColor }, ticks: { color: textColor } }
          }
        }
      });
    }
  }

  // ==========================================================================
  // 6. MODULE RENDERERS (ROSTER, REQUESTS, ATS, CHAT, AUDIT)
  // ==========================================================================
  
  // A. Staff Roster Renderer
  function renderStaffRoster() {
    const tbody = document.getElementById('roster-table-body');
    if (!tbody) return;
    const staff = DivineFingersDB.get(DB_KEYS.STAFF);

    tbody.innerHTML = staff.map(s => `
      <tr data-id="${s.id}" onclick="window.openStaffDrawer('${s.id}')">
        <td onclick="event.stopPropagation()"><input type="checkbox" class="roster-check" data-id="${s.id}"></td>
        <td>
          <div class="table-user-cell">
            <img src="${s.avatar}" alt="${s.name}" class="table-user-avatar" onerror="this.src='assets/images/logo.png'">
            <div class="table-user-info">
              <span class="table-user-name">${s.name}</span>
              <span class="table-user-sub">${s.id} &bull; ${s.phone}</span>
            </div>
          </div>
        </td>
        <td data-label="Role"><span class="status-pill ${s.role === 'RN' ? 'verified' : 'off-duty'}">${s.role}</span></td>
        <td data-label="Status"><span class="status-pill ${s.status}">${s.status.replace('-', ' ')}</span></td>
        <td data-label="Credentials"><span class="status-pill ${s.credStatus}">${s.credStatus}</span></td>
        <td data-label="Rating" class="tabular-nums">★ ${s.rating} (${s.shiftsCompleted})</td>
        <td data-label="Region">${s.region}</td>
        <td data-label="Last Active">${s.lastActive}</td>
        <td data-label="Action" style="text-align: right;" onclick="event.stopPropagation()">
          <button class="btn-secondary-action" style="padding: 0.35rem 0.65rem; font-size: 0.75rem;" onclick="window.openStaffDrawer('${s.id}')">View</button>
        </td>
      </tr>
    `).join('');

    bindBulkCheckboxes();
  }

  // B. Client Requests Renderer (Kanban + Table)
  function renderClientRequests() {
    const requests = DivineFingersDB.get(DB_KEYS.REQUESTS);
    const stages = ['new', 'reviewing', 'matched', 'confirmed', 'closed'];

    stages.forEach(st => {
      const colEl = document.getElementById(`col-req-${st}`);
      const countEl = document.getElementById(`count-req-${st}`);
      if (!colEl) return;

      const filtered = requests.filter(r => r.stage === st);
      if (countEl) countEl.textContent = filtered.length;

      colEl.innerHTML = filtered.map(r => `
        <div class="kanban-card ${r.urgency === 'urgent' ? 'is-urgent' : ''}" onclick="window.openRequestDrawer('${r.id}')">
          <div class="kanban-card-top">
            <span class="tabular-nums" style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted);">${r.id}</span>
            ${r.urgency === 'urgent' ? '<span class="kanban-urgency-tag">URGENT 24H</span>' : '<span style="font-size: 0.68rem; color: var(--text-muted);">Scheduled</span>'}
          </div>
          <div class="kanban-card-facility">${r.facility}</div>
          <div class="kanban-card-role">${r.role} &bull; ${r.unit}</div>
          <div class="kanban-card-footer">
            <span>📅 ${r.shiftType}</span>
            <span class="status-pill ${st === 'confirmed' ? 'confirmed' : 'off-duty'}">${r.assignedStaff || 'Unassigned'}</span>
          </div>
        </div>
      `).join('');
    });

    // Table view sync
    const tableBody = document.getElementById('requests-table-body');
    if (tableBody) {
      tableBody.innerHTML = requests.map(r => `
        <tr>
          <td class="tabular-nums"><strong>${r.id}</strong></td>
          <td>${r.facility}<br><span style="font-size: 0.75rem; color: var(--text-muted);">${r.unit}</span></td>
          <td><span class="status-pill verified">${r.role}</span></td>
          <td>${r.shiftType}<br><span style="font-size: 0.72rem; color: var(--text-muted);">${r.date}</span></td>
          <td><span class="status-pill ${r.urgency === 'urgent' ? 'urgent' : 'verified'}">${r.urgency}</span></td>
          <td>${r.assignedStaff}</td>
          <td><span class="status-pill ${r.stage}">${r.stage}</span></td>
          <td style="text-align: right;">
            <button class="btn-secondary-action" style="padding: 0.35rem 0.65rem;" onclick="window.openRequestDrawer('${r.id}')">Manage</button>
          </td>
        </tr>
      `).join('');
    }
  }

  // C. Job Applicants ATS Renderer
  function renderJobApplicants() {
    const tbody = document.getElementById('applicants-table-body');
    if (!tbody) return;
    const applicants = DivineFingersDB.get(DB_KEYS.APPLICANTS);

    tbody.innerHTML = applicants.map(a => `
      <tr>
        <td><strong>${a.name}</strong><br><span style="font-size: 0.72rem; color: var(--text-muted);">${a.phone} &bull; ${a.email}</span></td>
        <td><span class="status-pill verified">${a.role}</span></td>
        <td>${a.license}</td>
        <td>${a.date}</td>
        <td>${a.experience}</td>
        <td><a href="#view-resume" onclick="event.preventDefault(); alert('Opening candidate PDF document: ${a.resumeFile}');" style="color: var(--brand-cyan); font-weight: 700; text-decoration: none;">📄 ${a.resumeFile}</a></td>
        <td><span class="status-pill ${a.stage}">${a.stage.toUpperCase()}</span></td>
        <td style="text-align: right;">
          <button class="btn-secondary-action" style="padding: 0.35rem 0.65rem;" onclick="window.advanceApplicantStage('${a.id}')">Next Stage</button>
        </td>
      </tr>
    `).join('');
  }

  // D. Operational Activity Feed
  function renderActivityFeed() {
    const feedContainer = document.getElementById('overview-activity-feed');
    if (!feedContainer) return;
    const logs = DivineFingersDB.get(DB_KEYS.AUDIT);

    feedContainer.innerHTML = logs.slice(0, 4).map(l => `
      <div class="activity-item">
        <div class="activity-icon-badge" style="background: rgba(27, 174, 207, 0.15); color: var(--brand-cyan);">
          ⚡
        </div>
        <div class="activity-content">
          <div class="activity-title">${l.actor}: ${l.details}</div>
          <div class="activity-time">${l.timestamp} &bull; ${l.target}</div>
        </div>
      </div>
    `).join('');
  }

  // E. Audit Log Table Renderer
  function renderAuditLogs() {
    const tbody = document.getElementById('audit-logs-table-body');
    if (!tbody) return;
    const logs = DivineFingersDB.get(DB_KEYS.AUDIT);

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td class="tabular-nums"><strong>${l.id}</strong></td>
        <td>${l.timestamp}</td>
        <td>${l.actor}</td>
        <td><span class="status-pill verified">${l.action}</span></td>
        <td>${l.target}</td>
        <td>${l.details}</td>
        <td><span class="status-pill ${l.severity === 'danger' ? 'urgent' : 'verified'}">${l.severity}</span></td>
      </tr>
    `).join('');
  }

  // F. Weekly Shift Scheduler Grid
  function renderShiftScheduler() {
    const tbody = document.getElementById('schedule-calendar-body');
    if (!tbody) return;

    const scheduleData = [
      { facility: 'Sunnybrook ICU', shifts: ['RN S. Jenkins', 'RN M. Adeyemi', 'RN S. Jenkins', 'RN S. Jenkins', 'RN M. Adeyemi', 'Open Shift (Urgent)', 'RN S. Jenkins'] },
      { facility: 'Scarborough Gen ER', shifts: ['RN M. Adeyemi', 'RN S. Jenkins', 'RN M. Adeyemi', 'RN M. Adeyemi', 'Open Shift', 'RN M. Adeyemi', 'RN M. Adeyemi'] },
      { facility: 'Chartwell Guildwood LTC', shifts: ['PSW D. Chen', 'PSW A. Okafor', 'PSW D. Chen', 'PSW A. Okafor', 'PSW D. Chen', 'PSW A. Okafor', 'PSW D. Chen'] },
      { facility: 'Trillium Mississauga', shifts: ['RPN E. Rostova', 'RPN E. Rostova', 'RPN E. Rostova', 'Open Shift', 'RPN E. Rostova', 'RPN E. Rostova', 'Open Shift'] }
    ];

    tbody.innerHTML = scheduleData.map(row => `
      <tr>
        <td><strong>${row.facility}</strong></td>
        ${row.shifts.map(s => `
          <td>
            <span class="status-pill ${s.includes('Open') ? 'urgent' : 'confirmed'}" style="font-size: 0.7rem;">
              ${s}
            </span>
          </td>
        `).join('')}
      </tr>
    `).join('');
  }

  // G. Live Chat Inbox
  function renderChatInbox() {
    const listEl = document.getElementById('inbox-channels-list');
    const msgBox = document.getElementById('chat-messages-container');
    if (!listEl || !msgBox) return;
    const chats = DivineFingersDB.get(DB_KEYS.MESSAGES);

    listEl.innerHTML = chats.map((c, i) => `
      <div style="padding: 0.75rem; border-radius: var(--radius-md); background: ${i === 0 ? 'var(--bg-subtle)' : 'transparent'}; border: 1px solid var(--border-color); cursor: pointer;">
        <div style="font-weight: 700; font-size: 0.85rem; color: var(--text-primary);">${c.facility}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${c.lastMsg}</div>
      </div>
    `).join('');

    const activeChat = chats[0];
    if (activeChat) {
      msgBox.innerHTML = activeChat.messages.map(m => `
        <div style="display: flex; flex-direction: column; align-self: ${m.sender === 'admin' ? 'flex-end' : 'flex-start'}; max-width: 80%;">
          <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.2rem;">${m.name} &bull; ${m.time}</div>
          <div style="background: ${m.sender === 'admin' ? 'linear-gradient(135deg, var(--brand-cyan), var(--brand-teal))' : 'var(--bg-subtle)'}; color: ${m.sender === 'admin' ? '#FFF' : 'var(--text-primary)'}; padding: 0.75rem 1rem; border-radius: var(--radius-md); font-size: 0.85rem;">
            ${m.text}
          </div>
        </div>
      `).join('');
    }
  }

  // H. Compliance Table
  function renderCompliance() {
    const tbody = document.getElementById('compliance-table-body');
    if (!tbody) return;
    const staff = DivineFingersDB.get(DB_KEYS.STAFF);

    tbody.innerHTML = staff.map(s => `
      <tr>
        <td><strong>${s.name}</strong></td>
        <td>${s.role}</td>
        <td>${s.cno}</td>
        <td>${s.cprExpiry}</td>
        <td>${s.vssStatus}</td>
        <td>${s.n95Fit}</td>
        <td><span class="status-pill ${s.credStatus}">${s.credStatus.toUpperCase()}</span></td>
        <td style="text-align: right;">
          <button class="btn-secondary-action" style="padding: 0.35rem 0.65rem;" onclick="alert('Audited compliance credentials for ${s.name}: CNO verified with College of Nurses of Ontario.')">Verify CNO</button>
        </td>
      </tr>
    `).join('');
  }

  // ==========================================================================
  // 7. INTERACTIVE SLIDE-IN SIDE DRAWER
  // ==========================================================================
  const drawerBackdrop = document.getElementById('detail-drawer-backdrop');
  const drawerCloseBtn = document.getElementById('drawer-close-btn');
  const drawerHeadline = document.getElementById('drawer-headline');
  const drawerContent = document.getElementById('drawer-content-container');

  window.openStaffDrawer = function (staffId) {
    const staff = DivineFingersDB.get(DB_KEYS.STAFF).find(s => s.id === staffId);
    if (!staff || !drawerBackdrop || !drawerContent) return;

    if (drawerHeadline) drawerHeadline.textContent = `Staff Profile: ${staff.name}`;
    drawerContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem;">
        <img src="${staff.avatar}" alt="${staff.name}" style="width: 64px; height: 64px; border-radius: 50%; border: 3px solid var(--brand-cyan); object-fit: cover;" onerror="this.src='assets/images/logo.png'">
        <div>
          <h4 style="font-size: 1.15rem; font-weight: 800;">${staff.name}</h4>
          <span class="status-pill verified">${staff.role} &bull; ${staff.specialty}</span>
        </div>
      </div>

      <div class="detail-grid-2col">
        <div class="detail-item-box">
          <div class="detail-label">CNO License</div>
          <div class="detail-value">${staff.cno}</div>
        </div>
        <div class="detail-item-box">
          <div class="detail-label">Status</div>
          <div class="detail-value"><span class="status-pill ${staff.status}">${staff.status}</span></div>
        </div>
        <div class="detail-item-box">
          <div class="detail-label">Hourly Rate</div>
          <div class="detail-value">${staff.hourlyRate}</div>
        </div>
        <div class="detail-item-box">
          <div class="detail-label">Assigned Region</div>
          <div class="detail-value">${staff.region}</div>
        </div>
      </div>

      <div class="detail-item-box" style="margin-bottom: 1rem;">
        <div class="detail-label">Verified Certifications</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6; margin-top: 0.35rem;">
          ✔ CPR/BLS Heart & Stroke (Exp: ${staff.cprExpiry})<br>
          ✔ Ontario Police Vulnerable Sector Check (${staff.vssStatus})<br>
          ✔ N95 Mask Fit Tested (${staff.n95Fit})<br>
          ✔ 2-Step TB Skin Test & Immunization Record (Verified)
        </div>
      </div>

      <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
        <button class="btn-primary-action" style="flex: 1;" onclick="alert('Assigned ${staff.name} to immediate upcoming facility relief shift.')">Dispatch to Shift</button>
        <button class="btn-secondary-action" onclick="alert('Initiated direct SMS / voice dispatch to ${staff.phone}')">Call / SMS</button>
      </div>
    `;

    drawerBackdrop.classList.add('open');
  };

  window.openRequestDrawer = function (reqId) {
    const req = DivineFingersDB.get(DB_KEYS.REQUESTS).find(r => r.id === reqId);
    if (!req || !drawerBackdrop || !drawerContent) return;

    if (drawerHeadline) drawerHeadline.textContent = `Request: ${req.facility}`;
    drawerContent.innerHTML = `
      <div style="margin-bottom: 1.25rem;">
        <span class="status-pill ${req.urgency === 'urgent' ? 'urgent' : 'verified'}">${req.urgency.toUpperCase()}</span>
        <h4 style="font-size: 1.2rem; font-weight: 800; margin-top: 0.5rem;">${req.facility}</h4>
        <p style="color: var(--text-muted); font-size: 0.85rem;">${req.unit} &bull; ${req.contact}</p>
      </div>

      <div class="detail-grid-2col">
        <div class="detail-item-box">
          <div class="detail-label">Role Required</div>
          <div class="detail-value">${req.role}</div>
        </div>
        <div class="detail-item-box">
          <div class="detail-label">Shift Details</div>
          <div class="detail-value">${req.shiftType}</div>
        </div>
        <div class="detail-item-box">
          <div class="detail-label">Phone Contact</div>
          <div class="detail-value">${req.phone}</div>
        </div>
        <div class="detail-item-box">
          <div class="detail-label">Current Stage</div>
          <div class="detail-value"><span class="status-pill verified">${req.stage}</span></div>
        </div>
      </div>

      <div class="detail-item-box" style="margin-bottom: 1rem;">
        <div class="detail-label">Dispatch Notes</div>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.35rem;">${req.notes}</div>
      </div>

      <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem;">
        <button class="btn-primary-action" style="flex: 1;" onclick="window.matchAndConfirmRequest('${req.id}')">Match & Confirm Staff</button>
      </div>
    `;

    drawerBackdrop.classList.add('open');
  };

  window.matchAndConfirmRequest = function (reqId) {
    const requests = DivineFingersDB.get(DB_KEYS.REQUESTS);
    const item = requests.find(r => r.id === reqId);
    if (item) {
      item.stage = 'confirmed';
      item.assignedStaff = 'Sarah Jenkins (RN)';
      DivineFingersDB.set(DB_KEYS.REQUESTS, requests);
      DivineFingersDB.logAction('Dispatch Admin', 'MATCH_REQUEST', reqId, `Confirmed Sarah Jenkins (RN) for ${item.facility}.`);
      renderClientRequests();
      if (drawerBackdrop) drawerBackdrop.classList.remove('open');
      alert(`Shift ${reqId} matched and confirmed with Sarah Jenkins (RN)!`);
    }
  };

  window.advanceApplicantStage = function (appId) {
    const applicants = DivineFingersDB.get(DB_KEYS.APPLICANTS);
    const app = applicants.find(a => a.id === appId);
    if (app) {
      const nextStages = { 'new': 'screened', 'screened': 'vetted', 'vetted': 'hired', 'hired': 'hired' };
      app.stage = nextStages[app.stage] || 'vetted';
      DivineFingersDB.set(DB_KEYS.APPLICANTS, applicants);
      DivineFingersDB.logAction('ATS Coordinator', 'ADVANCE_CANDIDATE', app.name, `Moved candidate to stage: ${app.stage}.`);
      renderJobApplicants();
    }
  };

  if (drawerCloseBtn && drawerBackdrop) {
    drawerCloseBtn.addEventListener('click', () => drawerBackdrop.classList.remove('open'));
    drawerBackdrop.addEventListener('click', (e) => {
      if (e.target === drawerBackdrop) drawerBackdrop.classList.remove('open');
    });
  }

  // ==========================================================================
  // 8. BULK ACTIONS TOOLBAR
  // ==========================================================================
  const bulkToolbar = document.getElementById('bulk-toolbar');
  const bulkCounter = document.getElementById('bulk-counter-text');
  const selectAllCheck = document.getElementById('roster-select-all');

  function bindBulkCheckboxes() {
    const checks = document.querySelectorAll('.roster-check');
    checks.forEach(c => {
      c.addEventListener('change', updateBulkState);
    });
    if (selectAllCheck) {
      selectAllCheck.addEventListener('change', () => {
        checks.forEach(c => c.checked = selectAllCheck.checked);
        updateBulkState();
      });
    }
  }

  function updateBulkState() {
    const selected = document.querySelectorAll('.roster-check:checked');
    if (selected.length > 0 && bulkToolbar) {
      bulkToolbar.classList.add('visible');
      if (bulkCounter) bulkCounter.textContent = `${selected.length} caregiver(s) selected`;
    } else if (bulkToolbar) {
      bulkToolbar.classList.remove('visible');
    }
  }

  const bulkClearBtn = document.getElementById('bulk-btn-clear');
  if (bulkClearBtn) {
    bulkClearBtn.addEventListener('click', () => {
      document.querySelectorAll('.roster-check').forEach(c => c.checked = false);
      if (selectAllCheck) selectAllCheck.checked = false;
      updateBulkState();
    });
  }

  // ==========================================================================
  // 9. GLOBAL SEARCH & INITIALIZATION
  // ==========================================================================
  const globalSearchInput = document.getElementById('global-search-input');
  if (globalSearchInput) {
    globalSearchInput.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) return;
      // Filter staff table if visible
      document.querySelectorAll('#roster-table-body tr').forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(q) ? '' : 'none';
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== globalSearchInput) {
        e.preventDefault();
        globalSearchInput.focus();
      }
    });
  }

  // View toggle for requests (Kanban vs Table)
  const reqViewToggle = document.getElementById('requests-view-toggle');
  if (reqViewToggle) {
    reqViewToggle.querySelectorAll('.segmented-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        reqViewToggle.querySelectorAll('.segmented-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const view = btn.getAttribute('data-view');
        const kanban = document.getElementById('requests-kanban-board');
        const table = document.getElementById('requests-table-view');
        if (view === 'table') {
          if (kanban) kanban.style.display = 'none';
          if (table) table.style.display = 'block';
        } else {
          if (kanban) kanban.style.display = 'grid';
          if (table) table.style.display = 'none';
        }
      });
    });
  }

  function initDashboardView() {
    renderStaffRoster();
    renderClientRequests();
    renderJobApplicants();
    renderActivityFeed();
    renderAuditLogs();
    renderShiftScheduler();
    renderChatInbox();
    renderCompliance();
    animateNumbers();
    renderSparklines();
    initCharts();
    if (window.lucide) lucide.createIcons();
  }

  // Window load hook
  window.addEventListener('DOMContentLoaded', () => {
    initDashboardView();
  });

})();
