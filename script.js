document.addEventListener('DOMContentLoaded', function() {
    fetchFiles();

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', filterFiles);

    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            filterFiles();
        });
    });
});

let archiveStats = {
    total: { count: 0, size: 0 },
    ipa: { count: 0, size: 0 },
    deb: { count: 0, size: 0 },
    dylib: { count: 0, size: 0 }
};

let appData = null;

async function fetchFiles() {
    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '<p class="loading">Loading files...</p>';
    
    try {
        try {
            const ipaDataResponse = await fetch('_data/ipa_data.json');
            if (ipaDataResponse.ok) {
                appData = await ipaDataResponse.json();
                console.log('Loaded enhanced IPA data:', appData);
            }
        } catch (err) {
            console.warn('Could not load enhanced IPA data:', err);
        }
        
        const indexResponse = await fetch('files_index.json');
        
        if (indexResponse.ok) {
            const indexData = await indexResponse.json();
            calculateStats(indexData.files);
            displayFiles(indexData.files);
            return;
        }
        
        const directories = ['ipa', 'deb', 'dylib'];
        let allFiles = [];
        
        for (const dir of directories) {
            try {
                const response = await fetch(`https://api.github.com/repos/andres9890/ipa-archive/contents/${dir}`);
                
                if (response.ok) {
                    const files = await response.json();
                    
                    if (Array.isArray(files)) {
                        const validFiles = files.filter(file => {
                            const extension = file.name.split('.').pop().toLowerCase();
                            return extension === dir;
                        });
                        
                        allFiles = allFiles.concat(validFiles.map(file => ({
                            ...file,
                            type: dir,
                            uploadDate: new Date(),
                            size: file.size || 0
                        })));
                    }
                }
            } catch (error) {
                console.warn(`Error fetching ${dir} directory:`, error);
            }
        }
        
        if (allFiles.length > 0) {
            calculateStats(allFiles);
            displayFiles(allFiles);
        } else {
            filesList.innerHTML = '<p class="no-files">No files found. Upload some files to get started!</p>';
            updateStatsDisplay('all');
        }
        
    } catch (error) {
        console.error('Error fetching files:', error);
        filesList.innerHTML = `
            <p class="no-files">
                Unable to load files. This might happen if the repository was just created or if the directories don't exist yet.
                <br><br>
                Please create the ipa, deb, and dylib directories and add some files to get started.
            </p>
        `;
        updateStatsDisplay('all');
    }
}

function calculateStats(files) {
    archiveStats = {
        total: { count: 0, size: 0 },
        ipa: { count: 0, size: 0 },
        deb: { count: 0, size: 0 },
        dylib: { count: 0, size: 0 }
    };
    
    files.forEach(file => {
        const fileType = file.type.toLowerCase();
        const fileSize = parseInt(file.size) || 0;
        
        if (archiveStats[fileType]) {
            archiveStats[fileType].count++;
            archiveStats[fileType].size += fileSize;
        }
        
        archiveStats.total.count++;
        archiveStats.total.size += fileSize;
    });
    
    updateStatsDisplay('all');
}

function updateStatsDisplay(filterType) {
    const totalFilesCountElement = document.getElementById('totalFilesCount');
    const totalArchiveSizeElement = document.getElementById('totalArchiveSize');
    
    const stats = filterType === 'all' ? archiveStats.total : archiveStats[filterType] || { count: 0, size: 0 };
    
    totalFilesCountElement.textContent = stats.count;
    totalArchiveSizeElement.textContent = formatFileSize(stats.size);
}

function formatFileSize(bytes) {
    if (bytes === 0) return "0 Bytes";
    
    const units = ["Bytes", "KB", "MB", "GB", "TB"];
    const decimals = 2;
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + units[i];
}

function displayFiles(files) {
    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '';
    
    if (files.length === 0) {
        filesList.innerHTML = '<p class="no-files">No files found. Upload some files to get started!</p>';
        updateStatsDisplay('all');
        return;
    }
    
    files.sort((a, b) => {
        const dateA = new Date(a.uploaded || a.modified || 0);
        const dateB = new Date(b.uploaded || b.modified || 0);
        
        if (dateA.getTime() === dateB.getTime()) {
            return a.name.localeCompare(b.name);
        }
        
        return dateB - dateA;
    });
    
    files.forEach(file => {
        const fileElement = createFileElement(file);
        filesList.appendChild(fileElement);
    });
}

function getAppDataForFile(filename) {
    if (!appData || !appData.apps) {
        return null;
    }
    
    return appData.apps.find(app => app.filename === filename);
}

function createFileElement(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.filename = file.name.toLowerCase();
    fileItem.dataset.filetype = file.type.toLowerCase();
    
    const enhancedData = file.type === 'ipa' ? getAppDataForFile(file.name) : null;
    
    const sizeInKB = file.size / 1024;
    const sizeInMB = sizeInKB / 1024;
    const formattedSize = enhancedData?.size_formatted || 
        (sizeInMB >= 1 ? `${sizeInMB.toFixed(2)} MB` : `${sizeInKB.toFixed(2)} KB`);
    
    const uploadDate = file.uploaded || file.modified
        ? new Date(file.uploaded || file.modified).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
          })
        : 'Unknown date';
    
    const downloadUrl = `${file.type}/${file.name}`;
    
    const fileTypeLabel = file.type.toUpperCase();
    
    if (!enhancedData) {
        fileItem.innerHTML = `
            <div class="file-name">
                <span class="file-type-tag file-type-${file.type}">${fileTypeLabel}</span>
                ${file.name}
            </div>
            <div class="file-info">
                <p>Size: ${formattedSize}</p>
                <p>Uploaded: ${uploadDate}</p>
            </div>
            <a href="${downloadUrl}" class="download-btn" download>Download</a>
        `;
        return fileItem;
    }
    
    const appTitle = enhancedData.title || file.name.replace('.ipa', '');
    const appVersion = enhancedData.version || 'Unknown';
    const bundleId = enhancedData.bundle_id || 'Unknown';
    const minOS = enhancedData.min_os || 'Unknown';
    const platforms = enhancedData.platform_names?.join(', ') || 'Unknown';
    const iconPath = enhancedData.icon_path || '';
    
    fileItem.classList.add('enhanced');
    fileItem.innerHTML = `
        <div class="app-header">
            ${iconPath ? `<img src="${iconPath}" class="app-icon" alt="${appTitle} icon">` : ''}
            <div class="app-title-container">
                <h3 class="app-title">${appTitle}</h3>
                <span class="app-version">v${appVersion}</span>
            </div>
        </div>
        <div class="app-info">
            <p><strong>Bundle ID:</strong> ${bundleId}</p>
            <p><strong>Min iOS:</strong> ${minOS}</p>
            <p><strong>Platforms:</strong> ${platforms}</p>
            <p><strong>Size:</strong> ${formattedSize}</p>
            <p><strong>Uploaded:</strong> ${uploadDate}</p>
        </div>
        <a href="${downloadUrl}" class="download-btn" download>Download IPA</a>
    `;
    
    return fileItem;
}

function filterFiles() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const fileTypeFilter = activeFilterBtn ? activeFilterBtn.dataset.type : 'all';
    
    updateStatsDisplay(fileTypeFilter);
    
    const fileItems = document.querySelectorAll('.file-item');
    let visibleCount = 0;
    
    fileItems.forEach(item => {
        const fileName = item.dataset.filename;
        const fileType = item.dataset.filetype;
        
        const matchesSearch = fileName.includes(searchTerm) || 
                             (item.textContent && item.textContent.toLowerCase().includes(searchTerm));
        const matchesType = fileTypeFilter === 'all' || fileType === fileTypeFilter;
        
        if (matchesSearch && matchesType) {
            item.style.display = 'block';
            visibleCount++;
        } else {
            item.style.display = 'none';
        }
    });
    
    const noFilesMessage = document.querySelector('.no-files-message');
    
    if (visibleCount === 0) {
        if (!noFilesMessage) {
            const message = document.createElement('p');
            message.className = 'no-files no-files-message';
            message.textContent = 'No files match your search criteria.';
            document.getElementById('filesList').appendChild(message);
        }
    } else if (noFilesMessage) {
        noFilesMessage.remove();
    }
}
