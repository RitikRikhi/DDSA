// DSA Media Crew — Category Gallery Engine
// Handles Category Filtering, Category HUD Banners, EXIF / Cine Overlays, and Media Lightbox

const CATEGORY_META = {
  photography: {
    title: "PHOTOGRAPHY PORTFOLIO",
    tagline: "Prime glass, ambient light, candid human emotion, and decisive moments.",
    pill: "RAW OPTICS & EDITORIAL",
    features: ["Sony 85mm f/1.4 GM", "1/1000s Shutter Freeze", "Editorial Lighting", "Color Retouching", "Natural Mood"],
    accentColor: "#B8A06A"
  },
  videography: {
    title: "CINEMATOGRAPHY & FILMS",
    tagline: "Dynamic motion, anamorphic lens flares, sound sync, and festival scale.",
    pill: "4K UHD 60FPS MASTER",
    features: ["4K Multi-Cam", "DaVinci Color Grade", "DJI Ronin Gimbal", "Speed Ramping", "Bass-Heavy Sync"],
    accentColor: "#C8102E"
  },
  editing: {
    title: "EDITING & BRAND DESIGN",
    tagline: "Bold typography, 3D artboards, vector systems, and post-production craft.",
    pill: "VECTOR & POST-PROD",
    features: ["300 DPI Artboards", "CMYK & RGB Profiles", "After Effects VFX", "Brand Systems", "Motion Posters"],
    accentColor: "#00C0FF"
  },
  achievements: {
    title: "AWARDS & MILESTONES",
    tagline: "State championships, national media trophies, and verified excellence.",
    pill: "OFFICIAL RECOGNITIONS",
    features: ["🏆 National Awards", "🥇 Best Media Crew 2025", "⭐ Festival Laurels", "✦ Verified Milestones"],
    accentColor: "#FFD700"
  },
  reels: {
    title: "VIRAL REELS & SHORTS",
    tagline: "Fast-paced cuts, trending beats, 9:16 mobile immersion, and viral reach.",
    pill: "9:16 VERTICAL VIRAL",
    features: ["📱 100K+ Viral Views", "🎵 Trending Audio Sync", "⚡ Quick Hook Edits", "🔥 Engagement Power"],
    accentColor: "#FF3366"
  },
  "team-bts": {
    title: "TEAM BTS & BACKSTAGE",
    tagline: "Behind the lens, late night edit suites, camera rigs, and crew camaraderie.",
    pill: "CREW CONFIDENTIAL",
    features: ["👥 Crew Polaroids", "🎥 Gear Setups", "☕ 3 AM Edit Sessions", "🎒 On-Ground Production"],
    accentColor: "#00E676"
  },
  archives: {
    title: "LEGACY ARCHIVES",
    tagline: "Vintage moments, founding year heritage, and the evolution of DSA Media.",
    pill: "EST. 2020 — 2026",
    features: ["📼 Retro Film Rolls", "⏳ Founding Era Memories", "📷 Film Grain", "🏛 Campus History"],
    accentColor: "#A0A0A0"
  },
  sports: {
    title: "SPORTS & ATHLETIC ACTION",
    tagline: "High-octane sprints, explosive dunks, match point tension, and championship grit.",
    pill: "HIGH-SPEED ACTION FREEZE",
    features: ["⚡ 1/2000s High Speed", "🏀 Basketball Action", "⚽ Football League", "🏆 Gold Medal Matches"],
    accentColor: "#FF6600"
  }
};

// Curated Seed Data for authentic real camera media across all 8 categories
const CURATED_CATEGORY_ITEMS = [
  // 1. Photography (Authentic High-Res Real Camera Frames — No Overlays)
  {
    category: "photography",
    title: "Campus Horizon & Architectural Angle",
    eventName: "Campus Life Series",
    url: "/media/DSC02145-3.jpg",
    fallback: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    exif: "Sony A7 IV · 24mm · f/2.8 · 1/800s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Architectural Symmetry & Lead Lines",
    eventName: "Campus Architecture",
    url: "/media/DSC02413-2.jpg",
    fallback: "https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800",
    exif: "Sony FX3 · 35mm · f/2.0 · 1/640s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Editorial Profile in Ambient Light",
    eventName: "Portraits Series '25",
    url: "/media/DSC01903.jpg",
    fallback: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
    exif: "Sony A7R V · 50mm · f/1.4 · 1/800s · ISO 200",
    type: "image"
  },
  {
    category: "photography",
    title: "Editorial Depth & Decisive Gaze",
    eventName: "Studio Masterclass",
    url: "/media/DSC01949-2.jpg",
    fallback: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800",
    exif: "Sony 85mm GM · f/1.4 · 1/1200s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Artistic Contrast Silhouette",
    eventName: "Creative Frames",
    url: "/media/DSC01929-2.jpg",
    fallback: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800",
    exif: "Sony 85mm GM · f/1.4 · 1/2000s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Direct Decisive Focus",
    eventName: "Editorial Spotlight",
    url: "/media/DSC01937-2.jpg",
    fallback: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800",
    exif: "Sony 50mm GM · f/1.4 · 1/1000s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Candid Studio Expression",
    eventName: "Portraits Series",
    url: "/media/DSC01921-2.jpg",
    fallback: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=800",
    exif: "Sony 50mm · f/1.8 · 1/1200s · ISO 50",
    type: "image"
  },
  {
    category: "photography",
    title: "Monochrome Candid Character",
    eventName: "Black & White Showcase",
    url: "/media/DSC01897-2.jpg",
    fallback: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800",
    exif: "Sony 85mm · f/1.4 · 1/1000s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Modern Form & Geometric Rhythm",
    eventName: "Campus Horizons",
    url: "/media/DSC02141.jpg",
    fallback: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800",
    exif: "Sony 24mm GM · f/2.8 · 1/500s · ISO 200",
    type: "image"
  },
  {
    category: "photography",
    title: "Golden Hour Portraiture",
    eventName: "Campus Editorial '25",
    url: "/media/DSC01854-2.jpg",
    fallback: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800",
    exif: "Sony 85mm GM · f/1.4 · 1/800s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Natural Sunlight Frame",
    eventName: "Daylight Series",
    url: "/media/DSC01916-2.jpg",
    fallback: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800",
    exif: "Sony 35mm · f/1.8 · 1/1000s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "Cinematic Shadow & Expression",
    eventName: "Editorial Portraits",
    url: "/media/DSC01908-2.jpg",
    fallback: "https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=800",
    exif: "Sony 85mm · f/1.8 · 1/1600s · ISO 100",
    type: "image"
  },
  {
    category: "photography",
    title: "High-Contrast Stage & Ambient Light",
    eventName: "Cultural Live",
    url: "/media/DSC09737.jpg",
    fallback: "https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=800",
    exif: "Sony 70-200mm GM · f/2.8 · 1/400s · ISO 800",
    type: "image"
  },
  {
    category: "photography",
    title: "Decisive Expression Portrait",
    eventName: "Portraits Series",
    url: "/media/DSC01865.jpg",
    fallback: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800",
    exif: "Sony 50mm · f/1.8 · 1/1200s · ISO 100",
    type: "image"
  },

  // 2. Videography
  {
    category: "videography",
    title: "Meraki 26 Cinematic Opener",
    eventName: "Flagship Festival",
    url: "videos/digital_3d_logo.mp4",
    thumbnail: "img/events/meraki_hero.png",
    fallback: "https://images.unsplash.com/photo-1574717024653-61fd2cf4d44d?w=800",
    cine: "4K UHD · 60FPS · DaVinci Log",
    type: "video"
  },
  {
    category: "videography",
    title: "Campus Aftermovie Highlights",
    eventName: "Annual Fest 2025",
    url: "videos/digital_3d_logo.mp4",
    thumbnail: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800",
    fallback: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800",
    cine: "4K UHD · Anamorphic 2.39:1",
    type: "video"
  },

  // 3. Editing & Design
  {
    category: "editing",
    title: "Meraki 26 Key Visual System",
    eventName: "Brand Identity",
    url: "img/events/meraki_hero.png",
    fallback: "https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800",
    badge: "300 DPI · VECTOR · CMYK",
    type: "image"
  },
  {
    category: "editing",
    title: "Festival Stage Visual Artboard",
    eventName: "Stage Graphics",
    url: "img/events/vibe_lights.jpg",
    fallback: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800",
    badge: "MOTION ASSET · 4K LED",
    type: "image"
  },
  {
    category: "editing",
    title: "Typography Poster Exploration",
    eventName: "Merch & Print",
    url: "img/events/vibe_walk.jpg",
    fallback: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
    badge: "EDITORIAL TYPOGRAPHY",
    type: "image"
  },

  // 4. Achievements
  {
    category: "achievements",
    title: "Best University Media Team Trophy",
    eventName: "National Conclave 2025",
    url: "/media/1785907582095-627673572.jpg",
    fallback: "https://images.unsplash.com/photo-1569517282132-25d22f4573e6?w=800",
    achievementBadge: "🏆 1ST PLACE NATIONAL",
    type: "image"
  },
  {
    category: "achievements",
    title: "Excellence in Fest Coverage Award",
    eventName: "Inter-State Media Gala",
    url: "/media/1785907610855-132908618.jpg",
    fallback: "https://images.unsplash.com/photo-1578269174936-2709b6aeb913?w=800",
    achievementBadge: "🥇 GOLD MEDAL COVERAGE",
    type: "image"
  },
  {
    category: "achievements",
    title: "Outstanding Visual Production Seal",
    eventName: "Annual Media Honors",
    url: "/media/1785907765404-784620677.jpeg",
    fallback: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?w=800",
    achievementBadge: "⭐ OFFICIAL CITATION",
    type: "image"
  },

  // 5. Reels
  {
    category: "reels",
    title: "Freshers '26 Beat Drop Reel",
    eventName: "145K Views · Viral",
    url: "videos/digital_3d_logo.mp4",
    thumbnail: "img/events/vibe_walk.jpg",
    fallback: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=800",
    views: "145K Views",
    type: "video"
  },
  {
    category: "reels",
    title: "Backstage Crew Energy Reel",
    eventName: "98K Views · Trending",
    url: "videos/digital_3d_logo.mp4",
    thumbnail: "img/events/vibe_lights_new.jpg",
    fallback: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800",
    views: "98K Views",
    type: "video"
  },

  // 6. Team BTS
  {
    category: "team-bts",
    title: "Control Room Rig Setup",
    eventName: "Behind The Scenes",
    url: "/media/1785906493082-562083739.jpg",
    fallback: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800",
    gear: "Sony FX3 · RS3 Pro",
    type: "image"
  },
  {
    category: "team-bts",
    title: "Multi-Cam Field Crew",
    eventName: "Sports Day BTS",
    url: "/media/1785906658196-583166113.jpg",
    fallback: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800",
    gear: "Dual 70-200mm GM",
    type: "image"
  },
  {
    category: "team-bts",
    title: "Late Night Edit Suite Sync",
    eventName: "Post-Production Lab",
    url: "/media/1785906739384-678321550.jpg",
    fallback: "https://images.unsplash.com/photo-1536240478700-b869070f9279?w=800",
    gear: "Premiere · DaVinci Studio",
    type: "image"
  },

  // 7. Archives
  {
    category: "archives",
    title: "First Induction Class of 2020",
    eventName: "Founding Era [EST. 2020]",
    url: "/media/1786006588456-528487627.jpg",
    fallback: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=800",
    stamp: "REC · 2020 ARCHIVE",
    type: "image"
  },
  {
    category: "archives",
    title: "Legacy Quadrangle Ceremony",
    eventName: "Convocation 2021",
    url: "/media/1786006615025-892397051.jpg",
    fallback: "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=800",
    stamp: "HISTORIC VAULT",
    type: "image"
  },

  // 8. Sports
  {
    category: "sports",
    title: "Match Point Spikes Action",
    eventName: "Inter-College Volleyball",
    url: "/media/1785996976745-891173844.jpg",
    fallback: "https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800",
    sportsTag: "⚡ MATCH POINT · 1/2000s",
    type: "image"
  },
  {
    category: "sports",
    title: "Championship Sprint Finish",
    eventName: "Athletics Meet '25",
    url: "/media/1785997068460-963292386.jpg",
    fallback: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=800",
    sportsTag: "🥇 GOLD FINISH",
    type: "image"
  },
  {
    category: "sports",
    title: "Basketball League Finals",
    eventName: "Intramural Cup",
    url: "/media/1785997206905-53318846.jpg",
    fallback: "https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800",
    sportsTag: "🏀 SLAM DUNK PEAK",
    type: "image"
  }
];

document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  let initialCategory = urlParams.get('category') || 'photography';
  if (initialCategory === 'all' || initialCategory === 'vistoso') {
    initialCategory = 'photography';
  }

  // Initialize gallery category navigation
  initCategoryFilterButtons(initialCategory);

  // Load and render gallery
  loadGalleryWithCategory(initialCategory);
});

function initCategoryFilterButtons(activeCategory) {
  const filterBtns = document.querySelectorAll('.filter-btn');

  filterBtns.forEach(btn => {
    const cat = btn.dataset.category || 'photography';
    btn.classList.toggle('active', cat.toLowerCase() === activeCategory.toLowerCase());

    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const selectedCat = btn.dataset.category || 'photography';
      
      // Push URL parameter smoothly
      const newUrl = selectedCat === 'photography' ? '/gallery.html' : `/gallery.html?category=${selectedCat}`;
      window.history.pushState({}, '', newUrl);

      loadGalleryWithCategory(selectedCat);
    });
  });
}

function updateCategoryHudBanner(category, count) {
  const meta = CATEGORY_META[category.toLowerCase()] || CATEGORY_META.photography;
  
  const hudPill = document.getElementById('hudPill');
  const hudTitle = document.getElementById('hudTitle');
  const hudTagline = document.getElementById('hudTagline');
  const hudFeatures = document.getElementById('hudFeatures');
  const hudCount = document.getElementById('hudCount');

  if (hudPill) hudPill.textContent = meta.pill;
  if (hudTitle) hudTitle.textContent = meta.title;
  if (hudTagline) hudTagline.textContent = meta.tagline;
  if (hudCount) hudCount.textContent = count;

  if (hudFeatures && meta.features) {
    hudFeatures.innerHTML = meta.features.map(f => `<span class="hud-feature-tag">${f}</span>`).join('');
  }
}

async function loadGalleryWithCategory(category = 'photography') {
  const gallery = document.getElementById('galleryGrid');
  if (!gallery) return;

  gallery.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⏳</div>
      <div class="empty-text">Curating verified ${category.toUpperCase()} assets...</div>
    </div>
  `;

  try {
    // 1. Fetch server uploaded files
    let serverFiles = [];
    try {
      const res = await fetch('/api/upload/files');
      if (res.ok) {
        const data = await res.json();
        serverFiles = data.files || [];
      }
    } catch (e) {
      console.warn("Server files fetch notice:", e.message);
    }

    // 2. Format server uploaded files and FILTER OUT ALL MEMBER OVERLAY PICTURES
    const formattedServerFiles = serverFiles
      .filter(f => {
        const fn = (f.filename || '').toLowerCase();
        const orig = (f.originalname || '').toLowerCase();
        // Strict exclusion of all team overlay and member portrait files from gallery
        if (fn.includes('overlay') || orig.includes('overlay')) return false;
        if (['1.png', '2.png', '3.png', 'll.png', 'divya.png', 'garima.png', 'aditya_bajaj.png'].includes(fn)) return false;
        return true;
      })
      .map(f => {
        const fn = (f.filename || '').toLowerCase();
        const cat = (f.category || '').toLowerCase();
        const isVideo = f.type === 'video' || /\.(mp4|mov|webm)$/i.test(fn);
        
        let resolvedCategory = 'photography';
        if (isVideo) {
          resolvedCategory = 'videography';
        } else if (cat === 'bts' || cat === 'team-bts' || fn.startsWith('1785906')) {
          resolvedCategory = 'team-bts';
        } else if (cat === 'achievements' || fn.startsWith('1785907')) {
          resolvedCategory = 'achievements';
        } else if (cat === 'sports' || fn.startsWith('1785996') || fn.startsWith('1785997')) {
          resolvedCategory = 'sports';
        } else if (cat === 'archives' || fn.startsWith('1786006')) {
          resolvedCategory = 'archives';
        } else if (cat === 'editing' || cat === 'design') {
          resolvedCategory = 'editing';
        } else if (cat === 'reels') {
          resolvedCategory = 'reels';
        } else if (fn.startsWith('dsc')) {
          resolvedCategory = 'photography';
        } else if (cat && cat !== 'general' && cat !== 'all' && cat !== 'vistoso') {
          resolvedCategory = cat;
        }

        return {
          category: resolvedCategory,
          title: f.title || f.filename,
          eventName: f.eventName || 'DSA Media Production',
          url: f.url || `/media/${f.filename}`,
          fallback: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800',
          type: isVideo ? 'video' : 'image',
          exif: 'Sony FX3 · 50mm · f/1.8 · 1/1000s',
          cine: '4K UHD · 60FPS Pro',
          views: '85K Views',
          gear: 'Sony Master Lens',
          stamp: 'ARCHIVE VAULT',
          sportsTag: '⚡ MATCH ACTION'
        };
      });

    // 3. Combine unique items (Server uploaded + Curated Seed Items)
    // Avoid duplicate URLs
    const seenUrls = new Set();
    const allGalleryItems = [];

    [...formattedServerFiles, ...CURATED_CATEGORY_ITEMS].forEach(item => {
      if (!seenUrls.has(item.url)) {
        seenUrls.add(item.url);
        allGalleryItems.push(item);
      }
    });

    // 4. Update count badges on navigation buttons
    updateAllCategoryCounters(allGalleryItems);

    // 5. Filter for requested category
    const targetCat = (category || 'photography').toLowerCase();
    const displayedItems = allGalleryItems.filter(item => {
      const itemCat = (item.category || '').toLowerCase();
      if (targetCat === 'editing') return itemCat === 'editing' || itemCat === 'design';
      if (targetCat === 'team-bts') return itemCat === 'team-bts' || itemCat === 'bts';
      return itemCat === targetCat;
    });

    // Update HUD banner
    updateCategoryHudBanner(targetCat, displayedItems.length);

    // Render items
    gallery.innerHTML = '';
    if (displayedItems.length === 0) {
      gallery.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📷</div>
          <div class="empty-text">No assets currently cataloged under ${targetCat.toUpperCase()}.</div>
        </div>
      `;
      return;
    }

    displayedItems.forEach((item, index) => {
      const card = createCategoryGalleryCard(item, index, targetCat);
      gallery.appendChild(card);
    });

  } catch (err) {
    console.error("Gallery render error:", err);
    gallery.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-text">Error loading gallery content. Please refresh.</div>
      </div>
    `;
  }
}

function updateAllCategoryCounters(items) {
  const counts = {
    photography: 0,
    videography: 0,
    editing: 0,
    achievements: 0,
    reels: 0,
    "team-bts": 0,
    archives: 0,
    sports: 0
  };

  items.forEach(item => {
    const c = (item.category || '').toLowerCase();
    if (c === 'photography') counts.photography++;
    else if (c === 'videography') counts.videography++;
    else if (c === 'editing' || c === 'design') counts.editing++;
    else if (c === 'achievements') counts.achievements++;
    else if (c === 'reels') counts.reels++;
    else if (c === 'team-bts' || c === 'bts') counts["team-bts"]++;
    else if (c === 'archives') counts.archives++;
    else if (c === 'sports') counts.sports++;
    else counts.photography++;
  });

  Object.entries(counts).forEach(([cat, num]) => {
    const badge = document.getElementById(`count-${cat}`);
    if (badge) badge.textContent = num;
  });
}

function createCategoryGalleryCard(item, index, activeFilter) {
  const card = document.createElement('div');
  const cat = (item.category || 'photography').toLowerCase();
  const isVideo = item.type === 'video';
  const isReel = cat === 'reels';
  const isWide = !isReel && (index % 5 === 0);

  let customClass = `gallery-item ${isReel ? 'vertical' : isWide ? 'wide' : ''}`;
  if (cat === 'achievements') customClass += ' achievement-card';
  if (cat === 'team-bts') customClass += ' bts-card';
  card.className = customClass;

  const fallback = item.fallback || 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800';
  const displayTitle = item.title || 'DSA Production';
  const eventLabel = item.eventName || 'DSA Media Crew';

  // Category-specific micro HUD badge
  let categoryBadgesHtml = '';
  if (cat === 'photography' && item.exif) {
    categoryBadgesHtml = `<div class="exif-hud">📷 ${item.exif}</div>`;
  } else if (cat === 'videography' || isVideo) {
    categoryBadgesHtml = `<div class="cine-badge">${item.cine || '4K UHD'}</div>`;
  } else if (cat === 'achievements') {
    categoryBadgesHtml = `<div class="achievement-badge">${item.achievementBadge || '🏆 OFFICIAL RECOGNITION'}</div>`;
  } else if (cat === 'reels') {
    categoryBadgesHtml = `<div class="reels-badge">❤️ ${item.views || '120K Views'}</div>`;
  } else if (cat === 'team-bts') {
    categoryBadgesHtml = `<div class="bts-badge">👥 ${item.gear || 'BEHIND THE LENS'}</div>`;
  } else if (cat === 'sports') {
    categoryBadgesHtml = `<div class="sports-badge">${item.sportsTag || '⚡ ACTION FREEZE'}</div>`;
  } else if (cat === 'archives') {
    categoryBadgesHtml = `<div class="exif-hud" style="color:#aaa;">📼 ${item.stamp || 'ARCHIVE VAULT'}</div>`;
  }

  // Media Element
  let mediaHtml = '';
  if (isVideo) {
    mediaHtml = `
      <video muted loop onmouseover="this.play()" onmouseout="this.pause()" 
             src="${item.url}"
             poster="${item.thumbnail || fallback}"
             playsinline
             style="width:100%;height:100%;object-fit:cover;">
      </video>
      <button class="sound-toggle-btn" aria-label="Toggle Audio">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path>
        </svg>
      </button>
    `;
  } else {
    mediaHtml = `
      <img src="${item.url}" 
           alt="${displayTitle}" 
           loading="lazy"
           onerror="this.onerror=null; this.src='${fallback}';">
    `;
  }

  card.innerHTML = `
    <div class="gallery-media-wrapper">
      ${categoryBadgesHtml}
      ${mediaHtml}
      <div class="gallery-overlay">
        <span class="overlay-category-badge">${cat.toUpperCase()}</span>
        <h4 class="overlay-title">${displayTitle}</h4>
        <div class="overlay-meta">
          <span>📅 ${eventLabel}</span>
          <span>•</span>
          <span>✦ DSA CREW</span>
        </div>
      </div>
    </div>
  `;

  // Attach Lightbox click
  card.addEventListener('click', (e) => {
    if (e.target.closest('.sound-toggle-btn')) return;
    if (typeof openLightbox === 'function') {
      openLightbox(item.url, displayTitle, cat.toUpperCase(), isVideo ? 'video' : 'image');
    }
  });

  // Attach Video Sound Toggle
  if (isVideo) {
    const soundBtn = card.querySelector('.sound-toggle-btn');
    const vid = card.querySelector('video');
    if (soundBtn && vid) {
      soundBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        vid.muted = !vid.muted;
        if (vid.muted) {
          soundBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"></path></svg>`;
        } else {
          soundBtn.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"></path></svg>`;
          vid.play();
        }
      });
    }
  }

  return card;
}
