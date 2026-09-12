/**
 * DSA MEDIA CREW - Unified Navbar Controller
 * Handles mobile hamburger toggle, active link detection, scroll blur, and dropdown accordion.
 */

document.addEventListener('DOMContentLoaded', function() {
  initNavbar();
});

function initNavbar() {
  const nav = document.querySelector('nav') || document.querySelector('.site-navbar');
  if (!nav) return;

  // 1. Ensure mobile toggle button exists
  let toggle = nav.querySelector('.nav-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.className = 'nav-toggle';
    toggle.setAttribute('aria-label', 'Toggle Navigation Menu');
    toggle.innerHTML = `
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
      <span class="nav-toggle-bar"></span>
    `;
    nav.appendChild(toggle);
  }

  // 2. Ensure mobile backdrop exists
  let backdrop = document.querySelector('.mobile-nav-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.className = 'mobile-nav-backdrop';
    document.body.appendChild(backdrop);
  }

  const navLinks = nav.querySelector('.nav-links');

  // 3. Mobile Toggle Click Handler
  function toggleMobileNav(open) {
    const shouldOpen = typeof open === 'boolean' ? open : !navLinks.classList.contains('open');
    if (shouldOpen) {
      navLinks.classList.add('open');
      toggle.classList.add('open');
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    } else {
      navLinks.classList.remove('open');
      toggle.classList.remove('open');
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleMobileNav();
  });

  backdrop.addEventListener('click', () => {
    toggleMobileNav(false);
  });

  // 4. Dropdown Mobile Accordion Support
  const dropdownItems = nav.querySelectorAll('.nav-item-dropdown');
  dropdownItems.forEach(item => {
    const link = item.querySelector('a');
    if (link) {
      link.addEventListener('click', (e) => {
        if (window.innerWidth <= 900) {
          e.preventDefault();
          item.classList.toggle('open');
        }
      });
    }
  });

  // 5. Close menu on clicking regular links
  if (navLinks) {
    const regularLinks = navLinks.querySelectorAll('a:not(.nav-dropdown-toggle)');
    regularLinks.forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          toggleMobileNav(false);
        }
      });
    });
  }

  // 6. Escape key to close mobile nav
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navLinks && navLinks.classList.contains('open')) {
      toggleMobileNav(false);
    }
  });

  // 7. Scroll listener for navbar elevation / shadow
  function handleScroll() {
    if (window.scrollY > 30) {
      nav.classList.add('scrolled');
    } else {
      nav.classList.remove('scrolled');
    }
  }
  window.addEventListener('scroll', handleScroll, { passive: true });
  handleScroll();

  // 8. Auto-detect active link based on current path
  highlightActiveNav(nav);
}

function highlightActiveNav(nav) {
  const currentPath = window.location.pathname.toLowerCase();
  const navLinks = nav.querySelectorAll('.nav-links a');
  
  // Mapping paths to identifier
  let activeKey = '';
  if (currentPath.endsWith('/team') || currentPath.includes('team.html')) activeKey = 'team';
  else if (currentPath.endsWith('/gallery') || currentPath.includes('gallery.html')) activeKey = 'gallery';
  else if (currentPath.endsWith('/videos') || currentPath.includes('videography')) activeKey = 'videography';
  else if (currentPath.endsWith('/designs') || currentPath.includes('editing-designs')) activeKey = 'designs';
  else if (currentPath.endsWith('/meraki26') || currentPath.includes('meraki26.html')) activeKey = 'meraki';
  else if (currentPath.endsWith('/portfolio') || currentPath.includes('portfolio.html')) activeKey = 'portfolio';
  else if (currentPath === '/' || currentPath.endsWith('/home') || currentPath.includes('home.html') || currentPath.includes('index.html')) activeKey = 'home';

  navLinks.forEach(link => {
    const href = (link.getAttribute('href') || '').toLowerCase();
    
    // Check match
    let match = false;
    if (activeKey === 'home' && (href === 'home.html' || href === '/' || href === '/home' || href === 'index.html')) match = true;
    else if (activeKey === 'team' && href.includes('team')) match = true;
    else if (activeKey === 'gallery' && href.includes('gallery')) match = true;
    else if (activeKey === 'videography' && (href.includes('videography') || href.includes('videos'))) match = true;
    else if (activeKey === 'designs' && (href.includes('editing-designs') || href.includes('designs'))) match = true;
    else if (activeKey === 'meraki' && href.includes('meraki')) match = true;

    if (match) {
      link.classList.add('active');
    }
  });
}
