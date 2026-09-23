/**
 * DSA Media Crew - Fast Media & Performance Engine
 * Ensures instantaneous image/video loading, auto-lazy loading, memory optimization, and video streaming.
 */

(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    initImageOptimizations();
    initVideoPerformance();
    initPreconnects();
  });

  // 1. Optimize images on page
  function initImageOptimizations() {
    const images = document.querySelectorAll('img');
    images.forEach((img, idx) => {
      // First 2 images above the fold load immediately, others lazy
      if (idx > 2 && !img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
      if (!img.hasAttribute('decoding')) {
        img.setAttribute('decoding', 'async');
      }
      // Anti-download security attributes
      img.setAttribute('draggable', 'false');
      img.setAttribute('oncontextmenu', 'return false;');

      // Auto-optimize Cloudinary images for modern formats (WebP/AVIF)
      const src = img.getAttribute('src');
      if (src && src.includes('res.cloudinary.com') && !src.includes('f_auto,q_auto')) {
        img.src = src.replace('/upload/', '/upload/f_auto,q_auto,w_auto/');
      }

      // Smooth fade-in on load
      img.addEventListener('load', () => {
        img.classList.add('loaded');
      }, { once: true });
    });
  }

  // 2. Video Performance & Auto-Pause off-screen
  function initVideoPerformance() {
    const videos = document.querySelectorAll('video');
    if (videos.length === 0) return;

    videos.forEach(video => {
      video.setAttribute('controlsList', 'nodownload noplaybackrate');
      video.setAttribute('disablePictureInPicture', 'true');
      video.setAttribute('disableRemotePlayback', 'true');
      video.setAttribute('oncontextmenu', 'return false;');
      video.disablePictureInPicture = true;
      video.disableRemotePlayback = true;
    });

    // IntersectionObserver to pause videos when scrolled out of view (saves massive CPU/bandwidth)
    if ('IntersectionObserver' in window) {
      const videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const video = entry.target;
          if (entry.isIntersecting) {
            if (video.hasAttribute('autoplay') && video.paused) {
              video.play().catch(() => {});
            }
          } else {
            if (!video.paused) {
              video.pause();
            }
          }
        });
      }, { threshold: 0.15 });

      videos.forEach(video => {
        videoObserver.observe(video);
      });
    }
  }

  // 3. Preconnect to external CDNs
  function initPreconnects() {
    const domains = [
      'https://res.cloudinary.com',
      'https://images.unsplash.com',
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com'
    ];

    domains.forEach(domain => {
      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = domain;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }
})();
