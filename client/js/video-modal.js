
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('videoModal');
    const container = document.getElementById('videoContainer');
    const items = document.querySelectorAll('.video-item');
    const closeBtn = document.getElementById('closeModal');

    // Use event delegation to handle clicks even on newly loaded items
    document.addEventListener('click', (e) => {
        const item = e.target.closest('.video-item');
        if (!item) return;

        const videoSrc = item.getAttribute('data-video');
        const rotation = parseInt(item.getAttribute('data-rotation') || '0');
        if (!videoSrc) return;

        console.log("Attempting to play:", videoSrc);
        
        // Clear container
        container.innerHTML = '';

        if (videoSrc.includes('youtube.com') || videoSrc.includes('vimeo.com')) {
            const iframe = document.createElement('iframe');
            iframe.src = videoSrc + (videoSrc.includes('?') ? '&' : '?') + "autoplay=1";
            iframe.allow = "autoplay; encrypted-media";
            iframe.allowFullscreen = true;
            container.appendChild(iframe);
        } else {
            const video = document.createElement('video');
            video.src = videoSrc;
            video.autoplay = true;
            video.muted = true; 
            video.playsInline = true; 
            video.controls = true;
            video.setAttribute('controlsList', 'nodownload noplaybackrate');
            video.setAttribute('disablePictureInPicture', 'true');
            video.setAttribute('disableRemotePlayback', 'true');
            video.setAttribute('oncontextmenu', 'return false;');
            video.disablePictureInPicture = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.display = 'block';
            
            video.onloadeddata = () => console.log("Video data loaded successfully");
            video.onerror = (e) => {
                console.error("Video loading error:", e);
                container.innerHTML = `<div style="color:var(--white);padding:2rem;text-align:center;">
                    <h3>Error Loading Video</h3>
                    <p>Could not load: ${videoSrc}</p>
                    <p>Please ensure the file exists in the server's videos directory.</p>
                </div>`;
            };

            if (rotation !== 0) {
                video.style.transform = `rotate(${rotation}deg)`;
                // For 90 or 270 degree rotation, we might need to adjust how it fits
                if (rotation % 180 !== 0) {
                    video.style.width = 'auto';
                    video.style.height = '100%'; 
                    video.style.maxWidth = '100%';
                    container.style.aspectRatio = '9/16'; 
                }
            } else {
                container.style.aspectRatio = '16/9';
            }

            container.appendChild(video);

            // Add embedded watermark
            const watermark = document.createElement('div');
            watermark.className = 'dsa-embedded-watermark';
            watermark.textContent = 'DSA MEDIA CREW · OFFICIAL 4K';
            container.appendChild(watermark);
            
            // Show message if video is large/loading
            const loadingMsg = document.createElement('div');
            loadingMsg.id = "videoLoadingMsg";
            loadingMsg.style.cssText = "position:absolute;color:var(--gold);z-index:1;";
            loadingMsg.innerText = "Loading cinematic experience...";
            container.appendChild(loadingMsg);
            
            video.onplay = () => {
                if(document.getElementById('videoLoadingMsg')) document.getElementById('videoLoadingMsg').remove();
            };
        }

        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    });

    function closeModal() {
        modal.classList.remove('active');
        container.innerHTML = "";
        document.body.style.overflow = 'auto';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

    // Auto-play trigger for the first video if requested
    const autoPlayItem = document.getElementById('autoPlayVideo');
    if (autoPlayItem) {
        console.log("Auto-playing highlight video...");
        setTimeout(() => autoPlayItem.click(), 500); // Slight delay for smooth load
    }
});
