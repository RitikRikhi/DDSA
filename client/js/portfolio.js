// Portfolio Page - Dynamic Content Loading with Live Backend Sync

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
  await syncLiveTeamData();
  loadPortfolio();
});

function loadPortfolio() {
  // Get member ID from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const memberId = urlParams.get('id');
  
  if (!memberId) {
    console.error('No member ID provided');
    window.location.href = 'team.html';
    return;
  }
  
  // Find member in team data
  const member = findMemberById(memberId);
  
  if (!member) {
    console.error('Member not found:', memberId);
    window.location.href = 'team.html';
    return;
  }
  
  // Populate portfolio with member data
  populatePortfolio(member);
}

function findMemberById(id) {
  // Check leadership first
  if (teamData.leadership.president.id === id) {
    return teamData.leadership.president;
  }
  
  const vp = teamData.leadership.vicePresidents.find(vp => vp.id === id);
  if (vp) return vp;
  
  // Check members array
  return teamData.members.find(member => member.id === id);
}

function populatePortfolio(member) {
  // Set page title
  document.title = `${member.name} | Portfolio | DSA Media Crew`;
  
  // Hero Section
  document.getElementById('profileImage').src = member.image;
  document.getElementById('profileRole').textContent = member.role;
  document.getElementById('profileName').textContent = member.name;
  document.getElementById('profileTagline').textContent = member.tagline;
  
  // Get category name
  const category = teamData.categories.find(cat => cat.id === member.category);
  document.getElementById('profileCategory').textContent = category ? category.name : member.category.toUpperCase();
  
  // Set hero banner background based on category or custom banner
  if (member.bannerImage) {
    const banner = document.getElementById('heroBanner');
    banner.style.backgroundImage = `url(${member.bannerImage})`;
    banner.style.backgroundSize = 'cover';
    banner.style.backgroundPosition = 'center';
  } else {
    setHeroBanner(member.category);
  }
  
  // About Section
  document.getElementById('aboutBio').textContent = member.bio;
  document.getElementById('aboutSpecialty').textContent = member.specialty;
  
  // Skills Section
  populateSkills(member.skills);
  
  // Media DNA Section
  populateMediaDNA(member.mediaDNA);
  
  // Work/Portfolio Section
  populateWork(member.portfolio);
  
  // Credits Section
  populateCredits(member.credits);
  
  // Social Links
  populateSocials(member.socials);
}

function setHeroBanner(category) {
  const banner = document.getElementById('heroBanner');
  const categoryColors = {
    'leader': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)',
    'photography': 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
    'videography': 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #404040 100%)',
    'design': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a3a 50%, #3a3a4a 100%)',
    'editing': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)',
    'content': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)',
    'tech': 'linear-gradient(135deg, #0a0a1a 0%, #1a1a2a 50%, #2a2a3a 100%)',
    'vlogging': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)',
    'onscreen': 'linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 50%, #3a3a3a 100%)'
  };
  
  banner.style.background = categoryColors[category] || categoryColors['leader'];
}

function populateSkills(skills) {
  const skillsGrid = document.getElementById('skillsGrid');
  skillsGrid.innerHTML = skills.map(skill => `
    <div class="skill-item">
      <span class="skill-name">${skill}</span>
    </div>
  `).join('');
}

function populateMediaDNA(mediaDNA) {
  const container = document.getElementById('mediaDNAContainer');
  container.innerHTML = Object.entries(mediaDNA).map(([key, value]) => `
    <div class="dna-item">
      <div class="dna-header">
        <span class="dna-label">${key}</span>
        <span class="dna-value">${value}%</span>
      </div>
      <div class="dna-bar">
        <div class="dna-fill" data-width="${value}%"></div>
      </div>
    </div>
  `).join('');
  
  // Animate DNA bars
  setTimeout(() => {
    container.querySelectorAll('.dna-fill').forEach(fill => {
      fill.style.width = fill.dataset.width;
    });
  }, 500);
}

function populateWork(portfolio) {
  const workGrid = document.getElementById('workGrid');
  let workItems = [];
  
  // Add photos
  if (portfolio.photos && portfolio.photos.length > 0) {
    portfolio.photos.forEach(photo => {
      workItems.push(`
        <div class="work-item">
          <img src="${photo.url}" alt="${photo.event}" class="work-image">
          <div class="work-overlay">
            <h3 class="work-title">${photo.event}</h3>
            <p class="work-meta">${photo.date} • ${photo.role}</p>
          </div>
        </div>
      `);
    });
  }
  
  // Add videos
  if (portfolio.videos && portfolio.videos.length > 0) {
    portfolio.videos.forEach(video => {
      workItems.push(`
        <div class="work-item">
          <img src="${video.thumbnail}" alt="${video.project}" class="work-image">
          <div class="work-overlay">
            <h3 class="work-title">${video.project}</h3>
            <p class="work-meta">${video.event} ${video.year} • ${video.role}</p>
          </div>
        </div>
      `);
    });
  }
  
  if (workItems.length === 0) {
    workGrid.innerHTML = '<p style="color: rgba(245, 240, 235, 0.5); text-align: center; grid-column: 1 / -1;">No portfolio items yet.</p>';
  } else {
    workGrid.innerHTML = workItems.join('');
  }
}

function populateCredits(credits) {
  const creditsList = document.getElementById('creditsList');
  creditsList.innerHTML = credits.map(credit => `
    <span class="credit-item">${credit}</span>
  `).join('');
}

function populateSocials(socials) {
  const socialLinks = document.getElementById('socialLinks');
  const socialIcons = {
    instagram: '📷',
    linkedin: '💼',
    youtube: '▶️',
    behance: '🎨',
    github: '💻'
  };
  
  const links = Object.entries(socials).map(([platform, url]) => `
    <a href="${url}" target="_blank" rel="noopener noreferrer" class="social-link">
      <span class="social-icon">${socialIcons[platform] || '🔗'}</span>
      <span>${platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
    </a>
  `).join('');
  
  socialLinks.innerHTML = links;
}
