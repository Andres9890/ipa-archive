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

async function fetchFiles() {
    const filesList = document.getElementById('filesList');
    filesList.innerHTML = '<p class="loading">Loading files...</p>';
    
    try {
        const [ipaResponse, debResponse, dylibResponse] = await Promise.all([
            fetch('https://api.github.com/repos/andres9890/ipa-archive/contents/ipa'),
            fetch('https://api.github.com/repos/andres9890/ipa-archive/contents/deb'),
            fetch('https://api.github.com/repos/andres9890/ipa-archive/contents/dylib')
        ]);
        
        const ipaFiles = ipaResponse.ok ? await ipaResponse.json() : [];
        const debFiles = debResponse.ok ? await debResponse.json() : [];
        const dylibFiles = dylibResponse.ok ? await dylibResponse.json() : [];
        
        const allFiles = [
            ...(!Array.isArray(ipaFiles) ? [] : ipaFiles.map(file => ({ ...file, type: 'ipa' }))),
            ...(!Array.isArray(debFiles) ? [] : debFiles.map(file => ({ ...file, type: 'deb' }))),
            ...(!Array.isArray(dylibFiles) ? [] : dylibFiles.map(file => ({ ...file, type: 'dylib' })))
        ];
        
        filesList.innerHTML = '';
        
        const validFiles = allFiles.filter(file => {
            const extension = file.name.split('.').pop().toLowerCase();
            return (file.type === 'ipa' && extension === 'ipa') || 
                   (file.type === 'deb' && extension === 'deb') || 
                   (file.type === 'dylib' && extension === 'dylib');
        });
        
        if (validFiles.length === 0) {
            filesList.innerHTML = '<p class="no-files">No files found, Upload some files to get started!</p>';
            return;
        }
        
        const fileDetails = await Promise.all(
            validFiles.map(async file => {
                try {
                    const response = await fetch(file.url);
                    const details = await response.json();
                    
                    const commitsResponse = await fetch(`https://api.github.com/repos/andres9890/ipa-archive/commits?path=${file.path}`);
                    const commits = await commitsResponse.json();
                    
                    const uploadDate = commits.length > 0 
                        ? new Date(commits[commits.length - 1].commit.author.date)
                        : new Date();
                    
                    return {
                        ...file,
                        size: details.size,
                        uploadDate: uploadDate
                    };
                } catch (error) {
                    return {
                        ...file,
                        size: 0,
                        uploadDate: new Date()
                    };
                }
            })
        );
        
        fileDetails.sort((a, b) => b.uploadDate - a.uploadDate);
        
        fileDetails.forEach(file => {
            const fileElement = createFileElement(file);
            filesList.appendChild(fileElement);
        });
        
    } catch (error) {
        console.error('Error fetching files:', error);
        filesList.innerHTML = `
            <p class="no-files">
                Unable to load files. This might happen if the repository was just created or if the directories don't exist yet.
                <br><br>
                Please create the ipa, deb, and dylib directories and add some files to get started.
            </p>
        `;
    }
}

function createFileElement(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.filename = file.name.toLowerCase();
    fileItem.dataset.filetype = file.type.toLowerCase();
    
    const sizeInKB = file.size / 1024;
    const sizeInMB = sizeInKB / 1024;
    const formattedSize = sizeInMB >= 1 
        ? `${sizeInMB.toFixed(2)} MB` 
        : `${sizeInKB.toFixed(2)} KB`;
    
    const uploadDate = file.uploadDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    
    const downloadUrl = `${file.type}/${file.name}`;
    
    const fileTypeLabel = file.type.toUpperCase();
    
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

function filterFiles() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const activeFilterBtn = document.querySelector('.filter-btn.active');
    const fileTypeFilter = activeFilterBtn ? activeFilterBtn.dataset.type : 'all';
    
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const fileName = item.dataset.filename;
        const fileType = item.dataset.filetype;
        
        const matchesSearch = fileName.includes(searchTerm);
        const matchesType = fileTypeFilter === 'all' || fileType === fileTypeFilter;
        
        if (matchesSearch && matchesType) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
    
    const visibleFiles = document.querySelectorAll('.file-item[style="display: block;"]');
    const noFilesMessage = document.querySelector('.no-files-message');
    
    if (visibleFiles.length === 0 && !noFilesMessage) {
        const message = document.createElement('p');
        message.className = 'no-files no-files-message';
        message.textContent = 'No files match your search criteria.';
        document.getElementById('filesList').appendChild(message);
    } else if (visibleFiles.length > 0 && noFilesMessage) {
        noFilesMessage.remove();
    }
}
