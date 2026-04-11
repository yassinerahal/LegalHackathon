/**
 * NAVIGATION BUTTON SYNCHRONIZATION
 * =========================================================
 * Synchronizes clicks between desktop and mobile navigation buttons.
 * This ensures both the desktop nav buttons and mobile menu buttons work identically.
 */

(function syncMobileDesktopButtons() {
  'use strict';

  console.log('[Navigation Sync] Initializing button synchronization');

  // Utility function to safely handle logout
  function performLogout() {
    localStorage.removeItem('nextact_jwt');
    localStorage.removeItem('nextact_session');
    window.location.href = 'login.html';
  }

  // Sync logout buttons
  const logoutBtnDesktop = document.getElementById('logoutBtn');
  const logoutBtnMobile = document.getElementById('logoutBtnMobile');

  if (logoutBtnDesktop && logoutBtnMobile) {
    // Both exist: mobile delegates to desktop
    logoutBtnMobile.addEventListener('click', () => {
      logoutBtnDesktop.click();
    });
  } else if (logoutBtnDesktop) {
    // Only desktop exists - make sure it works
    logoutBtnDesktop.addEventListener('click', performLogout);
  } else if (logoutBtnMobile) {
    // Only mobile exists
    logoutBtnMobile.addEventListener('click', performLogout);
  }

  // Sync billing buttons
  const billingBtnDesktop = document.getElementById('billingBtn');
  const billingBtnMobile = document.getElementById('billingBtnMobile');

  if (billingBtnDesktop && billingBtnMobile) {
    billingBtnMobile.addEventListener('click', () => {
      billingBtnDesktop.click();
    });
  } else if (billingBtnDesktop) {
    billingBtnDesktop.addEventListener('click', () => {
      window.location.href = 'billing.html';
    });
  } else if (billingBtnMobile) {
    billingBtnMobile.addEventListener('click', () => {
      window.location.href = 'billing.html';
    });
  }

  // Sync dashboard/go-home buttons (for detail pages)
  const goDashboardDesktop = document.getElementById('goDashboardBtn');
  const goDashboardMobile = document.getElementById('goDashboardBtnMobile');

  if (goDashboardDesktop && goDashboardMobile) {
    goDashboardMobile.addEventListener('click', () => {
      goDashboardDesktop.click();
    });
  } else if (goDashboardDesktop) {
    goDashboardDesktop.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  } else if (goDashboardMobile) {
    goDashboardMobile.addEventListener('click', () => {
      window.location.href = 'index.html';
    });
  }

  // Sync user info display between desktop and mobile
  const userNameDesktop = document.getElementById('loggedInUserName');
  const userNameMobile = document.getElementById('mobileLoggedInUserName');
  const userRoleDesktop = document.getElementById('nav-user-role');
  const userRoleMobile = document.getElementById('mobileNavUserRole');

  /**
   * Update user info on both desktop and mobile
   */
  function syncUserDisplay() {
    try {
      // Try to get session from storage
      const sessionStr = localStorage.getItem('nextact_session');
      if (!sessionStr) return;

      const session = JSON.parse(sessionStr);
      const displayName = session.name || session.email || 'User';
      const displayRole = (session.role || 'user').toUpperCase();

      if (userNameDesktop) userNameDesktop.textContent = displayName;
      if (userNameMobile) userNameMobile.textContent = displayName;
      if (userRoleDesktop) userRoleDesktop.textContent = displayRole;
      if (userRoleMobile) userRoleMobile.textContent = displayRole;
    } catch (error) {
      console.warn('[Navigation Sync] Could not sync user display:', error.message);
    }
  }

  // Sync on initial load
  syncUserDisplay();

  // Re-sync if storage changes (for multi-tab scenarios)
  window.addEventListener('storage', (event) => {
    if (event.key === 'nextact_session') {
      syncUserDisplay();
    }
  });

  console.log('[Navigation Sync] Mobile and desktop buttons synchronized');
})();
