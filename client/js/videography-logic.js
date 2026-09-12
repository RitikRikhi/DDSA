
// Cloudinary optimization utility
function optimizeCloudinaryUrl(url) {
    if (!url || !url.includes('res.cloudinary.com')) return url;
    if (url.includes('f_auto,q_auto')) return url;
    return url.replace('/upload/', '/upload/f_auto,q_auto/');
}

document.addEventListener('DOMContentLoaded', () => {
    let currentPage = 1;
    const itemsLimit = 6;
    let isLoading = false;
    const category = 'videography'; // Specific category for this page

    const videoGrid = document.getElementById('videographyVideoGrid');
    if (!videoGrid) return;

    async function loadVideos(page = 1) {
        if (isLoading) return;
        isLoading = true;

        if (page === 1) {
            videoGrid.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 2rem; color: var(--gold);">Loading...</div>';
        }

        try {
            const res = await fetch('/api/upload/files');
            const data = await res.json();
            const allFiles = data.files || [];
            
            console.log('All files from API:', allFiles);
            
            // Filter for videography category (same as gallery)
            const videos = allFiles.filter(file => {
                const categoryMatch = file.category && file.category.toLowerCase() === 'videography';
                console.log(`File: ${file.filename}, Category: ${file.category}, CategoryMatch: ${categoryMatch}`);
                return categoryMatch;
            });
            
            console.log('Filtered videos:', videos);

            if (page === 1) {
                videoGrid.innerHTML = '';
            }

            if (!videos || videos.length === 0) {
                if (page === 1) {
                    videoGrid.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 2rem; color: rgba(245,240,235,0.4);">No videos found in this category.</div>';
                }
                removeLoadMore();
                isLoading = false;
                return;
            }

            videos.forEach(video => {
                const videoItem = document.createElement('div');
                videoItem.className = 'video-item';
                videoItem.setAttribute('data-video', video.url);
                videoItem.setAttribute('data-rotation', 0);
                
                const isVideo = video.mimeType && video.mimeType.startsWith('video/');
                
                const timestamp = '#t=3';
                const transform = 'rotate(0deg)';

                const videoUrl = video.url.startsWith('/') ? video.url : `/media/${video.filename}`;
                
                // Only show play button for actual videos
                const playButton = isVideo ? `
                    <div class="video-play-btn">
                        <svg viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z" />
                        </svg>
                    </div>
                ` : '';
                
                // Use video element with poster/thumbnail for better preview
                if (isVideo) {
                    videoItem.innerHTML = `
                        <video 
                            src="${videoUrl}" 
                            class="video-thumbnail" 
                            muted 
                            playsinline 
                            preload="metadata"
                            poster="${videoUrl}${timestamp}"
                            style="width:100%; height:100%; object-fit: cover; transform: ${transform}; position: absolute;"
                        ></video>
                        ${playButton}
                        <div class="video-overlay">
                            <div class="video-info">
                                <p class="video-category">${video.category || 'Videography'}</p>
                                <h3 class="video-title">${video.title || video.filename || 'Untitled'}</h3>
                                <p class="video-year">${new Date(video.uploadedAt || Date.now()).getFullYear() || '2026'}</p>
                            </div>
                        </div>
                    `;
                } else {
                    videoItem.innerHTML = `
                        <img src="${videoUrl}" alt="${video.title}" class="video-thumbnail" loading="lazy" style="width:100%; height:100%; object-fit: cover; transform: rotate(0deg);">
                        <div class="video-overlay">
                            <div class="video-info">
                                <p class="video-category">${video.category || 'Videography'}</p>
                                <h3 class="video-title">${video.title || video.filename || 'Untitled'}</h3>
                                <p class="video-year">${new Date(video.uploadedAt || Date.now()).getFullYear() || '2026'}</p>
                            </div>
                        </div>
                    `;
                }
                videoGrid.appendChild(videoItem);
            });

            removeLoadMore();

        } catch (error) {
            console.error("Error loading videos:", error);
            if (page === 1) {
                videoGrid.innerHTML = '<div style="grid-column: span 2; text-align: center; padding: 2rem; color: var(--red);">Error loading videos.</div>';
            }
        } finally {
            isLoading = false;
        }
    }

    function setupLoadMore() {
        let btn = document.getElementById('loadMoreVideosBtn');
        if (!btn) {
            const container = document.createElement('div');
            container.id = 'loadMoreVideosContainer';
            container.style.textAlign = 'center';
            container.style.marginTop = '4rem';
            container.style.gridColumn = 'span 2';
            container.innerHTML = `<button id="loadMoreVideosBtn" class="btn-ghost" style="padding: 1rem 3rem;">Load More</button>`;
            videoGrid.parentNode.appendChild(container);
            btn = document.getElementById('loadMoreVideosBtn');
        }

        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            currentPage++;
            loadVideos(currentPage);
        });
    }

    function removeLoadMore() {
        const container = document.getElementById('loadMoreVideosContainer');
        if (container) container.remove();
    }

    loadVideos();
});
