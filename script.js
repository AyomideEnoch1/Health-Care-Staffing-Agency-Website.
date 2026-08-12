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

  // 4. Form Feedback Submission Messages
  const forms = [
    { formId: 'client-request-form', feedbackId: 'client-form-feedback', successMsg: 'Staffing request submitted successfully! Divine Fingers team will reach out promptly.' },
    { formId: 'candidate-apply-form', feedbackId: 'candidate-form-feedback', successMsg: 'Application & resume received! Divine Fingers recruitment coordinator will contact you.' },
    { formId: 'general-contact-form', feedbackId: 'contact-form-feedback', successMsg: 'Message sent! Thank you for reaching out to Divine Fingers Healthcare Services.' },
    { formId: 'home-contact-form', feedbackId: 'home-form-feedback', successMsg: 'Message sent! Thank you for reaching out to Divine Fingers Healthcare Services.' }
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
          { threshold: 0.12 }
        );
        observer.observe(el);
      }
    });
  };

  setupSlideAnimation(slideLeftEls, 'left');
  setupSlideAnimation(slideRightEls, 'right');
  setupSlideAnimation(slideTopEls, 'top');


  // 6. Roles Stagger — queues list items one-by-one on scroll
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
      { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
    );
    staggerLists.forEach((list) => staggerObserver.observe(list));
  }
});
