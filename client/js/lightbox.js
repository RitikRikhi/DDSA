/**
 * Premium Lightbox Module
 * Unified handling for Images and Videos
 */

let lightboxEl = null;
let currentGroup = [];
let currentIndex = -1;

function initLightbox() {
    if (document.getElementById('premium-lightbox')) return;

    lightboxEl = document.createElement('div');
    lightboxEl.id = 'premium-lightbox';
    lightboxEl.className = 'lightbox';
    lightboxEl.innerHTML = `
        <div class="lightbox-overlay"></div>
        <div class="lightbox-content">
            <button class="lightbox-close" aria-label="Close">&times;</button>
            <button class="lightbox-nav lightbox-prev" aria-label="Previous image">&#10094;</button>
            <div class="lightbox-media-wrapper"></div>
            <div class="lightbox-caption">
                <h3 class="lightbox-title"></h3>
                <p class="lightbox-category"></p>
            </div>
            <button class="lightbox-nav lightbox-next" aria-label="Next image">&#10095;</button>
        </div>
    `;

    document.body.appendChild(lightboxEl);

    // Event Listeners
    const closeBtn = lightboxEl.querySelector('.lightbox-close');
    const overlay = lightboxEl.querySelector('.lightbox-overlay');
    const prevBtn = lightboxEl.querySelector('.lightbox-prev');
    const nextBtn = lightboxEl.querySelector('.lightbox-next');

    closeBtn.onclick = closeLightbox;
    overlay.onclick = closeLightbox;
    prevBtn.onclick = (e) => { e.stopPropagation(); prevMedia(); };
    nextBtn.onclick = (e) => { e.stopPropagation(); nextMedia(); };

    document.addEventListener('keydown', (e) => {
        if (!lightboxEl.classList.contains('active')) return;
        if (e.key === 'Escape') closeLightbox();
        if (e.key === 'ArrowLeft') prevMedia();
        if (e.key === 'ArrowRight') nextMedia();
    });
}

function openLightbox(url, title = '', category = '', type = 'image', group = []) {
    if (!lightboxEl) initLightbox();

    currentGroup = group.length > 0 ? group : [{ url, title, category, type }];
    currentIndex = currentGroup.findIndex(item => item.url === url);
    if (currentIndex === -1) currentIndex = 0;

    updateLightboxContent();

    lightboxEl.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Show/hide nav based on group size
    const navs = lightboxEl.querySelectorAll('.lightbox-nav');
    navs.forEach(nav => nav.style.display = currentGroup.length > 1 ? 'flex' : 'none');
}

function updateLightboxContent() {
    const item = currentGroup[currentIndex];
    const wrapper = lightboxEl.querySelector('.lightbox-media-wrapper');
    const titleEl = lightboxEl.querySelector('.lightbox-title');
    const categoryEl = lightboxEl.querySelector('.lightbox-category');

    wrapper.innerHTML = ''; // Clear current
    
    if (item.type === 'video' || item.url.match(/\.(mp4|webm|ogg|mov)$/i)) {
        const video = document.createElement('video');
        video.src = item.url;
        video.className = 'lightbox-video';
        video.controls = true;
        video.autoplay = true;
        video.playsInline = true;
        video.setAttribute('controlsList', 'nodownload noplaybackrate');
        video.setAttribute('disablePictureInPicture', 'true');
        video.setAttribute('disableRemotePlayback', 'true');
        video.setAttribute('oncontextmenu', 'return false;');
        video.disablePictureInPicture = true;
        wrapper.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = item.url;
        img.className = 'lightbox-image';
        img.alt = item.title;
        img.setAttribute('draggable', 'false');
        img.setAttribute('oncontextmenu', 'return false;');
        wrapper.appendChild(img);
    }

    // Embed protective watermark badge
    const watermark = document.createElement('div');
    watermark.className = 'dsa-embedded-watermark';
    watermark.textContent = 'DSA MEDIA CREW · OFFICIAL ARCHIVE';
    wrapper.appendChild(watermark);

    // Embed invisible protection shield
    const shield = document.createElement('div');
    shield.className = 'media-protection-shield';
    shield.oncontextmenu = (e) => {
        e.preventDefault();
        if (window.DSA_MEDIA_PROTECTION && window.DSA_MEDIA_PROTECTION.showToast) {
            window.DSA_MEDIA_PROTECTION.showToast("Protected Lightbox Media · Downloading Disabled");
        }
        return false;
    };
    wrapper.appendChild(shield);

    titleEl.textContent = item.title || 'Untitled';
    categoryEl.textContent = item.category || '';
}

function closeLightbox() {
    if (lightboxEl) {
        lightboxEl.classList.remove('active');
        document.body.style.overflow = '';
        // Stop any playing video
        const video = lightboxEl.querySelector('video');
        if (video) video.pause();
    }
}

function nextMedia() {
    if (currentGroup.length <= 1) return;
    currentIndex = (currentIndex + 1) % currentGroup.length;
    updateLightboxContent();
}

function prevMedia() {
    if (currentGroup.length <= 1) return;
    currentIndex = (currentIndex - 1 + currentGroup.length) % currentGroup.length;
    updateLightboxContent();
}

// Auto-initialize
document.addEventListener('DOMContentLoaded', initLightbox);

// Expose to window
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
