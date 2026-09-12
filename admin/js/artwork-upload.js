// Artwork Upload Admin Portal

let selectedMember = null;
let selectedFiles = [];
let allMembers = [];

// Initialize the portal
document.addEventListener('DOMContentLoaded', () => {
  loadMembers();
  setupEventListeners();
});

function loadMembers() {
  // Get all members from teamData
  allMembers = teamData.members;
  
  // Populate member select dropdown
  const memberSelect = document.getElementById('memberSelect');
  
  allMembers.forEach(member => {
    const option = document.createElement('option');
    option.value = member.id;
    option.textContent = `${member.name} - ${member.role}`;
    memberSelect.appendChild(option);
  });
}

function setupEventListeners() {
  const memberSelect = document.getElementById('memberSelect');
  const artworkInput = document.getElementById('artworkInput');
  const uploadBtn = document.getElementById('uploadBtn');
  
  // Member selection change
  memberSelect.addEventListener('change', (e) => {
    selectedMember = allMembers.find(m => m.id === e.target.value);
    if (selectedMember) {
      loadCurrentArtwork();
    } else {
      document.getElementById('currentArtworkSection').style.display = 'none';
    }
  });
  
  // File input change
  artworkInput.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files);
    displayPreview();
    updateUploadButton();
  });
  
  // Upload button click
  uploadBtn.addEventListener('click', handleUpload);
}

function displayPreview() {
  const previewSection = document.getElementById('previewSection');
  const previewGrid = document.getElementById('previewGrid');
  
  previewGrid.innerHTML = '';
  
  if (selectedFiles.length === 0) {
    previewSection.style.display = 'none';
    return;
  }
  
  previewSection.style.display = 'block';
  
  selectedFiles.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const previewItem = document.createElement('div');
      previewItem.className = 'preview-item';
      previewItem.innerHTML = `
        <img src="${e.target.result}" alt="Preview">
        <button class="remove-btn" onclick="removeFile(${index})">×</button>
      `;
      previewGrid.appendChild(previewItem);
    };
    reader.readAsDataURL(file);
  });
}

function removeFile(index) {
  selectedFiles.splice(index, 1);
  displayPreview();
  updateUploadButton();
  
  // Reset file input
  const artworkInput = document.getElementById('artworkInput');
  artworkInput.value = '';
}

function updateUploadButton() {
  const uploadBtn = document.getElementById('uploadBtn');
  uploadBtn.disabled = !selectedMember || selectedFiles.length === 0;
}

async function loadCurrentArtwork() {
  if (!selectedMember) return;
  
  const currentArtworkSection = document.getElementById('currentArtworkSection');
  const currentArtworkGrid = document.getElementById('currentArtworkGrid');
  
  currentArtworkGrid.innerHTML = '';
  
  // Check if member has artwork property
  if (selectedMember.artwork && selectedMember.artwork.length > 0) {
    currentArtworkSection.style.display = 'block';
    
    selectedMember.artwork.forEach((artworkUrl, index) => {
      const artworkItem = document.createElement('div');
      artworkItem.className = 'current-artwork-item';
      artworkItem.innerHTML = `
        <img src="${artworkUrl}" alt="Artwork">
        <button class="delete-btn" onclick="deleteArtwork(${index})">×</button>
      `;
      currentArtworkGrid.appendChild(artworkItem);
    });
  } else {
    currentArtworkSection.style.display = 'none';
  }
}

async function handleUpload() {
  if (!selectedMember || selectedFiles.length === 0) return;
  
  const uploadBtn = document.getElementById('uploadBtn');
  const uploadStatus = document.getElementById('uploadStatus');
  
  uploadBtn.disabled = true;
  uploadStatus.className = 'upload-status loading';
  uploadStatus.textContent = 'Uploading artwork...';
  
  try {
    const formData = new FormData();
    formData.append('memberId', selectedMember.id);
    
    selectedFiles.forEach(file => {
      formData.append('artwork', file);
    });
    
    const response = await fetch('/api/upload-artwork', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (response.ok) {
      uploadStatus.className = 'upload-status success';
      uploadStatus.textContent = 'Artwork uploaded successfully!';
      
      // Clear selection
      selectedFiles = [];
      document.getElementById('artworkInput').value = '';
      displayPreview();
      updateUploadButton();
      
      // Reload current artwork
      loadCurrentArtwork();
      
      // Clear status after 3 seconds
      setTimeout(() => {
        uploadStatus.textContent = '';
        uploadStatus.className = 'upload-status';
      }, 3000);
    } else {
      throw new Error(result.message || 'Upload failed');
    }
  } catch (error) {
    uploadStatus.className = 'upload-status error';
    uploadStatus.textContent = `Error: ${error.message}`;
    uploadBtn.disabled = false;
  }
}

async function deleteArtwork(index) {
  if (!selectedMember) return;
  
  if (!confirm('Are you sure you want to delete this artwork?')) return;
  
  try {
    const response = await fetch('/api/delete-artwork', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        memberId: selectedMember.id,
        artworkIndex: index
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      loadCurrentArtwork();
    } else {
      alert('Failed to delete artwork: ' + (result.message || 'Unknown error'));
    }
  } catch (error) {
    alert('Error deleting artwork: ' + error.message);
  }
}
