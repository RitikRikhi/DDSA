// DSA Media Crew — Team Page JavaScript
// Complete, Production-Ready Interactive Logic

// Dynamic API sync with local fallback
async function syncLiveTeamData() {
  try {
    const res = await fetch('/api/team');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0 && typeof teamData !== 'undefined') {
        const pres = data.find(m => m.id === 'president' || (m.role && m.role.toLowerCase() === 'president')) || data[0];
        const vps = data.filter(m => m !== pres && (m.category === 'leader' || (m.role && m.role.toLowerCase().includes('vice president'))));
        const others = data.filter(m => m !== pres && !vps.includes(m));

        if (teamData.leadership) {
          teamData.leadership.president = pres;
          teamData.leadership.vicePresidents = vps;
        }
        teamData.members = others;
      }
    }
  } catch (err) {
    console.log('Using local fallback teamData');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  // Sync live creators from API
  await syncLiveTeamData();

  // Initialize all components
  initCustomCursor();
  initHeroStats();
  initCategoryNavigation();
  initMembersGrid();
  initLeadershipCards();
  initProfileModal();
  initScrollAnimations();
  initParallaxEffects();
  initStorytellingAnimations();
  initLeadershipConnections();
});

// ============================================
// CUSTOM CURSOR
// ============================================

function initCustomCursor() {
  const cursor = document.getElementById('cursor');
  if (!cursor || window.matchMedia('(max-width: 768px)').matches) return;

  const cursorDot = cursor.querySelector('.cursor-dot');
  const cursorLabel = cursor.querySelector('.cursor-label');
  if (!cursorDot || !cursorLabel) return;
  
  let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
  let cursorX = mouseX, cursorY = mouseY;
  
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
  
  function animateCursor() {
    cursorX += (mouseX - cursorX) * 0.15;
    cursorY += (mouseY - cursorY) * 0.15;
    
    cursorDot.style.left = cursorX + 'px';
    cursorDot.style.top = cursorY + 'px';
    cursorLabel.style.left = cursorX + 'px';
    cursorLabel.style.top = cursorY + 'px';
    
    requestAnimationFrame(animateCursor);
  }
  
  animateCursor();
  
  // Attach hover listeners
  attachCursorHoverListeners();
}

function attachCursorHoverListeners() {
  const cursor = document.getElementById('cursor');
  if (!cursor) return;
  const cursorLabel = cursor.querySelector('.cursor-label');
  
  const interactiveElements = document.querySelectorAll('button, a, .member-card, .leadership-card, .portfolio-item, .video-item');
  interactiveElements.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.classList.add('hovering');
      if (cursorLabel) {
        if (el.classList.contains('member-card') || el.classList.contains('leadership-card')) {
          cursorLabel.textContent = 'VIEW PROFILE';
        } else if (el.classList.contains('portfolio-item')) {
          cursorLabel.textContent = 'VIEW';
        } else if (el.classList.contains('video-item')) {
          cursorLabel.textContent = 'PLAY';
        } else {
          cursorLabel.textContent = '';
        }
      }
    });
    
    el.addEventListener('mouseleave', () => {
      cursor.classList.remove('hovering');
      if (cursorLabel) cursorLabel.textContent = '';
    });
  });
}

// ============================================
// HERO STATS ANIMATION
// ============================================

function initHeroStats() {
  const allMembers = getAllMembers();
  const totalCreatorsCount = allMembers.length;
  
  const statNumbers = document.querySelectorAll('.stat-number[data-count]');
  statNumbers.forEach(num => {
    if (num.dataset.count === "23" || num.dataset.count === "20") {
      num.dataset.count = totalCreatorsCount;
    }
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const target = parseInt(entry.target.dataset.count, 10) || 20;
        animateNumber(entry.target, 0, target, 1200);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });
  
  statNumbers.forEach(num => observer.observe(num));
}

function animateNumber(element, start, end, duration) {
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.floor(start + (end - start) * easeOut);
    
    element.textContent = current;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = end;
    }
  }
  
  requestAnimationFrame(update);
}

// ============================================
// CATEGORY NAVIGATION
// ============================================

function initCategoryNavigation() {
  const categoryBtns = document.querySelectorAll('.category-btn');
  const currentCategorySpan = document.getElementById('currentCategory');
  const totalCategoriesSpan = document.getElementById('totalCategories');
  
  if (!categoryBtns.length) return;
  
  if (totalCategoriesSpan) {
    totalCategoriesSpan.textContent = String(teamData.categories.length).padStart(2, '0');
  }
  
  categoryBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => {
      const category = btn.dataset.category;
      
      // Update active state
      categoryBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      // Update counter
      if (currentCategorySpan) {
        currentCategorySpan.textContent = String(index + 1).padStart(2, '0');
      }
      
      // Filter members
      filterMembers(category);
    });
  });
}

function filterMembers(category) {
  const membersGrid = document.getElementById('membersGrid');
  const filterValue = document.getElementById('filterValue');
  const membersCount = document.getElementById('membersCount');
  
  if (!membersGrid) return;
  
  // Update filter label
  if (filterValue) {
    filterValue.textContent = getCategoryName(category);
  }
  
  // Get filtered members
  const filteredMembers = getMembersByCategory(category);
  
  // Update count
  if (membersCount) {
    membersCount.textContent = `${filteredMembers.length} CREATORS`;
  }
  
  // Smooth Transition
  membersGrid.style.opacity = '0.3';
  membersGrid.style.transform = 'translateY(10px)';
  
  setTimeout(() => {
    membersGrid.innerHTML = '';
    
    filteredMembers.forEach((member, index) => {
      const card = createMemberCard(member);
      card.style.animationDelay = `${index * 0.05}s`;
      membersGrid.appendChild(card);
    });
    
    membersGrid.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    membersGrid.style.opacity = '1';
    membersGrid.style.transform = 'translateY(0)';
    
    attachCursorHoverListeners();
  }, 200);
}

// ============================================
// MEMBERS GRID
// ============================================

function initMembersGrid() {
  const membersGrid = document.getElementById('membersGrid');
  const membersCount = document.getElementById('membersCount');
  if (!membersGrid) return;
  
  // Initially show all members
  const allMembers = getAllMembers();
  
  if (membersCount) {
    membersCount.textContent = `${allMembers.length} CREATORS`;
  }
  
  membersGrid.innerHTML = '';
  allMembers.forEach((member, index) => {
    const card = createMemberCard(member);
    card.style.animationDelay = `${index * 0.05}s`;
    membersGrid.appendChild(card);
  });
}

function createMemberCard(member) {
  const card = document.createElement('div');
  card.className = 'member-card visible';
  card.dataset.memberId = member.id;
  
  const fallback = member.fallbackImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&crop=face';
  const categoryLabel = getCategoryName(member.category);
  
  card.innerHTML = `
    <div class="member-card-image-wrapper">
      <img src="${member.image}" 
           alt="${member.name}" 
           class="member-card-image" 
           loading="lazy"
           onerror="this.onerror=null; this.src='${fallback}';">
      <span class="member-card-category">${categoryLabel}</span>
    </div>
    <div class="member-card-info">
      <h3 class="member-card-name">${member.name}</h3>
      <div class="member-card-role">${member.role}</div>
      <p class="member-card-specialty">${member.specialty || ''}</p>
    </div>
  `;
  
  card.addEventListener('click', () => openProfile(member));
  
  return card;
}

// ============================================
// LEADERSHIP CARDS
// ============================================

function initLeadershipCards() {
  const leadershipCards = document.querySelectorAll('.leadership-card');
  
  leadershipCards.forEach(card => {
    card.addEventListener('click', () => {
      const memberId = card.dataset.memberId;
      const member = getMemberById(memberId);
      if (member) {
        openProfile(member);
      }
    });
  });
}

// ============================================
// PROFILE MODAL & CREATOR DOSSIER
// ============================================

let currentMemberIndex = 0;

function initProfileModal() {
  const modal = document.getElementById('profileModal');
  const overlay = document.getElementById('profileOverlay');
  const closeBtn = document.getElementById('profileClose');
  const prevBtn = document.getElementById('modalPrevMemberBtn');
  const nextBtn = document.getElementById('modalNextMemberBtn');
  
  if (!modal) return;
  
  if (overlay) overlay.addEventListener('click', closeProfile);
  if (closeBtn) closeBtn.addEventListener('click', closeProfile);
  
  if (prevBtn) {
    prevBtn.addEventListener('click', prevProfile);
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', nextProfile);
  }
  
  document.addEventListener('keydown', (e) => {
    if (!modal.classList.contains('active')) return;
    
    if (e.key === 'Escape') {
      closeProfile();
    } else if (e.key === 'ArrowLeft') {
      prevProfile();
    } else if (e.key === 'ArrowRight') {
      nextProfile();
    }
  });
}

function prevProfile() {
  const allMembers = getAllMembers();
  if (!allMembers || allMembers.length === 0) return;
  currentMemberIndex = (currentMemberIndex - 1 + allMembers.length) % allMembers.length;
  openProfile(allMembers[currentMemberIndex]);
}

function nextProfile() {
  const allMembers = getAllMembers();
  if (!allMembers || allMembers.length === 0) return;
  currentMemberIndex = (currentMemberIndex + 1) % allMembers.length;
  openProfile(allMembers[currentMemberIndex]);
}

function openProfile(member) {
  const modal = document.getElementById('profileModal');
  if (!modal || !member) return;
  
  const allMembers = getAllMembers();
  const foundIdx = allMembers.findIndex(m => m.id === member.id);
  if (foundIdx !== -1) {
    currentMemberIndex = foundIdx;
  }
  
  const fallback = member.image || member.fallbackImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1000&fit=crop&crop=face';
  
  // Hero Image
  const heroImg = document.getElementById('profileHeroImage');
  if (heroImg) {
    heroImg.src = member.image || member.bannerImage || fallback;
    heroImg.alt = member.name;
    heroImg.onerror = function() {
      this.onerror = null;
      this.src = fallback;
    };
  }
  
  // Dynamic Overlay Background
  const overlay = document.querySelector('.profile-hero-overlay');
  if (overlay) {
    const overlayImage = member.overlayImage || member.image || member.bannerImage || fallback;
    overlay.style.background = `linear-gradient(to top, var(--black) 10%, rgba(10,10,10,0.4) 60%, transparent 100%), url('${overlayImage}') center/cover no-repeat`;
  }
  
  // Member Title & Subhead in Modal Body
  let profileTitleArea = document.getElementById('profileTitleArea');
  if (!profileTitleArea) {
    profileTitleArea = document.createElement('div');
    profileTitleArea.id = 'profileTitleArea';
    profileTitleArea.className = 'profile-title-area';
    const profileBody = document.querySelector('.profile-body');
    if (profileBody) profileBody.insertBefore(profileTitleArea, profileBody.firstChild);
  }
  
  profileTitleArea.innerHTML = `
    <div class="modal-category-badge">${getCategoryName(member.category)}</div>
    <h2 class="modal-member-name">${member.name}</h2>
    <div class="modal-member-role">${member.role}</div>
    ${member.tagline ? `<blockquote class="modal-tagline">“${member.tagline}”</blockquote>` : ''}
    ${member.specialty ? `<div class="modal-specialty"><span class="spec-label">SPECIALTY:</span> ${member.specialty}</div>` : ''}
  `;
  
  // Media DNA Grid
  const dnaGrid = document.getElementById('profileDnaGrid');
  const dnaSection = document.getElementById('profileDnaSection');
  if (dnaGrid) {
    const dnaValues = [
      {
        label: 'Storytelling & Narrative Pacing',
        val: member.mediaDNA?.storytelling ? Math.min(99, Math.max(72, Math.round(member.mediaDNA.storytelling > 50 ? member.mediaDNA.storytelling : member.mediaDNA.storytelling * 4.2))) : 92
      },
      {
        label: 'Cinematography & Framing',
        val: member.mediaDNA?.cinematography ? Math.min(99, Math.max(70, Math.round(member.mediaDNA.cinematography > 50 ? member.mediaDNA.cinematography : member.mediaDNA.cinematography * 4.1))) : 94
      },
      {
        label: 'Editing & Post-Production VFX',
        val: member.mediaDNA?.editing ? Math.min(99, Math.max(74, Math.round(member.mediaDNA.editing > 50 ? member.mediaDNA.editing : member.mediaDNA.editing * 4.3))) : 90
      },
      {
        label: 'Creative Direction & Innovation',
        val: member.mediaDNA?.creativity ? Math.min(99, Math.max(75, Math.round(member.mediaDNA.creativity > 50 ? member.mediaDNA.creativity : member.mediaDNA.creativity * 4.4))) : 95
      },
      {
        label: 'Production Leadership & Execution',
        val: member.mediaDNA?.leadership ? Math.min(99, Math.max(78, Math.round(member.mediaDNA.leadership > 50 ? member.mediaDNA.leadership : member.mediaDNA.leadership * 3.6))) : 96
      }
    ];

    dnaGrid.innerHTML = dnaValues.map(item => `
      <div class="dna-item">
        <div class="dna-header">
          <span class="dna-label">${item.label}</span>
          <span class="dna-percent">${item.val}%</span>
        </div>
        <div class="dna-bar-track">
          <div class="dna-bar-fill" style="width: ${item.val}%;"></div>
        </div>
      </div>
    `).join('');
    if (dnaSection) dnaSection.style.display = 'block';
  }
  
  // Bio
  const bioEl = document.getElementById('profileBio');
  if (bioEl) {
    bioEl.textContent = member.bio || 'Dedicated creator at DSA Media Crew, bringing stories to life through technical excellence and creative passion.';
  }
  
  // Skills
  const skillsGrid = document.getElementById('profileSkills');
  if (skillsGrid) {
    skillsGrid.innerHTML = (member.skills || ['Storytelling', 'Media Production', 'Creative Execution']).map(skill => 
      `<span class="skill-tag">${skill}</span>`
    ).join('');
  }
  
  // Credits
  const creditsList = document.getElementById('profileCredits');
  if (creditsList) {
    creditsList.innerHTML = (member.credits || ['DSA Media Productions', 'Campus Events Coverage']).map(credit => 
      `<span class="credit-item">✦ ${credit}</span>`
    ).join('');
  }
  
  // Artwork Gallery
  const artworkGallery = document.getElementById('artworkGallery');
  const artworkSection = document.getElementById('profileArtworkSection');
  if (artworkGallery) {
    if (member.artwork && member.artwork.length > 0) {
      if (artworkSection) artworkSection.style.display = 'block';
      artworkGallery.innerHTML = member.artwork.map(artworkUrl => `
        <div class="artwork-item">
          <img src="${artworkUrl}" alt="Artwork" loading="lazy">
        </div>
      `).join('');
    } else {
      if (artworkSection) artworkSection.style.display = 'none';
      artworkGallery.innerHTML = '';
    }
  }
  
  // Portfolio Photos
  const portfolioGallery = document.getElementById('portfolioGallery');
  const portfolioPhotosSection = document.getElementById('portfolioPhotosSection');
  if (portfolioGallery && portfolioPhotosSection) {
    if (member.portfolio && member.portfolio.photos && member.portfolio.photos.length > 0) {
      portfolioPhotosSection.style.display = 'block';
      portfolioGallery.innerHTML = member.portfolio.photos.map(photo => `
        <div class="portfolio-item">
          <img src="${photo.url}" alt="${photo.event}" loading="lazy">
          <div class="portfolio-item-info">
            <span class="portfolio-event">${photo.event}</span>
            <span class="portfolio-meta">${photo.date} • ${photo.role}</span>
          </div>
        </div>
      `).join('');
    } else {
      portfolioPhotosSection.style.display = 'none';
      portfolioGallery.innerHTML = '';
    }
  }
  
  // Portfolio Videos
  const videoReel = document.getElementById('videoReel');
  const portfolioVideosSection = document.getElementById('portfolioVideosSection');
  if (videoReel && portfolioVideosSection) {
    if (member.portfolio && member.portfolio.videos && member.portfolio.videos.length > 0) {
      portfolioVideosSection.style.display = 'block';
      videoReel.innerHTML = member.portfolio.videos.map(video => `
        <div class="video-item">
          <img src="${video.thumbnail}" alt="${video.project}" loading="lazy">
          <div class="video-play">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
          <div class="video-info">
            <span class="video-project">${video.project}</span>
            <span class="video-meta">${video.event} ${video.year} • ${video.role}</span>
          </div>
        </div>
      `).join('');
    } else {
      portfolioVideosSection.style.display = 'none';
      videoReel.innerHTML = '';
    }
  }
  
  // Social Links
  const socialLinks = document.getElementById('profileSocials');
  if (socialLinks) {
    const socials = member.socials || { instagram: 'https://instagram.com/dsamediacrew' };
    const socialIcons = {
      instagram: '📸 INSTAGRAM',
      linkedin: '💼 LINKEDIN',
      youtube: '▶ YOUTUBE',
      behance: '🎨 BEHANCE',
      github: '💻 GITHUB'
    };
    
    socialLinks.innerHTML = Object.entries(socials).map(([platform, url]) => 
      `<a href="${url}" target="_blank" rel="noopener noreferrer" class="social-link">${socialIcons[platform] || platform.toUpperCase()}</a>`
    ).join('');
  }
  
  // Clean up any legacy full portfolio link button if present
  const oldBtn = modal.querySelector('.modal-full-portfolio-btn, .portfolio-link-btn');
  if (oldBtn) {
    oldBtn.remove();
  }
  
  // Update profile counter
  const memberIndexNum = currentMemberIndex + 1;
  const profileIndexEl = document.getElementById('profileIndex');
  const totalMembersEl = document.getElementById('totalMembers');
  if (profileIndexEl) profileIndexEl.textContent = String(memberIndexNum).padStart(2, '0');
  if (totalMembersEl) totalMembersEl.textContent = String(allMembers.length);
  
  // Show modal
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  attachCursorHoverListeners();
}

function closeProfile() {
  const modal = document.getElementById('profileModal');
  if (!modal) return;
  
  modal.classList.remove('active');
  document.body.style.overflow = '';
}

// ============================================
// SCROLL ANIMATIONS
// ============================================

function initScrollAnimations() {
  const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
  };
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);
  
  const animatedElements = document.querySelectorAll('.leadership-card, .section-header, .closing-content');
  animatedElements.forEach(el => observer.observe(el));
}

// ============================================
// PARALLAX EFFECTS
// ============================================

function initParallaxEffects() {
  const heroContent = document.querySelector('.hero-content');
  if (!heroContent) return;
  
  window.addEventListener('scroll', () => {
    const scrolled = window.pageYOffset;
    if (scrolled < window.innerHeight) {
      heroContent.style.transform = `translateY(${scrolled * 0.15}px)`;
      heroContent.style.opacity = String(1 - (scrolled / window.innerHeight) * 0.7);
    }
  }, { passive: true });
}

// ============================================
// STORYTELLING & CONNECTIONS
// ============================================

function initStorytellingAnimations() {
  const heroLines = document.querySelectorAll('.hero-line');
  heroLines.forEach((line, index) => {
    line.style.animationDelay = `${index * 0.15}s`;
  });
}

function initLeadershipConnections() {
  const leadershipGrid = document.querySelector('.leadership-grid');
  if (!leadershipGrid) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        leadershipGrid.classList.add('connected');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.2 });
  
  observer.observe(leadershipGrid);
}
