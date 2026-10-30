/**
 * ==========================================================================
 * SCROLL REVEAL RUNTIME (Job Seekers & For Clients Pages)
 * Performant, IntersectionObserver-based, bidirectional reveal utility
 * Supports re-revealing on reverse scroll to top and ripple card tablets
 * ==========================================================================
 */

(function () {
  'use strict';

  // Step 4: Add js-enabled class so CSS only hides elements when JS is active
  if (typeof document !== 'undefined') {
    document.documentElement.classList.add('js-enabled');
  }

  const initScrollReveal = () => {
    // 1. Hero immediate load-in (above the fold) and re-trigger on reverse scroll to top
    const heroElements = document.querySelectorAll('[data-animate="hero-load"], .subpage-hero [data-animate]');
    if (heroElements.length > 0) {
      const triggerHero = () => {
        heroElements.forEach((el) => {
          el.style.willChange = 'transform, opacity';
          el.classList.add('sr-revealed');
        });
      };

      setTimeout(triggerHero, 60);

      // Scroll-to-top handler: re-animates hero when user scrolls back to the very top fold
      window.addEventListener('scroll', () => {
        const scrollY = window.scrollY || window.pageYOffset;
        if (scrollY > 350) {
          heroElements.forEach((el) => {
            el.classList.remove('sr-revealed');
            el.style.willChange = 'auto';
          });
        } else if (scrollY <= 140) {
          triggerHero();
        }
      }, { passive: true });
    }

    // 2. Setup Stagger Groups (Containers with data-animate-stagger)
    const staggerContainers = document.querySelectorAll('[data-animate-stagger]');
    staggerContainers.forEach((container) => {
      const staggerMs = parseInt(container.getAttribute('data-animate-stagger'), 10) || 100;
      const childSelector = container.getAttribute('data-stagger-target') || ':scope > *';
      const children = Array.from(container.querySelectorAll(childSelector)).slice(0, 6);

      children.forEach((child, index) => {
        if (!child.hasAttribute('data-animate')) {
          child.setAttribute('data-animate', 'fade-up');
        }
        if (!child.hasAttribute('data-delay')) {
          child.setAttribute('data-delay', String(index * staggerMs));
          child.style.transitionDelay = `${index * staggerMs}ms`;
        }
      });
    });

    // 3. Setup Card Tablets (.detail-item inside .contact-detail-list)
    const detailLists = document.querySelectorAll('.contact-detail-list');
    detailLists.forEach((list) => {
      const items = list.querySelectorAll('.detail-item');
      items.forEach((item) => {
        if (!item.hasAttribute('data-animate')) {
          item.setAttribute('data-animate', 'tablet-ripple');
        }
      });
    });

    // 4. Stats Count-up utility (Counts up each time visible)
    const setupCountUp = (el) => {
      const target = parseFloat(el.getAttribute('data-countup')) || 0;
      const duration = parseInt(el.getAttribute('data-countup-duration'), 10) || 1600;
      const prefix = el.getAttribute('data-countup-prefix') || '';
      const suffix = el.getAttribute('data-countup-suffix') || '';
      const startTime = performance.now();

      const updateCounter = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - (1 - progress) * (1 - progress);
        const currentVal = Math.floor(easeOut * target);

        el.textContent = `${prefix}${currentVal.toLocaleString()}${suffix}`;

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          el.textContent = `${prefix}${target.toLocaleString()}${suffix}`;
        }
      };

      requestAnimationFrame(updateCounter);
    };

    // 5. IntersectionObserver for scroll-triggered elements (BIDIRECTIONAL)
    const animElements = document.querySelectorAll(
      '[data-animate]:not([data-animate="hero-load"]):not(.subpage-hero [data-animate]), .sr-step-connector, .contact-detail-list .detail-item, .hiring-specs-box .hiring-spec-item, .hiring-travel-perks-grid .travel-perk-card, .benefit-pill-chip, .hiring-perks-list .hiring-perk-item, [data-animate="tablet-ripple"]'
    );

    if (!('IntersectionObserver' in window)) {
      // Fallback for older browsers: reveal all immediately
      animElements.forEach((el) => {
        el.classList.add('sr-revealed');
        const countEl = el.querySelector('[data-countup]') || (el.hasAttribute('data-countup') ? el : null);
        if (countEl) setupCountUp(countEl);
      });
      return;
    }

    const observerOptions = {
      threshold: 0,
      rootMargin: '10px 0px -25px 0px',
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const el = entry.target;

        if (entry.isIntersecting) {
          // Element entered viewport (scrolling down or scrolling back up)
          el.style.willChange = 'transform, opacity';
          el.classList.add('sr-revealed');

          // Clean up will-change on transition end
          const onTransitionEnd = () => {
            el.style.willChange = 'auto';
            el.removeEventListener('transitionend', onTransitionEnd);
          };
          el.addEventListener('transitionend', onTransitionEnd);

          // Check for count-up elements inside or on target
          const countEl = el.querySelector('[data-countup]') || (el.hasAttribute('data-countup') ? el : null);
          if (countEl && !countEl.classList.contains('is-counting')) {
            countEl.classList.add('is-counting');
            setupCountUp(countEl);
          }
        } else {
          // Element left viewport (scrolled past it downwards or upwards)
          // Reset so the element cleanly re-animates whenever scrolling back
          el.classList.remove('sr-revealed');
          el.style.willChange = 'auto';

          // Reset countup flag so it counts up again when re-entering
          const countEl = el.querySelector('[data-countup]') || (el.hasAttribute('data-countup') ? el : null);
          if (countEl) {
            countEl.classList.remove('is-counting');
          }
        }
      });
    }, observerOptions);

    animElements.forEach((el) => {
      // Apply custom inline delay if data-delay is set
      const delay = el.getAttribute('data-delay');
      if (delay) {
        el.style.transitionDelay = `${delay}ms`;
      }
      revealObserver.observe(el);
    });

    // Immediate check for elements currently in view on load or anchor jump
    const checkVisibleNow = () => {
      const vh = window.innerHeight || document.documentElement.clientHeight;
      animElements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top <= vh && rect.bottom >= 0) {
          el.classList.add('sr-revealed');
        }
      });
    };
    checkVisibleNow();
    setTimeout(checkVisibleNow, 120);

    // Anchor hash navigation support: immediately reveal targeted section
    const handleAnchorJump = () => {
      if (window.location.hash) {
        const target = document.querySelector(window.location.hash);
        if (target) {
          target.classList.add('sr-revealed');
          target.querySelectorAll('[data-animate]').forEach((el) => el.classList.add('sr-revealed'));
        }
      }
    };
    handleAnchorJump();
    window.addEventListener('hashchange', handleAnchorJump);

    // Reverse scroll tracker: guarantees re-reveals smoothly when scrolling back to the top
    let lastScrollY = window.scrollY || window.pageYOffset;
    let ticking = false;

    window.addEventListener('scroll', () => {
      const currentScrollY = window.scrollY || window.pageYOffset;
      const scrollingUp = currentScrollY < lastScrollY;
      lastScrollY = currentScrollY;

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const vh = window.innerHeight || document.documentElement.clientHeight;

          // When scrolling up towards top or when in the upper sections
          if (scrollingUp || currentScrollY <= 250) {
            animElements.forEach((el) => {
              const rect = el.getBoundingClientRect();
              if (rect.top <= vh * 0.92 && rect.bottom >= 15) {
                if (!el.classList.contains('sr-revealed')) {
                  el.style.willChange = 'transform, opacity';
                  el.classList.add('sr-revealed');
                }
              } else if (rect.top > vh + 60 || rect.bottom < -60) {
                el.classList.remove('sr-revealed');
              }
            });
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initScrollReveal);
  } else {
    initScrollReveal();
  }
})();
