#!/usr/bin/env python3
from pathlib import Path
import os
import json
import zipfile
import plistlib
import re
import shutil
from PIL import Image
import sqlite3
import base64
from datetime import datetime

# Set up directories
DATA_DIR = Path("_data")
ASSETS_DIR = Path("assets/app-icons")
IPA_DIR = Path("ipa")
DATABASE_PATH = DATA_DIR / "ipa_database.db"

# Ensure directories exist
DATA_DIR.mkdir(exist_ok=True)
ASSETS_DIR.mkdir(exist_ok=True, parents=True)

def init_database():
    """Initialize the SQLite database"""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    
    # Create tables if they don't exist
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT UNIQUE,
        bundle_id TEXT,
        title TEXT,
        version TEXT,
        min_os TEXT,
        platform INTEGER,
        size INTEGER,
        upload_date TEXT,
        has_icon INTEGER DEFAULT 0
    )
    ''')
    
    conn.commit()
    return conn, cursor

def extract_plist_from_ipa(ipa_path):
    """Extract Info.plist from an IPA file"""
    with zipfile.ZipFile(ipa_path, 'r') as zip_ref:
        # Find Info.plist path - usually in Payload/AppName.app/Info.plist
        plist_path_pattern = re.compile(r'Payload/[^/]+\.app/Info\.plist')
        for file in zip_ref.namelist():
            if plist_path_pattern.match(file):
                # Extract the plist file to a temporary location
                plist_content = zip_ref.read(file)
                try:
                    return plistlib.loads(plist_content)
                except:
                    print(f"Failed to parse plist from {ipa_path}")
                    return None
    return None

def extract_icon_from_ipa(ipa_path, app_name, icon_names):
    """Extract app icon from an IPA file"""
    if not icon_names:
        return False
    
    with zipfile.ZipFile(ipa_path, 'r') as zip_ref:
        # Look for the main app directory
        app_dir_pattern = re.compile(r'Payload/([^/]+)\.app/')
        app_dirs = set()
        
        for file in zip_ref.namelist():
            match = app_dir_pattern.match(file)
            if match:
                app_dirs.add(match.group(1))
        
        if not app_dirs:
            return False
        
        # Use the app name if available, otherwise use the first app directory found
        if app_name not in app_dirs and app_dirs:
            app_name = next(iter(app_dirs))
        
        # First check for iTunesArtwork
        try:
            if 'iTunesArtwork' in zip_ref.namelist():
                icon_data = zip_ref.read('iTunesArtwork')
                return icon_data
        except:
            pass
        
        # Then look for icon files
        for icon_name in icon_names:
            # Try different common icon paths and formats
            possible_paths = [
                f"Payload/{app_name}.app/{icon_name}",
                f"Payload/{app_name}.app/{icon_name}.png",
                f"Payload/{app_name}.app/{icon_name}@2x.png",
                f"Payload/{app_name}.app/{icon_name}@3x.png"
            ]
            
            for path in possible_paths:
                try:
                    if path in zip_ref.namelist():
                        icon_data = zip_ref.read(path)
                        return icon_data
                except:
                    continue
    
    return False

def get_icon_names_from_plist(plist):
    """Extract possible icon filenames from the plist"""
    if not plist:
        return []
    
    icon_names = []
    
    # Check CFBundleIcons (iOS 5.0+)
    if 'CFBundleIcons' in plist:
        icons_dict = plist['CFBundleIcons']
        if icons_dict and 'CFBundlePrimaryIcon' in icons_dict:
            primary_icon = icons_dict['CFBundlePrimaryIcon']
            if 'CFBundleIconFiles' in primary_icon:
                icon_names.extend(primary_icon['CFBundleIconFiles'])
            elif 'CFBundleIconName' in primary_icon:
                icon_names.append(primary_icon['CFBundleIconName'])
    
    # Check iPad icons
    if 'CFBundleIcons~ipad' in plist:
        ipad_icons = plist['CFBundleIcons~ipad']
        if ipad_icons and 'CFBundlePrimaryIcon' in ipad_icons:
            primary_icon = ipad_icons['CFBundlePrimaryIcon']
            if 'CFBundleIconFiles' in primary_icon:
                icon_names.extend(primary_icon['CFBundleIconFiles'])
    
    # Check legacy icon keys
    if 'CFBundleIconFiles' in plist:
        icon_names.extend(plist['CFBundleIconFiles'])
    
    if 'Icon files' in plist:
        icon_names.extend(plist['Icon files'])
    
    if 'CFBundleIconFile' in plist:
        icon_names.append(plist['CFBundleIconFile'])
    
    # Add some common icon names as fallbacks
    icon_names.extend(['Icon', 'AppIcon', 'AppIcon60x60'])
    
    return list(set(filter(None, icon_names)))  # Remove duplicates and None values

def save_icon(icon_data, filename):
    """Save icon data to file and optimize it"""
    if not icon_data:
        return False
    
    icon_path = ASSETS_DIR / f"{filename}.png"
    
    try:
        # Save the raw icon data
        with open(icon_path, 'wb') as f:
            f.write(icon_data)
        
        # Resize and optimize with PIL
        try:
            img = Image.open(icon_path)
            # Standardize size to 120x120
            img = img.resize((120, 120), Image.LANCZOS)
            # Convert to RGB if needed
            if img.mode != 'RGB':
                img = img.convert('RGB')
            # Save as JPG for smaller size
            jpg_path = ASSETS_DIR / f"{filename}.jpg"
            img.save(jpg_path, 'JPEG', quality=85)
            
            # Use the JPG version if successful and remove the PNG
            if os.path.exists(jpg_path):
                if os.path.exists(icon_path):
                    os.remove(icon_path)
                return True
        except Exception as e:
            print(f"Error optimizing icon for {filename}: {e}")
            return os.path.exists(icon_path)
            
    except Exception as e:
        print(f"Error saving icon for {filename}: {e}")
        return False

def get_platforms_from_plist(plist):
    """Determine supported platforms from plist"""
    if not plist:
        return 0
    
    platforms = 0
    if 'UIDeviceFamily' in plist:
        for device in plist['UIDeviceFamily']:
            platforms |= (1 << int(device))
    
    # Default to iPhone if no platform specified
    if platforms == 0:
        platforms = 2  # 1 << 1
    
    return platforms

def process_ipa_file(ipa_path, cursor, conn):
    """Process a single IPA file and extract metadata"""
    filename = os.path.basename(ipa_path)
    file_size = os.path.getsize(ipa_path)
    file_stats = os.stat(ipa_path)
    upload_date = datetime.fromtimestamp(file_stats.st_mtime).isoformat()
    
    # Check if we've already processed this file
    cursor.execute("SELECT id FROM apps WHERE filename = ?", (filename,))
    if cursor.fetchone():
        print(f"Skipping already processed file: {filename}")
        return
    
    print(f"Processing: {filename}")
    
    # Extract Info.plist
    plist = extract_plist_from_ipa(ipa_path)
    
    if not plist:
        # If we can't extract info, still add basic file info
        cursor.execute(
            "INSERT INTO apps (filename, size, upload_date) VALUES (?, ?, ?)",
            (filename, file_size, upload_date)
        )
        conn.commit()
        print(f"Added basic info for {filename} (no plist found)")
        return
    
    # Extract metadata
    bundle_id = plist.get('CFBundleIdentifier', '')
    title = plist.get('CFBundleDisplayName') or plist.get('CFBundleName', '')
    version = plist.get('CFBundleShortVersionString', '')
    build_version = plist.get('CFBundleVersion', '')
    
    # Combine version and build number
    if version and build_version and version != build_version:
        version = f"{version} ({build_version})"
    elif not version and build_version:
        version = build_version
    
    # Get minimum iOS version
    min_os = plist.get('MinimumOSVersion', '')
    
    # Get platforms (iPhone, iPad, etc.)
    platforms = get_platforms_from_plist(plist)
    
    # Extract and save icon
    icon_names = get_icon_names_from_plist(plist)
    app_name = os.path.splitext(title)[0] if title else None
    icon_data = extract_icon_from_ipa(ipa_path, app_name, icon_names)
    has_icon = save_icon(icon_data, os.path.splitext(filename)[0])
    
    # Store in database
    cursor.execute(
        """
        INSERT INTO apps 
        (filename, bundle_id, title, version, min_os, platform, size, upload_date, has_icon)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (filename, bundle_id, title, version, min_os, platforms, file_size, upload_date, 1 if has_icon else 0)
    )
    
    conn.commit()
    print(f"Added {filename} to database")

def export_app_data():
    """Export app data from the database to JSON"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute("""
    SELECT * FROM apps ORDER BY upload_date DESC
    """)
    
    apps = []
    for row in cursor.fetchall():
        app = dict(row)
        
        # Format file size
        app['size_formatted'] = format_file_size(app['size'])
        
        # Determine platform names
        platform_names = []
        if app['platform'] & 2:  # 1 << 1
            platform_names.append("iPhone")
        if app['platform'] & 4:  # 1 << 2
            platform_names.append("iPad")
        if app['platform'] & 8:  # 1 << 3
            platform_names.append("TV")
        if app['platform'] & 16:  # 1 << 4
            platform_names.append("Watch")
        
        app['platform_names'] = platform_names
        
        # Add icon path if available
        if app['has_icon']:
            base_name = os.path.splitext(app['filename'])[0]
            icon_jpg_path = ASSETS_DIR / f"{base_name}.jpg"
            icon_png_path = ASSETS_DIR / f"{base_name}.png"
            
            if os.path.exists(icon_jpg_path):
                app['icon_path'] = f"assets/app-icons/{base_name}.jpg"
            elif os.path.exists(icon_png_path):
                app['icon_path'] = f"assets/app-icons/{base_name}.png"
        
        apps.append(app)
    
    # Save to JSON file
    with open(DATA_DIR / 'ipa_data.json', 'w') as f:
        json.dump({
            'apps': apps,
            'total_count': len(apps),
            'generated_at': datetime.now().isoformat()
        }, f, indent=2)
    
    conn.close()
    print(f"Exported data for {len(apps)} apps to _data/ipa_data.json")

def format_file_size(size_bytes):
    """Format file size in a human-readable format"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024 or unit == 'GB':
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024

def main():
    # Initialize database
    conn, cursor = init_database()
    
    # Process all IPA files
    for ipa_file in IPA_DIR.glob('*.ipa'):
        process_ipa_file(ipa_file, cursor, conn)
    
    conn.close()
    
    # Export data to JSON
    export_app_data()
    
    print("IPA processing completed successfully!")

if __name__ == "__main__":
    main()
