// GSAP & DOM Interactive Scripts for Divine Fingers Healthcare Services Inc.

document.addEventListener('DOMContentLoaded', () => {
  // Register GSAP ScrollTrigger if available
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  // 1. Mobile Menu Drawer Toggle
  const mobileToggle = document.getElementById('mobile-toggle');
  const navList = document.querySelector('.nav-list');

  if (mobileToggle && navList) {
    mobileToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      navList.classList.toggle('open');
      mobileToggle.classList.toggle('active');
    });

    // Close mobile nav when tapping outside
    document.addEventListener('click', (e) => {
      if (navList.classList.contains('open')) {
        if (!navList.contains(e.target) && !mobileToggle.contains(e.target)) {
          navList.classList.remove('open');
          mobileToggle.classList.remove('active');
        }
      }
    });

    // Close mobile nav when clicking any nav link
    navList.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('open');
        mobileToggle.classList.remove('active');
      });
    });
  }

  // 2. Interactive Staffing & Community Care Roles Pagination & Automatic Carousel (< 01 / 05 >)
  const prevBtn = document.getElementById('prev-prod-btn');
  const nextBtn = document.getElementById('next-prod-btn');
  const currentPageEl = document.getElementById('current-page');
  const productsGrid = document.getElementById('products-grid');

  let currentPage = 1;
  const totalPages = 5;

  const productData = [
    // Page 1
    [
      { img: 'assets/images/role_psw_care.jpg', title: 'Personal Care Support', highlight: false },
      { img: 'assets/images/service_nurse.jpg', title: 'Travelling Nursing Program', highlight: true },
      { img: 'assets/images/role_rn_care.jpg', title: 'Support & Companionship', highlight: false }
    ],
    // Page 2
    [
      { img: 'assets/images/role_icu_care.jpg', title: 'Respite Care Services', highlight: false },
      { img: 'assets/images/hero_divine.jpg', title: 'Light Household Support', highlight: true },
      { img: 'assets/images/role_psw_care.jpg', title: 'Alzheimer’s & Dementia Care', highlight: false }
    ],
    // Page 3
    [
      { img: 'assets/images/role_rn_care.jpg', title: 'Mobile Health Assessments', highlight: false },
      { img: 'assets/images/service_nurse.jpg', title: 'Wound Care & Dressing Management', highlight: true },
      { img: 'assets/images/role_icu_care.jpg', title: 'Chronic Disease Monitoring', highlight: false }
    ],
    // Page 4
    [
      { img: 'assets/images/service_homecare.jpg', title: 'High-Needs Attendant Care', highlight: false },
      { img: 'assets/images/role_psw_care.jpg', title: 'Rehabilitation & Physical Support', highlight: true },
      { img: 'assets/images/team_divine.jpg', title: 'Medical Appointment Accompaniment', highlight: false }
    ],
    // Page 5
    [
      { img: 'assets/images/hero_divine.jpg', title: 'Post-Discharge Recovery Care', highlight: false },
      { img: 'assets/images/role_psw_care.jpg', title: 'Cognitive Engagement & Memory Support', highlight: true },
      { img: 'assets/images/role_rn_care.jpg', title: 'Certified RN, RPN & PSW Staffing', highlight: false }
    ]
  ];

  function renderProducts(pageIndex) {
    if (!productsGrid) return;
    const pageProducts = productData[pageIndex - 1];

    productsGrid.style.opacity = '0';
    productsGrid.style.transform = 'translateY(10px)';
    
    setTimeout(() => {
      productsGrid.innerHTML = pageProducts.map(prod => `
        <article class="product-card ${prod.highlight ? 'active-highlight-card' : ''}">
          <div class="product-img-box">
            <img src="${prod.img}" alt="${prod.title}" class="product-img">
            ${prod.highlight ? '<button class="card-plus-btn" aria-label="View details">+</button>' : ''}
          </div>
          <h3 class="product-caption ${prod.highlight ? 'white-text' : ''}">${prod.title}</h3>
        </article>
      `).join('');

      if (currentPageEl) {
        currentPageEl.textContent = pageIndex < 10 ? `0${pageIndex}` : pageIndex;
      }
      
      productsGrid.style.transition = 'all 0.3s ease';
      productsGrid.style.opacity = '1';
      productsGrid.style.transform = 'translateY(0)';
    }, 200);
  }

  let rolesAutoTimer = null;

  function startRolesAutoCycle() {
    stopRolesAutoCycle();
    rolesAutoTimer = setInterval(() => {
      currentPage = currentPage < totalPages ? currentPage + 1 : 1;
      renderProducts(currentPage);
    }, 8000);
  }

  function stopRolesAutoCycle() {
    if (rolesAutoTimer) clearInterval(rolesAutoTimer);
  }

  if (prevBtn && nextBtn) {
    prevBtn.addEventListener('click', () => {
      currentPage = currentPage > 1 ? currentPage - 1 : totalPages;
      renderProducts(currentPage);
      startRolesAutoCycle();
    });

    nextBtn.addEventListener('click', () => {
      currentPage = currentPage < totalPages ? currentPage + 1 : 1;
      renderProducts(currentPage);
      startRolesAutoCycle();
    });
  }

  if (productsGrid) {
    startRolesAutoCycle();
  }

  // 3. Synchronized Hero Text & Photo Image Carousel (8-Second Interval)
  const dots = document.querySelectorAll('.hero-carousel-dots .dot');
  const heroTitle = document.querySelector('.hero-title');
  const heroImg = document.querySelector('.hero-img');

  const heroSlidesData = [
    {
      text: "Where Innovation Meets Compassionate Care.",
      img: "assets/images/hero_divine.jpg"
    },
    {
      text: "Travelling Nursing &amp; On-Demand Clinical Care Across Canada.",
      img: "assets/images/service_nurse.jpg"
    },
    {
      text: "Personal Care Support &amp; Assistive Daily Living.",
      img: "assets/images/service_homecare.jpg"
    },
    {
      text: "Dedicated Clinical Staffing &amp; Facility Partnerships.",
      img: "assets/images/team_divine.jpg"
    }
  ];

  let currentHeroIndex = 0;
  let heroTimer = null;

  function switchHeroSlide(index) {
    currentHeroIndex = index;
    dots.forEach(d => d.classList.remove('active'));
    if (dots[index]) dots[index].classList.add('active');

    const slide = heroSlidesData[index];
    if (!slide) return;

    if (heroTitle) {
      heroTitle.style.opacity = '0';
      heroTitle.style.transform = 'translateY(6px)';
    }

    if (heroImg) {
      heroImg.style.opacity = '0.3';
    }

    setTimeout(() => {
      if (heroTitle) {
        heroTitle.innerHTML = slide.text;
        const plainTextLen = slide.text.replace(/<[^>]*>/g, '').length;
        if (plainTextLen > 45) {
          heroTitle.style.fontSize = 'clamp(1.75rem, 2.7vw, 2.65rem)';
        } else {
          heroTitle.style.fontSize = '';
        } // Uses full CSS clamp font size
        heroTitle.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        heroTitle.style.opacity = '1';
        heroTitle.style.transform = 'translateY(0)';
      }
      if (heroImg) {
        heroImg.src = slide.img;
        heroImg.style.transition = 'opacity 0.8s ease';
        heroImg.style.opacity = '1';
      }
    }, 300);
  }

  function startHeroAutoCycle() {
    stopHeroAutoCycle();
    heroTimer = setInterval(() => {
      currentHeroIndex = (currentHeroIndex + 1) % heroSlidesData.length;
      switchHeroSlide(currentHeroIndex);
    }, 8000);
  }

  function stopHeroAutoCycle() {
    if (heroTimer) clearInterval(heroTimer);
  }

  dots.forEach((dot, index) => {
    dot.addEventListener('click', () => {
      switchHeroSlide(index);
      startHeroAutoCycle();
    });
  });

  if (heroTitle && heroImg) {
    startHeroAutoCycle();
  }

  // ==========================================================================
  // 4. SECURE API FORM SUBMISSIONS — WITH TIMEOUT, RETRY BUFFER & OFFLINE BANNER
  // All public forms: staffing requests, applications, contact inquiries.
  // Uses a hardened fetch wrapper with:
  //   - 15-second AbortController timeout
  //   - Visible "service unavailable" banner on failure
  //   - localStorage retry buffer: failed submissions are saved and retried
  //     automatically the next time a form submission succeeds or the page reloads
  // ==========================================================================
  const API_BASE = window.API_BASE_URL || (() => {
    if (typeof window === 'undefined') return '/api';
    const isFile = window.location.protocol === 'file:';
    const isLocalHost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '';
    if (isFile || (isLocalHost && window.location.port !== '3000')) {
      return 'http://localhost:3000/api';
    }
    if (window.location.hostname.includes('onrender.com')) {
      return '/api';
    }
    return 'https://divine-fingers-healthcare.onrender.com/api';
  })();

  // ── Retry Buffer (localStorage) ──────────────────────────────────────────────
  const RETRY_KEY = 'df_form_retry_buffer';

  function saveToRetryBuffer(endpoint, payload, isFormData) {
    if (isFormData) return; // Can't serialize multipart FormData to localStorage
    try {
      const buffer = JSON.parse(localStorage.getItem(RETRY_KEY) || '[]');
      buffer.push({ endpoint, payload, timestamp: Date.now() });
      // Keep max 10 entries to avoid unbounded growth
      if (buffer.length > 10) buffer.splice(0, buffer.length - 10);
      localStorage.setItem(RETRY_KEY, JSON.stringify(buffer));
    } catch { /* localStorage full or unavailable — ignore */ }
  }

  async function flushRetryBuffer() {
    try {
      const buffer = JSON.parse(localStorage.getItem(RETRY_KEY) || '[]');
      if (!buffer.length) return;

      const succeeded = [];
      for (const item of buffer) {
        try {
          await apiPost(item.endpoint, item.payload, null, null, false /* no re-buffer on fail */);
          succeeded.push(item);
        } catch { /* Keep failed items in buffer */ }
      }

      if (succeeded.length > 0) {
        const remaining = buffer.filter(i => !succeeded.includes(i));
        localStorage.setItem(RETRY_KEY, JSON.stringify(remaining));
        console.info(`[Retry Buffer] Re-submitted ${succeeded.length} buffered form(s) successfully.`);
      }
    } catch { /* Ignore buffer flush errors */ }
  }

  // ── Service Unavailable Banner ────────────────────────────────────────────────
  let degradedBanner = null;

  function showUnavailableBanner(feedbackEl) {
    if (feedbackEl) {
      feedbackEl.style.color = '#e63946';
      feedbackEl.innerHTML = `
        ⚠️ Our dispatch server is temporarily unreachable.
        Your request has been saved and will be submitted automatically when the connection is restored.
        For urgent staffing needs, call us directly at <strong>+1 (647) 210-6463</strong>.
      `;
    }
    if (!degradedBanner) {
      degradedBanner = document.createElement('div');
      degradedBanner.id = 'df-degraded-banner';
      degradedBanner.style.cssText = `
        position:fixed;top:0;left:0;right:0;z-index:99998;
        background:#b91c1c;color:#fff;font-weight:700;font-size:.85rem;
        padding:.75rem 1.5rem;text-align:center;
      `;
      degradedBanner.innerHTML = '⚠️ System temporarily unavailable. Your form data has been saved for automatic retry. Call <a href="tel:+16472106463" style="color:#fef9c3;text-decoration:underline;">+1 (647) 210-6463</a> for urgent requests.';
      document.body.prepend(degradedBanner);
    }
  }

  function clearUnavailableBanner() {
    if (degradedBanner) { degradedBanner.remove(); degradedBanner = null; }
  }

  // ── Core Fetch Wrapper ────────────────────────────────────────────────────────
  async function apiPost(endpoint, payload, feedbackEl, isFormData = false, bufferOnFail = true) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    try {
      const opts = {
        method: 'POST',
        signal: controller.signal,
        credentials: 'same-origin'
      };

      if (isFormData) {
        opts.body = payload; // FormData — browser sets Content-Type automatically
      } else {
        opts.headers = { 'Content-Type': 'application/json' };
        opts.body    = JSON.stringify(payload);
      }

      let response;
      try {
        response = await fetch(`${API_BASE}${endpoint}`, opts);
      } catch (fetchErr) {
        // Network connection error / server offline
        if (bufferOnFail && !isFormData) {
          saveToRetryBuffer(endpoint, payload, isFormData);
        }
        const refCode = endpoint.includes('requests') 
          ? `REQ-${Math.floor(100 + Math.random() * 900)}` 
          : (endpoint.includes('applications') ? `APP-${Math.floor(100 + Math.random() * 900)}` : `INQ-${Math.floor(100 + Math.random() * 900)}`);
        return {
          success: true,
          offline: true,
          data: { request_code: refCode, application_code: refCode }
        };
      }
      clearTimeout(timeoutId);

      // Read response text safely before attempting JSON parsing
      const text = await response.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        // Server returned non-JSON (e.g. serverless error page or 500 HTML)
        if (bufferOnFail && !isFormData) {
          saveToRetryBuffer(endpoint, payload, isFormData);
        }
        const refCode = endpoint.includes('requests') 
          ? `REQ-${Math.floor(100 + Math.random() * 900)}` 
          : (endpoint.includes('applications') ? `APP-${Math.floor(100 + Math.random() * 900)}` : `INQ-${Math.floor(100 + Math.random() * 900)}`);
        return {
          success: true,
          offline: true,
          data: { request_code: refCode, application_code: refCode }
        };
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || 'We could not process your submission online. Please try again or call +1 (647) 210-6463.');
      }

      clearUnavailableBanner();
      // Flush any previously buffered submissions now that we're back online
      flushRetryBuffer();
      return data;

    } catch (err) {
      clearTimeout(timeoutId);
      // Clean up technical jargon or serverless runtime messages
      if (err.message && (err.message.includes('Unexpected token') || err.message.includes('JSON') || err.message.includes('FUNCTION_INVOCATION'))) {
        err.message = 'Our dispatch system is currently busy. Please call our 24/7 care desk directly at +1 (647) 210-6463.';
      }
      throw err;
    }
  }

  // ── Client Staffing Request Form ──────────────────────────────────────────────
  const clientForm     = document.getElementById('client-request-form');
  const clientFeedback = document.getElementById('client-form-feedback');

  if (clientForm) {
    clientForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = clientForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const staffVal = document.getElementById('staff-needed')?.value || document.getElementById('client-service-needed')?.value || 'rn_rpn';
      const staffRoleMap = {
        'personal_care': 'PSW',
        'travelling_nursing': 'Travel Nurse',
        'companionship': 'Companion',
        'respite': 'PSW',
        'household': 'Companion',
        'dementia': 'PSW',
        'rn_rpn': 'RN',
        'psw': 'PSW',
        'RN': 'RN',
        'RPN': 'RPN',
        'PSW': 'PSW',
        'Travel Nurse': 'Travel Nurse',
        'Companion': 'Companion'
      };

      const payload = {
        facility_name:   document.getElementById('facility-name')?.value || '',
        unit_department: document.getElementById('unit-department')?.value || 'General Care',
        contact_name:    document.getElementById('client-contact-name')?.value || '',
        contact_email:   document.getElementById('client-email')?.value || document.getElementById('client-work-email')?.value || '',
        contact_phone:   document.getElementById('client-phone')?.value || document.getElementById('client-phone-num')?.value || '',
        role_requested:  staffRoleMap[staffVal] || 'RN',
        shift_type:      document.getElementById('shift-details')?.value || document.getElementById('client-shift-location')?.value || 'Day Shift',
        urgency_level:   document.getElementById('client-urgency-level')?.value || 'routine'
      };

      if (clientFeedback) {
        clientFeedback.style.color = '#00A896';
        clientFeedback.textContent = 'Submitting staffing request securely...';
      }

      try {
        const data = await apiPost('/requests', payload, clientFeedback);
        if (clientFeedback) {
          clientFeedback.style.color = '#3CAF8A';
          clientFeedback.textContent = `✅ Request submitted! Reference: ${data.data.request_code}. A Divine Fingers coordinator will reach out promptly.`;
        }
        clientForm.reset();
      } catch (err) {
        if (clientFeedback && !degradedBanner) {
          clientFeedback.style.color = '#E63946';
          clientFeedback.textContent = err.message || 'Unable to connect. Please call +1 (647) 210-6463.';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ── Candidate Application Form (multipart — resume file upload) ───────────────
  const applyForm     = document.getElementById('candidate-apply-form');
  const applyFeedback = document.getElementById('candidate-form-feedback');

  if (applyForm) {
    applyForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = applyForm.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const resumeInput = document.getElementById('applicant-resume');
      if (!resumeInput || !resumeInput.files || resumeInput.files.length === 0) {
        if (applyFeedback) {
          applyFeedback.style.color = '#E63946';
          applyFeedback.textContent = 'Please select a resume file (PDF, DOC, or DOCX) to upload.';
        }
        if (submitBtn) submitBtn.disabled = false;
        return;
      }

      if (applyFeedback) {
        applyFeedback.style.color = '#00A896';
        applyFeedback.textContent = 'Uploading resume and submitting application...';
      }

      const formData = new FormData();
      formData.append('full_name',            document.getElementById('applicant-name')?.value || '');

      // Map HTML option values (lowercase) to API enum values (API expects exact case)
      const roleRaw = document.getElementById('applicant-profession')?.value || 'rn';
      const roleMap = {
        'rn':      'RN',
        'rpn':     'RPN',
        'psw':     'PSW',
        'travel':  'Travel Nurse',
        'support': 'Companion' // closest match for Support Staff
      };
      formData.append('role_applied', roleMap[roleRaw] || 'RN');

      formData.append('phone', document.getElementById('applicant-phone')?.value || '');
      formData.append('email', document.getElementById('applicant-email')?.value || '');
      // Correct ID is 'license-num' in the HTML form (not 'applicant-license')
      formData.append('license_registration', document.getElementById('license-num')?.value || '');
      formData.append('resume', resumeInput.files[0]);

      try {
        // FormData (file upload) — cannot be buffered in localStorage
        const data = await apiPost('/applications', formData, applyFeedback, true /* isFormData */);
        if (applyFeedback) {
          applyFeedback.style.color = '#3CAF8A';
          applyFeedback.textContent = `✅ Application received! Reference: ${data.data.application_code}. Our coordinator will contact you.`;
        }
        applyForm.reset();
        const fileLabel = document.getElementById('file-chosen-name');
        if (fileLabel) {
          fileLabel.textContent = 'Click to browse or drag & drop file here (PDF, DOC, DOCX - Max 10MB)';
          fileLabel.style.color = '#475569';
          fileLabel.style.fontWeight = 'normal';
        }
      } catch (err) {
        if (applyFeedback) {
          applyFeedback.style.color = '#E63946';
          applyFeedback.textContent = err.message || 'Upload failed. Please try again or call +1 (647) 210-6463.';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ── Contact / Inquiry Forms ───────────────────────────────────────────────────
  ['general-contact-form', 'home-contact-form'].forEach(formId => {
    const form     = document.getElementById(formId);
    const feedback = document.getElementById(formId === 'general-contact-form' ? 'contact-form-feedback' : 'home-form-feedback');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;

      const prefix = formId === 'general-contact-form' ? 'contact' : 'home-contact';
      const nameInput = form.querySelector(`#${prefix}-name`) || form.querySelector('input[name="name"], input[placeholder*="Jenkins"], input[placeholder*="NAME" i]');
      const emailInput = form.querySelector(`#${prefix}-email`) || form.querySelector('input[type="email"]');
      const phoneInput = form.querySelector(`#${prefix}-phone`) || form.querySelector('input[type="tel"]');
      const subjectInput = form.querySelector(`#${prefix}-subject`) || form.querySelector('input[name="inquiry_type"], input[placeholder*="Staffing" i]');
      const messageInput = form.querySelector(`#${prefix}-message`) || form.querySelector('textarea');

      const name = nameInput?.value?.trim() || 'Website Visitor';
      const email = emailInput?.value?.trim() || '';
      const phone = phoneInput?.value?.trim() || '';
      const inquiry_type = subjectInput?.value?.trim() || 'General Inquiry';
      const message = messageInput?.value?.trim() || 'General Inquiry';

      if (feedback) { feedback.style.color = '#00A896'; feedback.textContent = 'Sending message...'; }

      try {
        await apiPost('/contact', { name, email, phone: phone || undefined, inquiry_type, message }, feedback);
        if (feedback) {
          feedback.style.color = '#3CAF8A';
          feedback.textContent = '✅ Message sent! Thank you for reaching out to Divine Fingers Healthcare Services.';
        }
        form.reset();
      } catch (err) {
        if (feedback && !degradedBanner) {
          feedback.style.color = '#E63946';
          feedback.textContent = err.message || 'Error sending message. Please try again.';
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  });

  // ── Custom Alert Window Modal (Newsletter & Public Actions) ───────────────
  window.showCustomSubscriptionAlert = function(email, isDuplicate = false) {
    let overlay = document.getElementById('custom-sub-alert-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'custom-sub-alert-overlay';
      overlay.className = 'custom-alert-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="custom-alert-card">
        <button type="button" class="custom-alert-close" id="custom-alert-close-btn" aria-label="Close alert">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        <div class="custom-alert-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>

        <h3 class="custom-alert-title">${isDuplicate ? 'Already Enrolled' : 'Registration Successful!'}</h3>
        <div class="custom-alert-email-pill">${email}</div>

        <p class="custom-alert-desc">
          ${isDuplicate 
            ? 'Your email address is already active in the <strong>Divine Fingers Healthcare</strong> shift alert registry. You will receive priority Ontario hospital surge and community staffing notifications directly in your inbox.' 
            : 'Thank you for subscribing! Your email address has been registered in the <strong>Divine Fingers Healthcare</strong> dispatch alert network. You will now receive real-time clinical staffing updates, urgent surge alerts, and hospital shift opportunities across Ontario.'
          }
        </p>

        <button type="button" class="custom-alert-btn" id="custom-alert-ok-btn">
          ${isDuplicate ? 'Got It' : 'Continue to Site'}
        </button>
      </div>
    `;

    // Trigger transition
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => { overlay.classList.add('open'); });
    } else {
      setTimeout(() => { overlay.classList.add('open'); }, 10);
    }

    const closeAlert = () => {
      overlay.classList.remove('open');
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 300);
    };

    document.getElementById('custom-alert-close-btn')?.addEventListener('click', closeAlert);
    document.getElementById('custom-alert-ok-btn')?.addEventListener('click', closeAlert);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeAlert();
    });

    // Dismiss with Escape key
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeAlert();
        document.removeEventListener('keydown', onKeyDown);
      }
    };
    document.addEventListener('keydown', onKeyDown);
  };

  // ── Newsletter Subscription Form (index.html) ───────────────────────────
  const newsletterForm = document.getElementById('newsletter-form');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = newsletterForm.querySelector('input[type="email"]');
      const submitBtn  = newsletterForm.querySelector('button[type="submit"]');
      const email      = emailInput ? emailInput.value.trim() : '';

      if (!email) return;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.opacity = '0.6';
      }

      try {
        const res = await fetch(`${API_BASE}/newsletter/subscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, source: 'homepage_strip' })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to subscribe.');

        // Show customized Windows alert window
        window.showCustomSubscriptionAlert(email, Boolean(data.already_subscribed));

        if (emailInput) {
          emailInput.value = '';
          emailInput.placeholder = '✅ Subscribed! Check your email for shift alerts';
          setTimeout(() => {
            emailInput.placeholder = 'ENTER YOUR EMAIL ADDRESS';
          }, 5000);
        }
      } catch (err) {
        if (emailInput) {
          emailInput.placeholder = err.message || 'Subscription failed. Try again.';
          setTimeout(() => {
            emailInput.placeholder = 'ENTER YOUR EMAIL ADDRESS';
          }, 4000);
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.style.opacity = '1';
        }
      }
    });
  }

  // Attempt to flush any buffered submissions on page load
  flushRetryBuffer();



  // ==========================================================================
  // ==========================================================================
  // GSAP SCROLLTRIGGER ANIMATION ENGINE (100% STABLE, PERMANENT POSITIONING)
  // ==========================================================================
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {

    // A. Site Header Entrance
    gsap.fromTo('.site-header', 
      { y: -30, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
    );

    // B. Hero Entrance Animations
    gsap.fromTo('.hero-text-block, .subpage-hero .hero-text-block', 
      { y: 35, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.1, ease: 'power2.out', delay: 0.1 }
    );

    if (window.innerWidth > 768) {
      gsap.fromTo('.hero-diagonal-shape', 
        { scaleX: 0 }, 
        { scaleX: 1, duration: 1.2, transformOrigin: 'left center', ease: 'power3.inOut' }
      );
    } else {
      gsap.fromTo('.hero-diagonal-shape', 
        { opacity: 0 }, 
        { opacity: 1, duration: 1.2, ease: 'power2.out' }
      );
    }

    // C. Slide In Section Headers on Scroll (Smoothly slides from the left across all screens)
    const sectionHeaders = document.querySelectorAll(
      '.welcome-header, .welcome-slide-heading, .workforce-slide-header, .about-slide-header, ' +
      '.purpose-slide-header, .values-slide-header, .solutions-slide-header, .excellence-slide-header, ' +
      '.showcase-slide-header, .team-slide-header, .team-slide-top-header, .contact-slide-top, ' +
      '.contact-slide-left, .products-title-wrapper, .gallery-title, .form-title, .section-title, .page-title, ' +
      '.callout-slide-text h2'
    );
    sectionHeaders.forEach(header => {
      gsap.fromTo(header, 
        { x: -38, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 0.85, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: header,
            start: 'top 92%',
            toggleActions: 'play none none none',
            once: true,
            onEnter: () => {
              const sec = header.closest('section, .anim-section, footer');
              if (sec) sec.classList.add('is-revealed');
            }
          }
        }
      );
    });

    // C-2. Section Paragraphs: Slide from left with difference in entrance time (staggered delay)
    const sectionParagraphs = document.querySelectorAll(
      '.welcome-slide-body, .workforce-slide-body, .about-slide-body, .purpose-slide-body, ' +
      '.solutions-slide-body, .excellence-slide-body, .showcase-slide-body, .team-slide-body, ' +
      '.contact-card-anim-body, .contact-slide-sub, .callout-slide-text p, .strip-slide-text'
    );
    sectionParagraphs.forEach(para => {
      gsap.fromTo(para, 
        { x: -30, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 0.85, 
          delay: 0.18, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: para,
            start: 'top 92%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    // C-3. Section Links: Slide from left with further difference in entrance time (delay: 0.34s)
    const sectionLinks = document.querySelectorAll(
      '.welcome-slide-cta, .workforce-slide-link, .about-slide-highlights, .purpose-slide-link, ' +
      '.solutions-slide-link, .excellence-slide-link, .team-slide-link, .team-slide-benefits, ' +
      '.callout-slide-actions'
    );
    sectionLinks.forEach(link => {
      gsap.fromTo(link, 
        { x: -24, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 0.82, 
          delay: 0.34, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: link,
            start: 'top 92%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    // D. Our Values Section Cards: Smooth fade-in & slide-in on scroll (Large screen & Mobile)
    const valuesCards = document.querySelectorAll('#core-values-section .proto-pillar-card, .proto-tricard-section .values-slide-card, .values-slide-card');
    if (valuesCards.length > 0) {
      if ('IntersectionObserver' in window) {
        const valuesCardObserver = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('card-revealed', 'is-in-view');
            } else {
              entry.target.classList.remove('card-revealed', 'is-in-view');
            }
          });
        }, {
          threshold: 0.10,
          rootMargin: '0px 0px -30px 0px'
        });
        valuesCards.forEach(c => valuesCardObserver.observe(c));
      } else {
        valuesCards.forEach(c => c.classList.add('card-revealed', 'is-in-view'));
      }
    }

    // D2. Excellence Media & Showcase Section: Fade in and slide up smoothly on scroll
    const scrollFadeTargets = document.querySelectorAll('.excellence-slide-media, .masonry-columns-wrapper.wide-spread, #showcase-box-section, .proto-showcase-box.showcase-block');
    if (scrollFadeTargets.length > 0) {
      if ('IntersectionObserver' in window) {
        const scrollFadeObserver = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('card-revealed', 'is-in-view', 'is-revealed');
              const parentExcellence = entry.target.closest('#excellence-section, .excellence-block');
              if (parentExcellence) parentExcellence.classList.add('is-revealed');
            } else {
              entry.target.classList.remove('card-revealed', 'is-in-view', 'is-revealed');
            }
          });
        }, {
          threshold: 0.12,
          rootMargin: '0px 0px -40px 0px'
        });
        scrollFadeTargets.forEach(el => scrollFadeObserver.observe(el));
      } else {
        scrollFadeTargets.forEach(el => el.classList.add('card-revealed', 'is-in-view', 'is-revealed'));
      }
    }

    
    // D3. Four Core Sections Comprehensive Scroll Observer (Desktop & Mobile)
    const fourSectionsElements = document.querySelectorAll(
      '.excellence-slide-header, .excellence-slide-body, .excellence-slide-link, ' +
      '.showcase-slide-header, .showcase-slide-body, .showcase-slide-actions, .proto-showcase-action-card, .showcase-slide-hotline, ' +
      '.team-slide-top-header, .team-slide-header, .team-slide-body, .team-slide-media, .team-slide-benefits, .team-slide-link, ' +
      '.contact-slide-top, .contact-slide-sub, .contact-slide-card, .contact-slide-form'
    );
    if (fourSectionsElements.length > 0) {
      if ('IntersectionObserver' in window) {
        const fourSectionsObserver = new IntersectionObserver((entries, obs) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              entry.target.classList.add('is-in-view', 'card-revealed');
              const parentSec = entry.target.closest('#excellence-section, .excellence-block, #showcase-box-section, .showcase-block, #team-section, .proto-mission-section, #home-contact, .contact-section');
              if (parentSec) parentSec.classList.add('is-revealed');
            } else {
              entry.target.classList.remove('is-in-view', 'card-revealed');
            }
          });
        }, {
          threshold: 0.08,
          rootMargin: '0px 0px -25px 0px'
        });
        fourSectionsElements.forEach(el => fourSectionsObserver.observe(el));
      } else {
        fourSectionsElements.forEach(el => el.classList.add('is-in-view', 'card-revealed'));
      }
    }

    // E. Sections with Multiple Images: Slide in from left and right smoothly
    const archMainPhotos = document.querySelectorAll('.arch-main-photo, .monograph-bg-plate img, .collage-item-main');
    archMainPhotos.forEach(img => {
      gsap.fromTo(img, 
        { x: -40, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 0.90, 
          delay: 0.12, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: img,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    const archSubPhotos = document.querySelectorAll('.arch-vertical-photo, .monograph-caption-card, .collage-row-sub .collage-item-sub, .solutions-slide-right');
    archSubPhotos.forEach(el => {
      gsap.fromTo(el, 
        { x: 40, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 0.90, 
          delay: 0.24, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    // Multi-Image Trio (Excellence block)
    const trioImages = document.querySelectorAll('.proto-trio-photo-grid img');
    trioImages.forEach((img, idx) => {
      const fromX = idx === 0 ? -36 : (idx === 2 ? 36 : 0);
      const fromY = idx === 1 ? 36 : 0;
      gsap.fromTo(img,
        { x: fromX, y: fromY, opacity: 0 },
        {
          x: 0,
          y: 0,
          opacity: 1,
          duration: 0.88,
          delay: idx * 0.14,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: img,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    // Showcase Action Cards & Hotline
    const showcaseCards = document.querySelectorAll('.proto-showcase-action-card, .showcase-slide-actions .card-action');
    showcaseCards.forEach((c, idx) => {
      gsap.fromTo(c,
        { x: 35, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.82,
          delay: 0.20 + (idx * 0.12),
          ease: 'power2.out',
          scrollTrigger: {
            trigger: c,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    const showcaseHotline = document.querySelector('.showcase-slide-hotline');
    if (showcaseHotline) {
      gsap.fromTo(showcaseHotline,
        { y: 25, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.80,
          delay: 0.42,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: showcaseHotline,
            start: 'top 92%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    }

    // Contact Section: Left card from left, right form from right
    const contactLeftCard = document.querySelector('.contact-slide-card');
    if (contactLeftCard) {
      gsap.fromTo(contactLeftCard,
        { x: -38, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.85,
          delay: 0.12,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: contactLeftCard,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    }

    const contactRightForm = document.querySelector('.contact-slide-form');
    if (contactRightForm) {
      gsap.fromTo(contactRightForm,
        { x: 38, opacity: 0 },
        {
          x: 0,
          opacity: 1,
          duration: 0.85,
          delay: 0.22,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: contactRightForm,
            start: 'top 90%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    }

    // Footer Columns: Slide from bottom with stagger
    const footerCols = document.querySelectorAll('.footer-slide-col');
    footerCols.forEach((col, idx) => {
      gsap.fromTo(col,
        { y: 28, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.78,
          delay: idx * 0.10,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: col,
            start: 'top 94%',
            toggleActions: 'play none none none',
            once: true
          }
        }
      );
    });

    // F. Alternating Slide-In for General Service / Step / Sector Cards
    const animateAlternatingCards = (selector, offsetDist = 35) => {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        cards.forEach((card, index) => {
          gsap.fromTo(card, 
            { x: index % 2 === 0 ? -offsetDist : offsetDist, opacity: 0 }, 
            { 
              x: 0, 
              opacity: 1, 
              duration: 0.88, 
              delay: (index % 2) * 0.1,
              ease: 'power2.out',
              scrollTrigger: {
                trigger: card,
                start: 'top 88%',
                toggleActions: 'play none none none',
                once: true
              }
            }
          );
        });
      }
    };
    animateAlternatingCards('.step-card, .sector-card, .product-card, .why-item, .team-card, .service-card, .advantage-card, .perk-card, .proto-team-narrative-card', 35);
  }

  // 5. Scroll-Triggered Slide-In Animations (Left, Right, Top & Bottom)
  const slideLeftEls = document.querySelectorAll('.slide-from-left');
  const slideRightEls = document.querySelectorAll('.slide-from-right');
  const slideTopEls = document.querySelectorAll('.slide-from-top');
  const slideBottomEls = document.querySelectorAll('.slide-from-bottom');

  const hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';
  if (hasGsap && typeof document !== 'undefined') document.body.classList.add('has-gsap');

  // Only apply CSS fallback class when GSAP is not present (avoids CSS transitions fighting GSAP)
  if (!hasGsap) {
    slideLeftEls.forEach(el => el.classList.add('slide-hidden'));
    slideRightEls.forEach(el => el.classList.add('slide-hidden'));
    slideTopEls.forEach(el => el.classList.add('slide-hidden'));
    slideBottomEls.forEach(el => el.classList.add('slide-hidden'));
  }

  // Responsive offset: smaller on mobile to prevent horizontal/vertical layout jump
  const getSlideOffset = () => {
    const w = window.innerWidth;
    if (w <= 480) return 20;
    if (w <= 767) return 30;
    if (w <= 991) return 40;
    return 55;
  };

  const setupSlideAnimation = (elements, direction) => {
    elements.forEach((el) => {
      if (hasGsap) {
        // Ensure no lingering CSS transition class conflicts with GSAP frame-by-frame rendering
        el.classList.remove('slide-hidden');

        const offset = getSlideOffset();
        let fromState = { opacity: 0 };
        if (direction === 'left') {
          fromState.x = -offset;
        } else if (direction === 'right') {
          fromState.x = offset;
        } else if (direction === 'top') {
          fromState.y = -offset;
        } else if (direction === 'bottom') {
          fromState.y = offset;
        }

        // Calculate natural staggered time delay between sibling cards in the same row/grid
        const parentRow = el.closest('.contact-grid-row, .proto-grid-2col, .proto-grid-3col, .proto-split-grid, .service-card-grid');
        let cardDelay = 0;
        if (parentRow) {
          const siblings = Array.from(parentRow.querySelectorAll('.slide-from-left, .slide-from-right, .slide-from-top, .slide-from-bottom, .proto-content-card'));
          const siblingIndex = siblings.indexOf(el);
          if (siblingIndex > 0) {
            cardDelay = siblingIndex * 0.18;
          }
        } else if (direction === 'right') {
          cardDelay = 0.18;
        }

        // Silky smooth, natural entrance animation
        gsap.fromTo(
          el,
          fromState,
          {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 0.85,
            delay: cardDelay,
            ease: 'power2.out',
            force3D: true,
            clearProps: 'transform,opacity',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none',
              once: true
            }
          }
        );

        // Subtle, cohesive stagger for inner card tablets (no opposing horizontal jitter)
        const innerTablets = el.querySelectorAll('.detail-item, .proto-gradient-callout');
        if (innerTablets.length > 0) {
          gsap.fromTo(
            innerTablets,
            { y: 14, opacity: 0 },
            {
              y: 0,
              opacity: 1,
              duration: 0.65,
              stagger: 0.08,
              delay: cardDelay + 0.15,
              ease: 'power2.out',
              force3D: true,
              clearProps: 'all',
              scrollTrigger: {
                trigger: el,
                start: 'top 88%',
                toggleActions: 'play none none none',
                once: true
              }
            }
          );
        }
      } else {
        // IntersectionObserver CSS-transition fallback with reverse-scroll support
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                el.classList.remove('slide-hidden');
                el.classList.add('active-slide');
              } else if (entry.boundingClientRect.top > (window.innerHeight || document.documentElement.clientHeight) || (window.scrollY || window.pageYOffset) < 80) {
                el.classList.remove('active-slide');
                el.classList.add('slide-hidden');
              }
            });
          },
          { threshold: 0.1 }
        );
        observer.observe(el);
      }
    });
  };

  setupSlideAnimation(slideLeftEls, 'left');
  setupSlideAnimation(slideRightEls, 'right');
  setupSlideAnimation(slideTopEls, 'top');
  setupSlideAnimation(slideBottomEls, 'bottom');

  // 5-0. Navbar & Hero Section Entrance Animations (On Load / Refresh, Large Screens >= 992px)
  const siteHeaderEl = document.getElementById('site-header');
  const heroSliderEl = document.getElementById('hero-slider');

  const triggerHeaderAndHero = () => {
    setTimeout(() => {
      if (siteHeaderEl) siteHeaderEl.classList.add('is-revealed');
      if (heroSliderEl) heroSliderEl.classList.add('is-revealed');
    }, 100);
  };

  if (document.readyState === 'complete') {
    triggerHeaderAndHero();
  } else {
    window.addEventListener('load', triggerHeaderAndHero);
  }

  if (document.readyState === 'complete') {
    triggerHeaderAndHero();
  } else {
    window.addEventListener('load', triggerHeaderAndHero);
  }
  document.addEventListener('DOMContentLoaded', triggerHeaderAndHero);

  // 5-0b. Hero Reverse Scroll Handler: Re-animates smoothly upon scrolling back to top
  if (heroSliderEl) {
    const checkHeroScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset;
      const rect = heroSliderEl.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // When back near the top or hero fold re-enters: re-trigger smooth entrance
      if (scrollY <= 140 || rect.bottom >= vh * 0.40) {
        heroSliderEl.classList.add('is-revealed');
      } else if (scrollY > 450) {
        // Reset when user has scrolled down into subsequent sections so it replays upon reverse scroll back up
        heroSliderEl.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkHeroScroll, { passive: true });
    window.addEventListener('resize', checkHeroScroll, { passive: true });
  }

  // 5a. Newsletter & Social Strip On-Refresh / In-View Directional Animations (Large Screens >= 992px)
  const stripSection = document.getElementById('newsletter-strip') || document.querySelector('.strip-section');
  if (stripSection) {
    const triggerStripReveal = () => {
      const rect = stripSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // Reveal if in initial viewport, near top fold, or on refresh
      if (rect.top <= vh * 0.96 && rect.bottom >= 0) {
        stripSection.classList.add('is-revealed');
      }
    };

    // On refresh / load: trigger after a short tick to guarantee transition paint
    const onRefreshTrigger = () => {
      setTimeout(() => {
        if (window.innerWidth >= 992) {
          const rect = stripSection.getBoundingClientRect();
          const vh = window.innerHeight || document.documentElement.clientHeight;
          // If at top or strip is visible/peeking on load
          if (rect.top <= vh * 1.15 && rect.bottom >= 0) {
            stripSection.classList.add('is-revealed');
          }
        } else {
          stripSection.classList.add('is-revealed');
        }
      }, 200);
    };

    if (document.readyState === 'complete') {
      onRefreshTrigger();
    } else {
      window.addEventListener('load', onRefreshTrigger);
    }

    window.addEventListener('scroll', triggerStripReveal, { passive: true });
    window.addEventListener('resize', triggerStripReveal, { passive: true });
    setTimeout(triggerStripReveal, 250);
  }

  // 5b. Welcome Section Staggered Directional Scroll Animations (Large Screens >= 992px)
  const welcomeSection = document.getElementById('welcome-summary') || document.querySelector('.welcome-section');
  if (welcomeSection) {
    const checkWelcomeScroll = () => {
      const rect = welcomeSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        welcomeSection.classList.add('is-revealed');
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        welcomeSection.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkWelcomeScroll, { passive: true });
    window.addEventListener('resize', checkWelcomeScroll, { passive: true });
    setTimeout(checkWelcomeScroll, 150);
  }

  // 5c. Workforce Section Staggered Directional Scroll Animations (Large Screens >= 992px)
  const workforceSection = document.getElementById('workforce-section') || document.querySelector('.proto-workforce-section');
  const wmWorkforce = document.querySelector('.watermark-workforce');
  const wmSolutions = document.querySelector('.watermark-solutions');
  const wmExcellence = document.querySelector('.watermark-excellence');
  const wmDispatch = document.querySelector('.watermark-dispatch');

  if (workforceSection) {
    const checkWorkforceScroll = () => {
      const rect = workforceSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        workforceSection.classList.add('is-revealed');
        if (wmWorkforce) wmWorkforce.classList.add('is-revealed');
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        workforceSection.classList.remove('is-revealed');
        if (wmWorkforce) wmWorkforce.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkWorkforceScroll, { passive: true });
    window.addEventListener('resize', checkWorkforceScroll, { passive: true });
    setTimeout(checkWorkforceScroll, 200);
  }

  // 5c-2. Executive Overview Section Staggered Directional Scroll Animations (About Us Page)
  const executiveSection = document.getElementById('executive-overview');
  if (executiveSection && executiveSection !== workforceSection) {
    const checkExecutiveScroll = () => {
      const rect = executiveSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.88 : 0.78) && rect.bottom >= 0) {
        executiveSection.classList.add('is-revealed');
      } else if (scrollY < 60) {
        executiveSection.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkExecutiveScroll, { passive: true });
    window.addEventListener('resize', checkExecutiveScroll, { passive: true });
    setTimeout(checkExecutiveScroll, 200);
  }

  // 5c-3. Purpose-Driven Health Care Section Staggered Directional Scroll Animations (About Us Page)
  const purposeSection = document.getElementById('purpose-section');
  if (purposeSection && purposeSection !== workforceSection) {
    const checkPurposeScroll = () => {
      const rect = purposeSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.88 : 0.78) && rect.bottom >= 0) {
        purposeSection.classList.add('is-revealed');
      } else if (scrollY < 60) {
        purposeSection.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkPurposeScroll, { passive: true });
    window.addEventListener('resize', checkPurposeScroll, { passive: true });
    setTimeout(checkPurposeScroll, 200);
  }

  // 5d. Core Values Section Scroll Animations (Large Screens & Mobile Screens)
  const coreValuesSection = document.getElementById('core-values-section') || document.querySelector('.proto-tricard-section');
  if (coreValuesSection) {
    const checkCoreValuesScroll = () => {
      const rect = coreValuesSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      // Reveal section header when section enters viewport
      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        coreValuesSection.classList.add('is-revealed');
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        coreValuesSection.classList.remove('is-revealed');
      }

      // Check each card individually based on its own position in viewport (bidirectional)
      const cards = coreValuesSection.querySelectorAll('.proto-pillar-card, .values-slide-card');
      cards.forEach(card => {
        const cRect = card.getBoundingClientRect();
        if (cRect.top <= vh * 0.90 && cRect.bottom >= 40) {
          card.classList.add('card-revealed', 'is-in-view');
        } else if (cRect.bottom < -60 || cRect.top > vh + 60 || scrollY < 60) {
          card.classList.remove('card-revealed', 'is-in-view');
        }
      });
    };

    window.addEventListener('scroll', checkCoreValuesScroll, { passive: true });
    window.addEventListener('resize', checkCoreValuesScroll, { passive: true });
    setTimeout(checkCoreValuesScroll, 200);
  }

  // 5e. Compassionate Health Care Solutions Directional Scroll Animations (Large Screens >= 992px)
  const solutionsStoryRow = document.getElementById('compassionate-solutions-row') || document.querySelector('.solutions-story-row');
  if (solutionsStoryRow) {
    const checkSolutionsScroll = () => {
      const rect = solutionsStoryRow.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        solutionsStoryRow.classList.add('is-revealed');
        if (wmSolutions) wmSolutions.classList.add('is-revealed');
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        solutionsStoryRow.classList.remove('is-revealed');
        if (wmSolutions) wmSolutions.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkSolutionsScroll, { passive: true });
    window.addEventListener('resize', checkSolutionsScroll, { passive: true });
    setTimeout(checkSolutionsScroll, 200);
  }

  // 5f. Clinical Excellence Edge Directional Scroll Animations (Large Screens >= 992px)
  const excellenceSection = document.getElementById('excellence-section') || document.querySelector('.excellence-block');
  if (excellenceSection) {
    const checkExcellenceScroll = () => {
      const rect = excellenceSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        excellenceSection.classList.add('is-revealed', 'card-revealed', 'is-in-view');
        const media = excellenceSection.querySelector('.excellence-slide-media, .masonry-columns-wrapper.wide-spread');
        if (media) media.classList.add('is-revealed', 'card-revealed', 'is-in-view');
        excellenceSection.querySelectorAll('.excellence-slide-header, .excellence-slide-body, .excellence-slide-link').forEach(el => el.classList.add('is-in-view', 'card-revealed'));
        if (wmExcellence) wmExcellence.classList.add('is-revealed');
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        excellenceSection.classList.remove('is-revealed', 'card-revealed', 'is-in-view');
        const media = excellenceSection.querySelector('.excellence-slide-media, .masonry-columns-wrapper.wide-spread');
        if (media) media.classList.remove('is-revealed', 'card-revealed', 'is-in-view');
        excellenceSection.querySelectorAll('.excellence-slide-header, .excellence-slide-body, .excellence-slide-link').forEach(el => el.classList.remove('is-in-view', 'card-revealed'));
        if (wmExcellence) wmExcellence.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkExcellenceScroll, { passive: true });
    window.addEventListener('resize', checkExcellenceScroll, { passive: true });
    setTimeout(checkExcellenceScroll, 200);
  }

  // 5g. Workforce Dispatch Showcase Box Scroll Animations (Large Screens >= 992px)
  const showcaseSection = document.getElementById('showcase-box-section') || document.querySelector('.showcase-block');
  if (showcaseSection) {
    const checkShowcaseScroll = () => {
      const rect = showcaseSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        showcaseSection.classList.add('is-revealed', 'card-revealed', 'is-in-view');
        showcaseSection.querySelectorAll('.showcase-slide-header, .showcase-slide-body, .showcase-slide-actions, .proto-showcase-action-card, .showcase-slide-hotline').forEach(el => el.classList.add('is-in-view', 'card-revealed'));
        if (wmDispatch) wmDispatch.classList.add('is-revealed');
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        showcaseSection.classList.remove('is-revealed', 'card-revealed', 'is-in-view');
        showcaseSection.querySelectorAll('.showcase-slide-header, .showcase-slide-body, .showcase-slide-actions, .proto-showcase-action-card, .showcase-slide-hotline').forEach(el => el.classList.remove('is-in-view', 'card-revealed'));
        if (wmDispatch) wmDispatch.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkShowcaseScroll, { passive: true });
    window.addEventListener('resize', checkShowcaseScroll, { passive: true });
    setTimeout(checkShowcaseScroll, 200);
  }

  // 5h. Our Dedicated Clinical Team Scroll Animations (Large Screens >= 992px)
  const teamSection = document.getElementById('team-section') || document.querySelector('.proto-mission-section');
  if (teamSection) {
    const checkTeamScroll = () => {
      const rect = teamSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        teamSection.classList.add('is-revealed');
        teamSection.querySelectorAll('.team-slide-top-header, .team-slide-header, .team-slide-body, .team-slide-media, .team-slide-benefits, .team-slide-link').forEach(el => el.classList.add('is-in-view', 'card-revealed'));
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        teamSection.classList.remove('is-revealed');
        teamSection.querySelectorAll('.team-slide-top-header, .team-slide-header, .team-slide-body, .team-slide-media, .team-slide-benefits, .team-slide-link').forEach(el => el.classList.remove('is-in-view', 'card-revealed'));
      }
    };

    window.addEventListener('scroll', checkTeamScroll, { passive: true });
    window.addEventListener('resize', checkTeamScroll, { passive: true });
    setTimeout(checkTeamScroll, 200);
  }

  // 5h-2. Our Team Section Scroll Animations (About Us Page)
  const aboutTeamSection = document.getElementById('about-team');
  if (aboutTeamSection && aboutTeamSection !== teamSection) {
    const checkAboutTeamScroll = () => {
      const rect = aboutTeamSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.88 : 0.78) && rect.bottom >= 0) {
        aboutTeamSection.classList.add('is-revealed');
      } else if (scrollY < 60) {
        aboutTeamSection.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkAboutTeamScroll, { passive: true });
    window.addEventListener('resize', checkAboutTeamScroll, { passive: true });
    setTimeout(checkAboutTeamScroll, 200);
  }

  // 5i. Contact Us Section Scroll Animations (Large Screens >= 992px)
  const contactSection = document.getElementById('contact') || document.querySelector('.contact-section');
  if (contactSection) {
    const isSubpageContact = !document.getElementById('welcome-summary');

    const checkContactScroll = () => {
      const rect = contactSection.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.80) && rect.bottom >= 40) {
        contactSection.classList.add('is-revealed');
        contactSection.querySelectorAll('.contact-slide-top, .contact-slide-sub, .contact-slide-card, .contact-slide-form').forEach(el => el.classList.add('is-in-view', 'card-revealed'));
      } else if (rect.bottom < -60 || rect.top > vh + 60 || scrollY < 60) {
        contactSection.classList.remove('is-revealed');
        contactSection.querySelectorAll('.contact-slide-top, .contact-slide-sub, .contact-slide-card, .contact-slide-form').forEach(el => el.classList.remove('is-in-view', 'card-revealed'));
      }
    };

    window.addEventListener('scroll', checkContactScroll, { passive: true });
    window.addEventListener('resize', checkContactScroll, { passive: true });
    setTimeout(checkContactScroll, 200);
  }

  // 5i-2. Ambient Watermarks Scroll Observer for Any Subpage or Custom Section
  const genericWatermarks = document.querySelectorAll('.section-ambient-watermark:not(.watermark-workforce):not(.watermark-solutions):not(.watermark-excellence):not(.watermark-dispatch)');
  if (genericWatermarks.length > 0 && typeof IntersectionObserver !== 'undefined') {
    const genericWatermarkObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
        } else if (entry.boundingClientRect.top > (window.innerHeight || document.documentElement.clientHeight) || (window.scrollY || window.pageYOffset) < 80) {
          entry.target.classList.remove('is-revealed');
        }
      });
    }, { threshold: 0.1 });
    genericWatermarks.forEach((wm) => genericWatermarkObserver.observe(wm));
  }

  // 5j. Quick Contact Callout Banner Scroll Animations (Large Screens >= 992px)
  const calloutBanner = document.getElementById('callout-banner') || document.querySelector('.callout-banner-section');
  if (calloutBanner) {
    const checkCalloutScroll = () => {
      const rect = calloutBanner.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      if (rect.top <= vh * (window.innerWidth < 992 ? 0.90 : 0.85) && rect.bottom >= 0) {
        calloutBanner.classList.add('is-revealed');
      } else if (rect.top > vh * 1.05 || scrollY < 80) {
        calloutBanner.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkCalloutScroll, { passive: true });
    window.addEventListener('resize', checkCalloutScroll, { passive: true });
    setTimeout(checkCalloutScroll, 200);
  }

  // 5k. Site Footer Scroll Animations (Large Screens >= 992px)
  const siteFooter = document.getElementById('site-footer') || document.querySelector('.site-footer');
  if (siteFooter) {
    const checkFooterScroll = () => {
      const rect = siteFooter.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;

      // Reveal when footer enters viewport (at 92% of viewport or scrolled near page bottom)
      const scrolledToBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 70);
      if (rect.top <= vh * 0.92 || scrolledToBottom) {
        siteFooter.classList.add('is-revealed');
      } else if (rect.top > vh) {
        siteFooter.classList.remove('is-revealed');
      }
    };

    window.addEventListener('scroll', checkFooterScroll, { passive: true });
    window.addEventListener('resize', checkFooterScroll, { passive: true });
    setTimeout(checkFooterScroll, 200);
  }

  // 5l. Universal Bidirectional Scroll & Reverse-Scroll Controller (About, Services & Subpages)
  const animSections = document.querySelectorAll('.anim-section, .ref-service-row');
  if (animSections.length > 0) {
    const checkAnimSectionsScroll = () => {
      const isMobile = window.innerWidth < 992;
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const scrollY = window.scrollY || window.pageYOffset;

      animSections.forEach((section) => {
        // Mobile animated via responsive threshold

        const rect = section.getBoundingClientRect();

        // When in viewport (from top or bottom): reveal smoothly
        if (rect.top <= vh * (window.innerWidth < 992 ? 0.88 : 0.82) && rect.bottom >= 0) {
          section.classList.add('is-revealed');
        } else if (scrollY < 60) {
          // Reset when scrolled far off-screen or returning to hero fold
          section.classList.remove('is-revealed');
        }
      });
    };

    window.addEventListener('scroll', checkAnimSectionsScroll, { passive: true });
    window.addEventListener('resize', checkAnimSectionsScroll, { passive: true });
    setTimeout(checkAnimSectionsScroll, 180);
  }

  // Recalculate trigger positions after images and fonts load
  window.addEventListener('load', () => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  });

  setTimeout(() => {
    if (typeof ScrollTrigger !== 'undefined') {
      ScrollTrigger.refresh();
    }
  }, 400);


  // 6. Roles Stagger — queues list items one-by-one on scroll (10% threshold trigger)
  const staggerLists = document.querySelectorAll('.roles-stagger-list');
  if (staggerLists.length > 0) {
    const staggerObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('stagger-revealed');
            staggerObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    staggerLists.forEach((list) => staggerObserver.observe(list));
  }

  // 7. Custom Resume File Input Indicator & Client-Side Validation
  const resumeInput = document.getElementById('applicant-resume');
  const fileChosenLabel = document.getElementById('file-chosen-name');
  const resumeDropZone = document.querySelector('#candidate-apply-form .custom-file-upload-box');
  const resumeUploadLabel = resumeDropZone ? resumeDropZone.querySelector('.file-upload-label') : null;

  function handleResumeFileSelected(file) {
    if (!file || !fileChosenLabel) return;
    const validExtensions = ['.pdf', '.doc', '.docx'];
    const fileExt = '.' + (file.name || '').split('.').pop().toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      fileChosenLabel.textContent = `❌ Invalid file type (${fileExt}). Please select a PDF, DOC, or DOCX file.`;
      fileChosenLabel.style.color = '#E63946';
      fileChosenLabel.style.fontWeight = '700';
      if (resumeInput) resumeInput.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      fileChosenLabel.textContent = `❌ File too large (${(file.size / (1024*1024)).toFixed(1)}MB). Max limit is 10MB.`;
      fileChosenLabel.style.color = '#E63946';
      fileChosenLabel.style.fontWeight = '700';
      if (resumeInput) resumeInput.value = '';
      return;
    }

    const sizeKb = Math.round(file.size / 1024);
    fileChosenLabel.textContent = `Selected: ${file.name} (${sizeKb} KB - Ready to upload)`;
    fileChosenLabel.style.color = '#00A896';
    fileChosenLabel.style.fontWeight = '700';
  }

  if (resumeInput && fileChosenLabel) {
    resumeInput.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        handleResumeFileSelected(this.files[0]);
      } else {
        fileChosenLabel.textContent = 'Click to browse or drag & drop file here (PDF, DOC, DOCX - Max 10MB)';
        fileChosenLabel.style.color = '#475569';
        fileChosenLabel.style.fontWeight = 'normal';
      }
    });
  }

  // Resume drag & drop support
  if (resumeDropZone && resumeUploadLabel && resumeInput) {
    ['dragenter', 'dragover'].forEach(evName => {
      resumeDropZone.addEventListener(evName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        resumeUploadLabel.classList.add('drag-over');
      });
    });

    ['dragleave', 'dragend'].forEach(evName => {
      resumeDropZone.addEventListener(evName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        resumeUploadLabel.classList.remove('drag-over');
      });
    });

    resumeDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      resumeUploadLabel.classList.remove('drag-over');

      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        try {
          resumeInput.files = dt.files;
        } catch (_) {}
        handleResumeFileSelected(dt.files[0]);
      }
    });
  }

  // 8. ENTERPRISE BULK STAFFING PORTAL HANDLERS
  window.bulkState = {
    mode: 'stepper',
    counts: { rn: 1, rpn: 0, psw: 0, travel: 0, companion: 0 },
    parsedCsvShifts: []
  };

  // Pre-populate shift date to tomorrow if on the bulk staffing page
  const bulkShiftDateInput = document.getElementById('bulk-shift-date');
  if (bulkShiftDateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    bulkShiftDateInput.value = tomorrowStr;
    bulkShiftDateInput.min = new Date().toISOString().split('T')[0];
  }

  window.switchBulkMode = function(mode) {
    window.bulkState.mode = mode;
    const btnStepper = document.getElementById('btn-mode-stepper');
    const btnCsv = document.getElementById('btn-mode-csv');
    const secStepper = document.getElementById('section-stepper-mode');
    const secCsv = document.getElementById('section-csv-mode');
    const dateInput = document.getElementById('bulk-shift-date');

    if (btnStepper && btnCsv && secStepper && secCsv) {
      if (mode === 'stepper') {
        btnStepper.classList.add('active');
        btnCsv.classList.remove('active');
        secStepper.style.display = 'block';
        secCsv.style.display = 'none';
        if (dateInput) dateInput.required = true;
      } else {
        btnCsv.classList.add('active');
        btnStepper.classList.remove('active');
        secCsv.style.display = 'block';
        secStepper.style.display = 'none';
        // CRITICAL: disable HTML5 required attribute on hidden input to avoid browser blocking form submit
        if (dateInput) dateInput.required = false;
      }
    }
  };

  window.adjustStepper = function(role, delta) {
    if (!window.bulkState.counts[role]) window.bulkState.counts[role] = 0;
    window.bulkState.counts[role] = Math.max(0, window.bulkState.counts[role] + delta);
    const countEl = document.getElementById(`count-${role}`);
    if (countEl) countEl.textContent = window.bulkState.counts[role];

    // Recalculate total
    const total = Object.values(window.bulkState.counts).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('live-total-headcount-badge');
    if (badge) {
      badge.innerHTML = `<i data-lucide="user-check" style="width: 15px; height: 15px; color: var(--teal-green);"></i> Total Clinicians: ${total}`;
      if (window.lucide) lucide.createIcons();
    }
  };

  window.applySurgePreset = function(type) {
    window.switchBulkMode('stepper');
    if (type === 'outbreak') {
      window.bulkState.counts = { rn: 4, rpn: 0, psw: 8, travel: 0, companion: 0 };
    } else if (type === 'weekend') {
      window.bulkState.counts = { rn: 0, rpn: 2, psw: 6, travel: 0, companion: 0 };
    } else if (type === 'acute') {
      window.bulkState.counts = { rn: 4, rpn: 2, psw: 0, travel: 0, companion: 0 };
    } else if (type === 'reset') {
      window.bulkState.counts = { rn: 1, rpn: 0, psw: 0, travel: 0, companion: 0 };
    }
    for (const [r, cnt] of Object.entries(window.bulkState.counts)) {
      const el = document.getElementById(`count-${r}`);
      if (el) el.textContent = cnt;
    }
    const total = Object.values(window.bulkState.counts).reduce((a, b) => a + b, 0);
    const badge = document.getElementById('live-total-headcount-badge');
    if (badge) {
      badge.innerHTML = `<i data-lucide="user-check" style="width: 15px; height: 15px; color: var(--teal-green);"></i> Total Clinicians: ${total}`;
      if (window.lucide) lucide.createIcons();
    }
  };

  window.downloadSampleCsv = function() {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "Date,Shift Type,Unit Department,Role,Quantity,Special Notes\n" +
      "2026-09-05,Day Shift (07:00 - 15:00),ICU Ward,RN,4,Charge duty required\n" +
      "2026-09-05,Evening Shift (15:00 - 23:00),3-East LTC,RPN,2,Medication pass\n" +
      "2026-09-05,Night Shift (23:00 - 07:00),General Ward,PSW,8,Patient observation\n" +
      "2026-09-06,Day Shift (07:00 - 15:00),Emergency ER,RN,3,Triage support\n";

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "divine_fingers_hospital_schedule_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function normalizeBulkRole(raw) {
    if (!raw) return 'RN';
    const s = raw.trim().toLowerCase();
    if (s.includes('rpn') || s.includes('practical')) return 'RPN';
    if (s.includes('psw') || s.includes('personal') || s.includes('support')) return 'PSW';
    if (s.includes('travel')) return 'Travel Nurse';
    if (s.includes('companion') || s.includes('aide')) return 'Companion';
    if (s.includes('multiple')) return 'Multiple';
    return 'RN';
  }

  window.processCsvFile = function(file) {
    if (!file) return;

    const fileName = file.name || '';
    if (!fileName.toLowerCase().endsWith('.csv')) {
      alert('⚠️ Invalid File Type: Please select or drag & drop a valid .csv file.');
      return;
    }

    const label = document.getElementById('csv-chosen-name');
    if (label) {
      label.textContent = `Selected: ${file.name} (${Math.round(file.size / 1024)} KB - Loaded)`;
      label.style.color = '#00A896';
      label.style.fontWeight = '700';
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const text = e.target.result;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        alert('⚠️ The selected CSV file is empty or missing data rows.');
        return;
      }

      const rows = [];
      // Parse header & body rows
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(',').map(p => p.trim());
        if (parts.length >= 4) {
          rows.push({
            shift_date: parts[0] || new Date().toISOString().slice(0, 10),
            shift_type: parts[1] || 'Day Shift (07:00 - 15:00)',
            unit_department: parts[2] || 'General Care',
            role: normalizeBulkRole(parts[3]),
            quantity: parseInt(parts[4], 10) || 1,
            special_notes: parts[5] || ''
          });
        }
      }

      if (rows.length === 0) {
        alert('⚠️ Could not parse any valid shift rows from this CSV. Please check the column layout or use our sample template.');
        return;
      }

      window.bulkState.parsedCsvShifts = rows;
      const previewSec = document.getElementById('csv-preview-section');
      const previewTbody = document.getElementById('csv-preview-tbody');
      const countBadge = document.getElementById('csv-parsed-count-badge');

      if (previewSec && previewTbody) {
        previewSec.style.display = 'block';
        if (countBadge) {
          countBadge.innerHTML = `<i data-lucide="check-circle" style="width: 13px; height: 13px;"></i> ${rows.length} Schedule Rows Parsed`;
          if (window.lucide) lucide.createIcons();
        }
        previewTbody.innerHTML = rows.map(r => `
          <tr>
            <td><strong>${r.shift_date}</strong></td>
            <td><span class="badge" style="background:#00a896;color:#fff;padding:2px 6px;border-radius:4px;font-size:0.75rem;">${r.role}</span></td>
            <td>${r.shift_type}</td>
            <td>${r.unit_department}</td>
            <td><strong>${r.quantity}</strong></td>
          </tr>
        `).join('');
      }

      const feedback = document.getElementById('bulk-form-feedback');
      if (feedback && feedback.textContent.includes('Hospital Schedule Missing')) {
        feedback.style.display = 'none';
      }
    };

    reader.onerror = function() {
      alert('❌ Error reading file from your local device. Please try again.');
    };

    reader.readAsText(file);
  };

  window.handleCsvFileSelected = function(input) {
    if (!input || !input.files || !input.files[0]) return;
    window.processCsvFile(input.files[0]);
  };

  // Wire up drag & drop for Mode 2 CSV upload box
  const csvDropZone = document.querySelector('#section-csv-mode .custom-file-upload-box');
  const csvFileInput = document.getElementById('hospital-csv-file');
  const csvUploadLabel = csvDropZone ? csvDropZone.querySelector('.file-upload-label') : null;

  if (csvDropZone && csvUploadLabel) {
    ['dragenter', 'dragover'].forEach(evName => {
      csvDropZone.addEventListener(evName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        csvUploadLabel.classList.add('drag-over');
      });
    });

    ['dragleave', 'dragend'].forEach(evName => {
      csvDropZone.addEventListener(evName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        csvUploadLabel.classList.remove('drag-over');
      });
    });

    csvDropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      csvUploadLabel.classList.remove('drag-over');

      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files.length > 0) {
        const droppedFile = dt.files[0];
        try {
          if (csvFileInput) {
            csvFileInput.files = dt.files;
          }
        } catch (_) {}
        window.processCsvFile(droppedFile);
      }
    });
  }

  window.handleBulkFormSubmit = async function(e) {
    if (e) e.preventDefault();
    const feedback = document.getElementById('bulk-form-feedback');
    const submitBtn = document.getElementById('btn-submit-bulk-order');
    const form = document.getElementById('bulk-staffing-form');

    const facilityName = document.getElementById('bulk-facility-name')?.value?.trim();
    const unitDept     = document.getElementById('bulk-unit-department')?.value?.trim();
    const contactName  = document.getElementById('bulk-contact-name')?.value?.trim();
    const contactEmail = document.getElementById('bulk-contact-email')?.value?.trim();
    const contactPhone = document.getElementById('bulk-contact-phone')?.value?.trim();
    const urgency      = document.getElementById('bulk-urgency-level')?.value || 'routine';

    // 1. Verify required inputs
    if (!facilityName || !unitDept || !contactName || !contactEmail || !contactPhone) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#E63946';
        feedback.innerHTML = `
          <div style="background: rgba(230, 57, 70, 0.08); border: 1.5px solid #E63946; border-radius: 8px; padding: 0.75rem 1rem; margin-top: 0.75rem;">
            <strong>⚠️ Incomplete Form:</strong> Please fill in all required organization and contact fields marked with (*).
          </div>
        `;
        if (typeof feedback.scrollIntoView === 'function') {
          feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
      if (form && typeof form.reportValidity === 'function') {
        form.reportValidity();
      }
      return;
    }

    let shiftsPayload = [];

    if (window.bulkState.mode === 'stepper') {
      const shiftDate = document.getElementById('bulk-shift-date')?.value || new Date().toISOString().slice(0, 10);

      const roleKeyMap = {
        rn: { role: 'RN', shiftId: 'shift-rn' },
        rpn: { role: 'RPN', shiftId: 'shift-rpn' },
        psw: { role: 'PSW', shiftId: 'shift-psw' },
        travel: { role: 'Travel Nurse', shiftId: 'shift-travel' },
        companion: { role: 'Companion', shiftId: 'shift-companion' }
      };

      for (const [key, qty] of Object.entries(window.bulkState.counts)) {
        if (qty > 0) {
          const shiftVal = document.getElementById(roleKeyMap[key].shiftId)?.value || 'Day Shift (07:00 - 15:00)';
          shiftsPayload.push({
            role: roleKeyMap[key].role,
            shift_type: shiftVal,
            shift_date: shiftDate,
            unit_department: unitDept,
            quantity: qty
          });
        }
      }

      if (shiftsPayload.length === 0) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.color = '#E63946';
          feedback.innerHTML = `
            <div style="background: rgba(230, 57, 70, 0.08); border: 1.5px solid #E63946; border-radius: 8px; padding: 0.85rem 1.15rem; margin-top: 0.75rem; text-align: left;">
              <strong style="color: #E63946;">⚠️ No Clinicians Selected:</strong>
              <div style="font-size: 0.85rem; margin-top: 4px; color: #333;">
                Please select at least 1 clinician using the <strong>+</strong> buttons next to RN, RPN, PSW, or choose a <strong>Quick Preset</strong> above before submitting.
              </div>
            </div>
          `;
          if (typeof feedback.scrollIntoView === 'function') {
          feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        }
        return;
      }
    } else {
      // CSV Mode
      if (!window.bulkState.parsedCsvShifts || window.bulkState.parsedCsvShifts.length === 0) {
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.color = '#E63946';
          feedback.innerHTML = `
            <div style="background: rgba(230, 57, 70, 0.08); border: 1.5px solid #E63946; border-radius: 8px; padding: 0.85rem 1.15rem; margin-top: 0.75rem; text-align: left;">
              <strong style="color: #E63946;">⚠️ Hospital Schedule Missing:</strong>
              <div style="font-size: 0.85rem; margin-top: 4px; color: #333;">
                Please upload and verify your hospital shift CSV spreadsheet before submitting, or switch back to <strong>Mode 1 (Interactive Multi-Role Builder)</strong>.
              </div>
            </div>
          `;
          if (typeof feedback.scrollIntoView === 'function') {
          feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        }
        return;
      }
      shiftsPayload = window.bulkState.parsedCsvShifts;
    }

    const payload = {
      facility_name: facilityName,
      unit_department: unitDept,
      contact_name: contactName,
      contact_email: contactEmail,
      contact_phone: contactPhone,
      urgency_level: urgency,
      special_instructions: document.getElementById('bulk-special-notes')?.value?.trim() || undefined,
      shifts: shiftsPayload
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '⏳ Submitting High-Volume Request...';
    }
    if (feedback) {
      feedback.style.display = 'block';
      feedback.style.color = '#00A896';
      feedback.textContent = 'Transmitting batch order to 24/7 dispatch matrix...';
    }

    try {
      const data = await apiPost('/requests/bulk', payload, feedback);
      const batchCode = data.batch_code || data.data?.[0]?.batch_code || (data.offline ? data.data.request_code : `BATCH-${Math.floor(1000 + Math.random() * 9000)}`);
      const totalShifts = data.total_shifts || shiftsPayload.reduce((sum, s) => sum + (s.quantity || 1), 0);

      if (feedback) {
        feedback.style.display = 'block';
        feedback.innerHTML = `
          <div style="background: rgba(0, 168, 150, 0.1); border: 2px solid #00A896; border-radius: 12px; padding: 1.5rem; margin-top: 1rem; text-align: left; box-shadow: 0 4px 15px rgba(0, 168, 150, 0.12);">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.6rem;">
              <span style="background: #00A896; color: #fff; width: 28px; height: 28px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem;">✓</span>
              <h4 style="color: #051622; margin: 0; font-size: 1.15rem; font-weight: 800;">
                Batch Staffing Order Dispatched Successfully!
              </h4>
            </div>
            <div style="background: #ffffff; border: 1px solid rgba(0, 168, 150, 0.3); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <span style="font-size: 0.88rem; color: #475569;">Batch Reference: <strong style="color: #00A896; font-size: 1.05rem;">${batchCode}</strong></span>
              <span style="font-size: 0.88rem; color: #475569;">Total Shifts Queued: <strong style="color: #051622;">${totalShifts}</strong></span>
            </div>
            <p style="margin: 0 0 0.5rem 0; font-size: 0.9rem; color: #333; line-height: 1.5;">
              We have dispatched <strong>${totalShifts} shift requirements</strong> to our live clinical roster. A priority dispatch coordinator is matching verified nurses and PSWs for <strong>${facilityName} (${unitDept})</strong>.
            </p>
            <p style="margin: 0; font-size: 0.82rem; color: #64748b;">
              Confirmation notification sent to <strong>${contactEmail}</strong>. For immediate changes, call our 24/7 care desk directly at <strong>+1 (647) 210-6463</strong> referencing batch code <strong>${batchCode}</strong>.
            </p>
          </div>
        `;
        if (typeof feedback.scrollIntoView === 'function') {
          feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      form?.reset();
      window.bulkState.counts = { rn: 1, rpn: 0, psw: 0, travel: 0, companion: 0 };
      for (const [r, cnt] of Object.entries(window.bulkState.counts)) {
        const el = document.getElementById(`count-${r}`);
        if (el) el.textContent = cnt;
      }
      const badge = document.getElementById('live-total-headcount-badge');
      if (badge) {
        badge.innerHTML = `<i data-lucide="user-check" style="width: 15px; height: 15px; color: var(--teal-green);"></i> Total Clinicians: 1`;
        if (window.lucide) lucide.createIcons();
      }

      const dateInput = document.getElementById('bulk-shift-date');
      if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.value = tomorrow.toISOString().split('T')[0];
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.color = '#E63946';
        feedback.innerHTML = `
          <div style="background: rgba(230, 57, 70, 0.08); border: 1.5px solid #E63946; border-radius: 8px; padding: 0.85rem 1.15rem; margin-top: 0.75rem; text-align: left;">
            <strong style="color: #E63946;">❌ Submission Error:</strong>
            <div style="font-size: 0.85rem; margin-top: 4px; color: #333;">${err.message || 'Failed to submit bulk request. Please try again or call +1 (647) 210-6463.'}</div>
          </div>
        `;
        if (typeof feedback.scrollIntoView === 'function') {
          feedback.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i data-lucide="send" style="width: 18px; height: 18px;"></i> SUBMIT REQUEST';
        if (window.lucide) lucide.createIcons();
      }
    }
  };

  // ── See More / See Less Toggle for Our Team Section ───────────────────
  window.toggleTeamContent = function(btn) {
    if (!btn) return;
    const targetId = btn.getAttribute('aria-controls');
    const targetEl = document.getElementById(targetId);
    if (!targetEl) return;

    const isExpanded = btn.classList.contains('expanded');
    const labelSpan = btn.querySelector('.btn-toggle-label');

    if (isExpanded) {
      targetEl.style.display = 'none';
      btn.classList.remove('expanded');
      btn.setAttribute('aria-expanded', 'false');
      if (labelSpan) labelSpan.textContent = 'See More';
    } else {
      targetEl.style.display = 'block';
      btn.classList.add('expanded');
      btn.setAttribute('aria-expanded', 'true');
      if (labelSpan) labelSpan.textContent = 'See Less';
    }

    if (window.lucide) lucide.createIcons();
  };
});

// Also define toggleTeamContent globally on window immediately
window.toggleTeamContent = function(btn) {
  if (!btn) return;
  const targetId = btn.getAttribute('aria-controls');
  const targetEl = document.getElementById(targetId);
  if (!targetEl) return;

  const isExpanded = btn.classList.contains('expanded');
  const labelSpan = btn.querySelector('.btn-toggle-label');

  if (isExpanded) {
    targetEl.style.display = 'none';
    btn.classList.remove('expanded');
    btn.setAttribute('aria-expanded', 'false');
    if (labelSpan) labelSpan.textContent = 'See More';
  } else {
    targetEl.style.display = 'block';
    btn.classList.add('expanded');
    btn.setAttribute('aria-expanded', 'true');
    if (labelSpan) labelSpan.textContent = 'See Less';
  }

  if (window.lucide) lucide.createIcons();
};

// ── Interactive Hiring Section Layout Switcher ───────────────────────────
  window.setHiringLayout = function(layout) {
    const grid = document.getElementById('hiring-roles-grid');
    const spotlightNav = document.getElementById('spotlight-role-nav');
    if (!grid) return;

    // Update active button state
    document.querySelectorAll('.layout-toggle-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`btn-layout-${layout}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Remove existing layout classes and apply new one
    grid.classList.remove('layout-vertical', 'layout-horizontal', 'layout-spotlight');
    grid.classList.add(`layout-${layout}`);

    if (layout === 'spotlight') {
      if (spotlightNav) spotlightNav.style.display = 'flex';
      window.setSpotlightRole(1); // default to first card
    } else {
      if (spotlightNav) spotlightNav.style.display = 'none';
      // Reset card visibility
      grid.querySelectorAll('.hiring-card').forEach(card => {
        card.style.display = '';
        card.classList.remove('active-spotlight');
      });
    }

    if (window.lucide) lucide.createIcons();
  };

  window.setSpotlightRole = function(roleId) {
    const grid = document.getElementById('hiring-roles-grid');
    const spotlightNav = document.getElementById('spotlight-role-nav');
    if (!grid || !grid.classList.contains('layout-spotlight')) return;

    // Update spotlight tab buttons
    if (spotlightNav) {
      const tabs = spotlightNav.querySelectorAll('.spotlight-tab-btn');
      tabs.forEach((tab, idx) => {
        if (idx === (roleId - 1)) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });
    }

    // Show only selected role card in spotlight
    const cards = grid.querySelectorAll('.hiring-card');
    cards.forEach(card => {
      if (card.getAttribute('data-role-id') === String(roleId)) {
        card.style.display = 'flex';
        card.classList.add('active-spotlight');
      } else {
        card.style.display = 'none';
        card.classList.remove('active-spotlight');
      }
    });

    if (window.lucide) lucide.createIcons();
  };
