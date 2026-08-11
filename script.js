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

  // 2. Interactive Staffing Roles Pagination & Automatic Carousel (< 01 / 05 >)
  const prevBtn = document.getElementById('prev-prod-btn');
  const nextBtn = document.getElementById('next-prod-btn');
  const currentPageEl = document.getElementById('current-page');
  const productsGrid = document.getElementById('products-grid');

  let currentPage = 1;
  const totalPages = 5;

  const productData = [
    // Page 1
    [
      { img: 'assets/images/role_rn_care.jpg', title: 'Registered Nurses (RNs & RPNs)', highlight: false },
      { img: 'assets/images/role_psw_care.jpg', title: 'Personal Support Workers (PSWs)', highlight: true },
      { img: 'assets/images/role_education_care.jpg', title: 'Healthcare Education & Support Staff', highlight: false }
    ],
    // Page 2
    [
      { img: 'assets/images/role_icu_care.jpg', title: 'ICU & Emergency Room Shift Relief', highlight: false },
      { img: 'assets/images/service_nurse.jpg', title: 'Long-Term Care Floor Nurses', highlight: true },
      { img: 'assets/images/service_homecare.jpg', title: 'Senior Retirement Home Aides', highlight: false }
    ],
    // Page 3
    [
      { img: 'assets/images/role_education_care.jpg', title: 'Clinical Education & CPR Instructors', highlight: false },
      { img: 'assets/images/team_divine.jpg', title: '24/7 Outbreak & Emergency Surge Staff', highlight: true },
      { img: 'assets/images/role_rn_care.jpg', title: 'Complex Wound & Medication Nurses', highlight: false }
    ],
    // Page 4
    [
      { img: 'assets/images/service_homecare.jpg', title: '1-on-1 Bedside Care & Companionship', highlight: false },
      { img: 'assets/images/service_nurse.jpg', title: 'PointClickCare Electronic Charting RNs', highlight: true },
      { img: 'assets/images/role_psw_care.jpg', title: 'Certified Food Handler Dietary Staff', highlight: false }
    ],
    // Page 5
    [
      { img: 'assets/images/hero_divine.jpg', title: 'Travel Nursing & Provincial Contracts', highlight: false },
      { img: 'assets/images/role_psw_care.jpg', title: 'Dementia & Memory Care Caregivers', highlight: true },
      { img: 'assets/images/role_rn_care.jpg', title: 'Medical-Surgical & Telemetry Nurses', highlight: false }
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
      text: "Compassionate care &amp;<br>expert healthcare staffing<br>you can trust 24/7.",
      img: "assets/images/hero_divine.jpg"
    },
    {
      text: "24/7 Rapid Shift Relief<br>for Hospitals &amp; LTC Homes<br>across Ontario.",
      img: "assets/images/service_nurse.jpg"
    },
    {
      text: "100% Pre-screened RNs,<br>RPNs, and PSWs ready<br>to deploy immediately.",
      img: "assets/images/service_homecare.jpg"
    },
    {
      text: "Nurse-Led Excellence<br>under Livina Akadinwa<br>RN, BScN, MPH.",
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

  // 4. Form Feedback Submission Messages
  const forms = [
    { formId: 'client-request-form', feedbackId: 'client-form-feedback', successMsg: 'Facility shift request submitted successfully! Divine Fingers operations will confirm within 30 minutes.' },
    { formId: 'candidate-apply-form', feedbackId: 'candidate-form-feedback', successMsg: 'Application received! Divine Fingers recruitment coordinator will reach out shortly.' },
    { formId: 'general-contact-form', feedbackId: 'contact-form-feedback', successMsg: 'Message sent! Thank you for reaching out to Divine Fingers Healthcare Services.' },
    { formId: 'home-contact-form', feedbackId: 'home-form-feedback', successMsg: 'Message sent! Thank you for reaching out to Divine Fingers Healthcare Services. Our care coordination team will respond shortly.' }
  ];

  forms.forEach(item => {
    const form = document.getElementById(item.formId);
    const feedback = document.getElementById(item.feedbackId);
    if (form && feedback) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        feedback.style.color = '#3CAF8A';
        feedback.textContent = item.successMsg;
        form.reset();
      });
    }
  });

  // ==========================================================================
  // GSAP SCROLLTRIGGER ANIMATION ENGINE (100% GUARANTEED VISIBILITY & REVEALS)
  // ==========================================================================
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {

    // A. Site Header Entrance
    gsap.fromTo('.site-header', 
      { y: -30, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }
    );

    // B. Hero & Subpage Hero Entrance Animations
    gsap.fromTo('.hero-text-block, .subpage-hero .hero-text-block', 
      { y: 35, opacity: 0 }, 
      { y: 0, opacity: 1, duration: 1.1, ease: 'power2.out', delay: 0.1 }
    );

    gsap.fromTo('.hero-diagonal-shape', 
      { scaleX: 0 }, 
      { scaleX: 1, duration: 1.2, transformOrigin: 'left center', ease: 'power3.inOut' }
    );

    // C. Slide In All Section Headers & Titles From Left On Scroll (Across All Pages)
    const sectionHeaders = document.querySelectorAll('.welcome-header, .welcome-title, .products-title-wrapper, .gallery-title, .form-title, .section-title, .page-title, .contact-card-title, .news-subtitle');
    sectionHeaders.forEach(header => {
      gsap.fromTo(header, 
        { x: -50, opacity: 0 }, 
        { 
          x: 0, 
          opacity: 1, 
          duration: 1.05, 
          ease: 'power2.out',
          scrollTrigger: {
            trigger: header,
            start: 'top 90%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // D. Silky Smooth Alternating Left & Right Slide-In Animation for Cards & Items (Across All Pages)
    const animateAlternatingCards = (selector, offsetDist = 45) => {
      const cards = document.querySelectorAll(selector);
      if (cards.length > 0) {
        cards.forEach((card, index) => {
          // Even cards slide in from Left (-offsetDist), Odd cards slide in from Right (+offsetDist)
          const startX = index % 2 === 0 ? -offsetDist : offsetDist;
          gsap.fromTo(card, 
            { x: startX, opacity: 0 }, 
            { 
              x: 0, 
              opacity: 1, 
              duration: 1.15, 
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

    // Apply Smooth Alternating Left/Right Slide-In to All Cards & Items Site-Wide
    animateAlternatingCards('.step-card, .sector-card, .product-card, .why-item, .team-card, .pillar-card, .service-card, .advantage-card, .perk-card, .news-card, .article-card, .leader-card, .value-card, .client-benefit-card, .job-role-card, .apply-step-card, .leadership-grid > div, .pillars-grid > div, .services-page-grid > div, .advantages-grid > div, .perks-grid > div, .blog-grid > article, .contact-grid-row > div', 48);

    // E. 2-Column Split Section Slide-In (Silky Smooth Left & Right Entrance Site-Wide)
    const animateSplitSection = (leftSelector, rightSelector, offsetDist = 50) => {
      const leftElements = document.querySelectorAll(leftSelector);
      const rightElements = document.querySelectorAll(rightSelector);

      leftElements.forEach(el => {
        gsap.fromTo(el, 
          { x: -offsetDist, opacity: 0 }, 
          { 
            x: 0, 
            opacity: 1, 
            duration: 1.2, 
            ease: 'power2.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none'
            }
          }
        );
      });

      rightElements.forEach(el => {
        gsap.fromTo(el, 
          { x: offsetDist, opacity: 0 }, 
          { 
            x: 0, 
            opacity: 1, 
            duration: 1.2, 
            ease: 'power2.out',
            clearProps: 'transform',
            scrollTrigger: {
              trigger: el,
              start: 'top 88%',
              toggleActions: 'play none none none'
            }
          }
        );
      });
    };

    // Apply Left/Right Split Slide-In to Why Choose Us, Gallery, Forms & Contact Cards
    animateSplitSection(
      '.why-choose-grid .gallery-photo-col, .gallery-grid .gallery-photo-col, .contact-info-card, .subpage-split-left', 
      '.why-choose-grid .gallery-info-col, .gallery-grid .gallery-info-col, #home-contact-form, .custom-form, .subpage-split-right', 
      52
    );

    // F. Tabs, Control Buttons & Pagination Slide-Up
    const animateInteractiveControls = (selector) => {
      const controls = document.querySelectorAll(selector);
      controls.forEach(ctrl => {
        gsap.fromTo(ctrl, 
          { y: 25, opacity: 0 }, 
          { 
            y: 0, 
            opacity: 1, 
            duration: 0.9, 
            ease: 'power2.out',
            scrollTrigger: {
              trigger: ctrl,
              start: 'top 92%',
              toggleActions: 'play none none none'
            }
          }
        );
      });
    };

    animateInteractiveControls('.tab-btn, .filter-tab, .products-pagination, .social-buttons, .callout-btn-group');

    // G. Fade-Up for Section Containers & Footer
    const animateSectionContainers = (selector, yOffset = 25) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        gsap.fromTo(el, 
          { y: yOffset, opacity: 0 }, 
          { 
            y: 0, 
            opacity: 1, 
            duration: 1.1, 
            ease: 'power2.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 92%',
              toggleActions: 'play none none none'
            }
          }
        );
      });
    };

    animateSectionContainers('.strip-section, .welcome-section, .callout-banner-section, .about-section, .services-section, .clients-section, .jobseekers-section, .blog-section, .contact-section, .site-footer');

    // Refresh ScrollTrigger positions after rendering
    setTimeout(() => {
      ScrollTrigger.refresh();
    }, 400);
  }
});
