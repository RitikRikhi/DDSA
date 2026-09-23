/**
 * DSA Media Crew — Comprehensive Media Protection & Anti-Download Engine
 * Multi-layer security protecting images and videos across all viewports.
 * - Disables context menu (right-click) on media & cards
 * - Disables image/video dragging and dropping
 * - Removes download controls and Picture-in-Picture on all video streams
 * - Intercepts save/print shortcuts (Ctrl+S, Ctrl+P, etc.)
 * - Disables iOS/Android mobile long-press "Save Image" sheet
 * - Dynamic MutationObserver ensures dynamically loaded/lightbox media is protected
 * - Shows an elegant HUD Toast notification on download/copy attempts
 */

(function() {
  'use strict';

  // 1. Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMediaProtection);
  } else {
    initMediaProtection();
  }

  function initMediaProtection() {
    injectToastElement();
    protectExistingMedia();
    setupEventBlockers();
    setupMutationObserver();
    setupShortcutBlockers();
  }

  // 2. Inject Toast Notification Element
  function injectToastElement() {
    if (document.getElementById('dsa-protection-toast')) return;

    const toast = document.createElement('div');
    toast.id = 'dsa-protection-toast';
    toast.innerHTML = `
      <span class="toast-icon">🔒</span>
      <div class="toast-text">
        <strong>DSA MEDIA CREW ARCHIVE</strong>
        <span>Proprietary Media · Downloading & Capturing is Disabled</span>
      </div>
    `;
    document.body.appendChild(toast);
  }

  let toastTimeout = null;
  function showProtectionToast(message) {
    const toast = document.getElementById('dsa-protection-toast');
    if (!toast) return;

    if (message) {
      const span = toast.querySelector('.toast-text span');
      if (span) span.textContent = message;
    }

    toast.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 2400);
  }

  // 3. Apply protection attributes to media elements
  function protectMediaElement(el) {
    if (!el || el.dataset.dsaProtected === 'true') return;
    el.dataset.dsaProtected = 'true';

    // Disable dragging
    el.setAttribute('draggable', 'false');
    el.setAttribute('oncontextmenu', 'return false;');

    if (el.tagName === 'VIDEO') {
      // Disable video download options & PiP
      el.setAttribute('controlsList', 'nodownload noplaybackrate');
      el.setAttribute('disablePictureInPicture', 'true');
      el.setAttribute('disableRemotePlayback', 'true');
      el.disablePictureInPicture = true;
      el.disableRemotePlayback = true;
    }

    if (el.tagName === 'IMG') {
      el.setAttribute('decoding', 'async');
      el.style.userSelect = 'none';
      el.style.webkitUserSelect = 'none';
    }
  }

  // 4. Protect all existing media on page
  function protectExistingMedia() {
    const mediaElements = document.querySelectorAll('img, video, canvas, picture, .gallery-item, .video-item, .member-card, .leadership-card');
    mediaElements.forEach(protectMediaElement);
  }

  // 5. Setup Global Event Listeners (Right-click, Dragging, Long-press)
  function setupEventBlockers() {
    // Intercept Right Click (contextmenu)
    document.addEventListener('contextmenu', (e) => {
      const target = e.target;
      const isMedia = target.tagName === 'IMG' || 
                      target.tagName === 'VIDEO' || 
                      target.tagName === 'CANVAS' ||
                      target.closest('img, video, canvas, .gallery-media-wrapper, .video-item, .lightbox-content, .profile-hero, .member-card-image-wrapper, .leadership-image-wrapper, .video-container, .player-wrapper');

      if (isMedia) {
        e.preventDefault();
        e.stopPropagation();
        showProtectionToast("Proprietary Media · Right-click saving is disabled.");
        return false;
      }
    }, true);

    // Intercept Drag Start
    document.addEventListener('dragstart', (e) => {
      const target = e.target;
      if (target.tagName === 'IMG' || target.tagName === 'VIDEO' || target.closest('img, video')) {
        e.preventDefault();
        e.stopPropagation();
        showProtectionToast("Drag-to-save is disabled.");
        return false;
      }
    }, true);

    // Prevent iOS long-press selection & callout menu
    document.addEventListener('touchstart', (e) => {
      const target = e.target;
      if (target.tagName === 'IMG' || target.tagName === 'VIDEO') {
        target.style.webkitTouchCallout = 'none';
      }
    }, { passive: true });
  }

  // 6. Keyboard Shortcut Blockers (Ctrl+S, Ctrl+P, etc.)
  function setupShortcutBlockers() {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase();
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Ctrl/Cmd + S (Save Page)
      if (isCtrlOrCmd && key === 's') {
        e.preventDefault();
        showProtectionToast("Direct page saving is disabled.");
        return false;
      }

      // Ctrl/Cmd + P (Print Page)
      if (isCtrlOrCmd && key === 'p') {
        e.preventDefault();
        showProtectionToast("Printing protected media is disabled.");
        return false;
      }
    });
  }

  // 7. MutationObserver to automatically secure dynamically added content
  function setupMutationObserver() {
    if (!window.MutationObserver) return;

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === 1) { // ELEMENT_NODE
            if (node.matches && (node.matches('img') || node.matches('video') || node.matches('canvas'))) {
              protectMediaElement(node);
            }
            if (node.querySelectorAll) {
              const children = node.querySelectorAll('img, video, canvas');
              children.forEach(protectMediaElement);
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Expose global protection API if needed
  window.DSA_MEDIA_PROTECTION = {
    protectElement: protectMediaElement,
    showToast: showProtectionToast
  };
})();
