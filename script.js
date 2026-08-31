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
    mobileToggle.addEventListener('click', () => {
      navList.classList.toggle('open');
      mobileToggle.classList.toggle('active');
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
      text: "Where Innovation Meets<br>Compassionate Care.",
      img: "assets/images/hero_divine.jpg"
    },
    {
      text: "Travelling Nursing Program<br>On-Demand Clinical Care Across Canada.",
      img: "assets/images/service_nurse.jpg"
    },
    {
      text: "Personal Care Support<br>&amp; Assistive Daily Living.",
      img: "assets/images/service_homecare.jpg"
    },
    {
      text: "Partnership &amp; Quality<br>in Every Care Interaction.",
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
        heroTitle.style.fontSize = ''; // Uses full CSS clamp font size
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
    if (typeof window === 'undefined') return 'http://localhost:3000/api';
    const isFile = window.location.protocol === 'file:';
    const isLocalHost = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '';
    if (isFile || isLocalHost) {
      const port = window.location.port || '3000';
      const host = window.location.hostname || 'localhost';
      return `http://${host}:${port}/api`;
    }
    // Remote production domain
    return 'https://api.divinefingershealthcare.ca/api';
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

      const response = await fetch(`${API_BASE}${endpoint}`, opts);
      clearTimeout(timeoutId);

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Server error');

      clearUnavailableBanner();
      // Flush any previously buffered submissions now that we're back online
      flushRetryBuffer();
      return data;

    } catch (err) {
      clearTimeout(timeoutId);
      const isTimeout  = err.name === 'AbortError';
      const isNetwork  = err.message === 'Failed to fetch' || isTimeout;

      if (isNetwork && bufferOnFail && !isFormData) {
        saveToRetryBuffer(endpoint, payload, isFormData);
        showUnavailableBanner(feedbackEl);
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
        facility_name:  document.getElementById('facility-name')?.value || '',
        contact_name:   document.getElementById('client-contact-name')?.value || '',
        contact_email:  document.getElementById('client-email')?.value || document.getElementById('client-work-email')?.value || '',
        contact_phone:  document.getElementById('client-phone')?.value || document.getElementById('client-phone-num')?.value || '',
        role_requested: staffRoleMap[staffVal] || 'RN',
        shift_type:     document.getElementById('shift-details')?.value || document.getElementById('client-shift-location')?.value || 'Day Shift',
        urgency_level:  document.getElementById('client-urgency-level')?.value || 'routine'
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

      let name = 'Website Visitor', email = '', phone = '', message = 'General Inquiry';
      form.querySelectorAll('input, textarea').forEach(inp => {
        if (inp.placeholder?.includes('NAME'))  name    = inp.value || name;
        if (inp.type === 'email' || inp.placeholder?.includes('EMAIL')) email = inp.value || email;
        if (inp.type === 'tel'   || inp.placeholder?.includes('PHONE')) phone = inp.value || phone;
        if (inp.tagName === 'TEXTAREA') message = inp.value || message;
      });

      if (feedback) { feedback.style.color = '#00A896'; feedback.textContent = 'Sending message...'; }

      try {
        await apiPost('/contact', { name, email, phone: phone || undefined, message }, feedback);
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

  // Attempt to flush any buffered submissions on page load
  flushRetryBuffer();



  // ==========================================================================
  // GSAP SCROLLTRIGGER ANIMATION ENGINE (100% GUARANTEED VISIBILITY & REVEALS)
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

    gsap.fromTo('.hero-diagonal-shape', 
      { scaleX: 0 }, 
      { scaleX: 1, duration: 1.2, transformOrigin: 'left center', ease: 'power3.inOut' }
    );

    // C. Slide In Section Headers
    const sectionHeaders = document.querySelectorAll('.welcome-header, .welcome-title, .products-title-wrapper, .gallery-title, .form-title, .section-title, .page-title, .contact-card-title');
    sectionHeaders.forEach(header => {
      gsap.fromTo(header, 
        { x: -40, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 1.0, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: header,
            start: 'top 90%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // D. Alternating Slide-In for Cards
    const animateAlternatingCards = (selector, offsetDist = 45) => {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        cards.forEach((card, index) => {
          const startX = index % 2 === 0 ? -offsetDist : offsetDist;
          gsap.fromTo(card, 
            { x: startX, opacity: 0 }, 
            { 
              x: 0, 
              opacity: 1, 
              duration: 1.05, 
              ease: 'power2.out',
              clearProps: 'transform',
              scrollTrigger: {
                trigger: card,
                start: 'top 88%',
                toggleActions: 'play none none none'
              }
            }
          );
        });
      }
    };

    animateAlternatingCards('.step-card, .sector-card, .product-card, .why-item, .team-card, .pillar-card, .service-card, .advantage-card, .perk-card, .contact-grid-row > div', 48);
  }

  // 5. Scroll-Triggered Slide-In Animations (Left, Right & Top)
  // Pre-mark all slide elements as hidden so they start off-screen
  const slideLeftEls = document.querySelectorAll('.slide-from-left');
  const slideRightEls = document.querySelectorAll('.slide-from-right');
  const slideTopEls = document.querySelectorAll('.slide-from-top');

  // Add .slide-hidden to start them invisible (JS-gated to avoid no-JS issues)
  slideLeftEls.forEach(el => el.classList.add('slide-hidden'));
  slideRightEls.forEach(el => el.classList.add('slide-hidden'));
  slideTopEls.forEach(el => el.classList.add('slide-hidden'));

  // Responsive offset: smaller on mobile to prevent horizontal/vertical layout jump
  const getSlideOffset = () => {
    const w = window.innerWidth;
    if (w <= 480) return 22;
    if (w <= 767) return 35;
    if (w <= 991) return 55;
    return 80;
  };

  const setupSlideAnimation = (elements, direction) => {
    elements.forEach((el) => {
      if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
        // GSAP handles animation entirely via inline styles
        const offset = getSlideOffset();
        let fromState = { opacity: 0 };
        if (direction === 'left') {
          fromState.x = -offset;
        } else if (direction === 'right') {
          fromState.x = offset;
        } else if (direction === 'top') {
          fromState.y = -offset;
        }

        gsap.fromTo(
          el,
          fromState,
          {
            x: 0,
            y: 0,
            opacity: 1,
            duration: 1.1,
            ease: 'power3.out',
            clearProps: 'transform,opacity',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none'
            },
            onStart: () => {
              // Remove the CSS hidden class so GSAP's inline styles take full control
              el.classList.remove('slide-hidden');
            }
          }
        );
      } else {
        // IntersectionObserver CSS-transition fallback
        const observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                // Transition: hidden → active-slide (CSS handles smooth animation)
                el.classList.remove('slide-hidden');
                el.classList.add('active-slide');
                observer.unobserve(el);
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
  if (resumeInput && fileChosenLabel) {
    resumeInput.addEventListener('change', function () {
      if (this.files && this.files.length > 0) {
        const file = this.files[0];
        const validExtensions = ['.pdf', '.doc', '.docx'];
        const fileExt = '.' + file.name.split('.').pop().toLowerCase();

        if (!validExtensions.includes(fileExt)) {
          fileChosenLabel.textContent = `❌ Invalid file type (${fileExt}). Please select a PDF, DOC, or DOCX file.`;
          fileChosenLabel.style.color = '#E63946';
          fileChosenLabel.style.fontWeight = '700';
          this.value = ''; // Reset input
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          fileChosenLabel.textContent = `❌ File too large (${(file.size / (1024*1024)).toFixed(1)}MB). Max limit is 10MB.`;
          fileChosenLabel.style.color = '#E63946';
          fileChosenLabel.style.fontWeight = '700';
          this.value = ''; // Reset input
          return;
        }

        const sizeKb = Math.round(file.size / 1024);
        fileChosenLabel.textContent = `Selected: ${file.name} (${sizeKb} KB - Ready to upload)`;
        fileChosenLabel.style.color = '#00A896';
        fileChosenLabel.style.fontWeight = '700';
      } else {
        fileChosenLabel.textContent = 'Click to browse or drag & drop file here (PDF, DOC, DOCX - Max 10MB)';
        fileChosenLabel.style.color = '#475569';
        fileChosenLabel.style.fontWeight = 'normal';
      }
    });
  }
});

