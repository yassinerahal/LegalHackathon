/**
 * MOBILE RESPONSIVE NAVIGATION MODULE
 * =========================================================
 * Handles mobile menu toggle, body scroll lock, and responsive behavior
 * for the hamburger menu on mobile devices (< md breakpoint).
 * 
 * Features:
 * - Hamburger button toggle (open/close icons)
 * - Mobile menu drawer with vertical stacked links
 * - Body scroll lock when menu is open
 * - Auto-close on window resize to desktop width
 * - Touch-friendly hit areas (44x44px minimum)
 */

(function initMobileNav() {
  'use strict';

  // Get references to navigation elements
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mobileMenu = document.getElementById('mobile-menu');
  const hamburgerOpenIcon = document.getElementById('hamburger-open-icon');
  const hamburgerCloseIcon = document.getElementById('hamburger-close-icon');
  
  // Exit early if elements don't exist (not all pages may have mobile nav)
  if (!hamburgerBtn || !mobileMenu || !hamburgerOpenIcon || !hamburgerCloseIcon) {
    return;
  }

  /**
   * Close the mobile menu and restore scroll
   */
  function closeMobileMenu() {
    mobileMenu.classList.add('hidden');
    hamburgerOpenIcon.classList.remove('hidden');
    hamburgerCloseIcon.classList.add('hidden');
    
    // Allow body scrolling
    document.body.classList.remove('overflow-hidden');
    
    console.log('[MobileNav] Menu closed');
  }

  /**
   * Open the mobile menu and disable scroll
   */
  function openMobileMenu() {
    mobileMenu.classList.remove('hidden');
    hamburgerOpenIcon.classList.add('hidden');
    hamburgerCloseIcon.classList.remove('hidden');
    
    // Prevent body scrolling
    document.body.classList.add('overflow-hidden');
    
    console.log('[MobileNav] Menu opened');
  }

  /**
   * Toggle the mobile menu state
   */
  function toggleMobileMenu() {
    const isHidden = mobileMenu.classList.contains('hidden');
    if (isHidden) {
      openMobileMenu();
    } else {
      closeMobileMenu();
    }
  }

  /**
   * Check if we're in mobile view (below md breakpoint ~768px)
   */
  function isMobileView() {
    return window.innerWidth < 768;
  }

  /**
   * Handle window resize - close menu if resized to desktop
   */
  function handleWindowResize() {
    if (!isMobileView()) {
      // Window is now at desktop size
      if (!mobileMenu.classList.contains('hidden')) {
        closeMobileMenu();
      }
    }
  }

  /**
   * Close menu when a navigation link is clicked
   */
  function handleNavLinkClick(event) {
    // Only close if it's an actual link (tag name is 'A')
    if (event.target.tagName === 'A') {
      closeMobileMenu();
    }
  }

  // =========================================================
  // EVENT LISTENERS
  // =========================================================

  // Hamburger button toggle
  hamburgerBtn.addEventListener('click', toggleMobileMenu);

  // Close menu when a nav link is clicked
  const navLinks = mobileMenu.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', handleNavLinkClick);
  });

  // Close menu when window is resized to desktop
  window.addEventListener('resize', handleWindowResize);

  // Close menu when Escape key is pressed
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !mobileMenu.classList.contains('hidden')) {
      closeMobileMenu();
    }
  });

  console.log('[MobileNav] Navigation module initialized');
})();
