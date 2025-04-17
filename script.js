document.addEventListener('DOMContentLoaded', function() {
    fetchIPAFiles();

    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', filterFiles);
});

async function fetchIPAFiles() {
    const filesList = document.getElementById('filesList');
    
    try {
        const response = await fetch('https://api.github.com/repos/YOUR_USERNAME/andres99-ipa-archive/contents/ipa');
        
        if (!response.ok) {
            throw new Error('Failed to fetch repository contents');
        }
        
        const data = await response.json();
        
        filesList.innerHTML = '';
        
        const ipaFiles = data.filter(file => file.name.toLowerCase().endsWith('.ipa'));
        
        if (ipaFiles.length === 0) {
            filesList.innerHTML = '<p class="no-files">No IPA files found. Upload some files to get started!</p>';
            return;
        }
        
        ipaFiles.forEach(file => {
            const fileElement = createFileElement(file);
            filesList.appendChild(fileElement);
        });
        
    } catch (error) {
        console.error('Error fetching files:', error);
        filesList.innerHTML = `
            <p class="no-files">
                Unable to load files. This might happen if the repository was just created or if the ipa directory doesn't exist yet.
                <br><br>
                Please create the ipa directory and add some IPA files to get started.
            </p>
        `;
    }
}

function createFileElement(file) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';
    fileItem.dataset.filename = file.name.toLowerCase();
    
    const sizeInKB = file.size / 1024;
    const sizeInMB = sizeInKB / 1024;
    const formattedSize = sizeInMB >= 1 
        ? `${sizeInMB.toFixed(2)} MB` 
        : `${sizeInKB.toFixed(2)} KB`;
    
    const downloadUrl = `ipa/${file.name}`;
    
    fileItem.innerHTML = `
        <div class="file-name">${file.name}</div>
        <div class="file-size">Size: ${formattedSize}</div>
        <a href="${downloadUrl}" class="download-btn" download>Download</a>
    `;
    
    return fileItem;
}

function filterFiles() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const fileItems = document.querySelectorAll('.file-item');
    
    fileItems.forEach(item => {
        const fileName = item.dataset.filename;
        if (fileName.includes(searchTerm)) {
            item.style.display = 'block';
        } else {
            item.style.display = 'none';
        }
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Get the current repository username from the URL
    const pathParts = window.location.pathname.split('/');
    const username = pathParts[1] === 'andres99-ipa-archive' ? pathParts[0].replace('/', '') : 'andres99';
    
    const script = document.querySelector('script').textContent;
    const updatedScript = script.replace('YOUR_USERNAME', username);
    
    const newScript = document.createElement('script');
    newScript.textContent = updatedScript;
    document.querySelector('script').replaceWith(newScript);
});
