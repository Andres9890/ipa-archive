#!/usr/bin/env python3
import os
import json
import time
from datetime import datetime
import subprocess
import re

def get_file_size(file_path):
    return os.path.getsize(file_path)

def get_file_upload_date(file_path):
    try:
        cmd = ["git", "log", "--format=%aI", "--reverse", "--", file_path]
        result = subprocess.run(cmd, capture_output=True, text=True)
        dates = result.stdout.strip().split('\n')
        
        if dates and dates[0]:
            return dates[0]
        
        return datetime.fromtimestamp(os.path.getmtime(file_path)).isoformat()
    except Exception as e:
        print(f"Error getting commit date for {file_path}: {e}")
        return datetime.now().isoformat()

def generate_index():
    directories = {
        "ipa": ".ipa",
        "deb": ".deb",
        "dylib": ".dylib"
    }
    
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"Created directory: {directory}")
    
    all_files = []
    
    for directory, extension in directories.items():
        if os.path.exists(directory):
            for filename in os.listdir(directory):
                if filename.lower().endswith(extension):
                    file_path = os.path.join(directory, filename)
                    file_size = get_file_size(file_path)
                    file_upload_date = get_file_upload_date(file_path)
                    
                    all_files.append({
                        "name": filename,
                        "size": file_size,
                        "type": directory,
                        "modified": datetime.fromtimestamp(os.path.getmtime(file_path)).strftime("%Y-%m-%d %H:%M:%S"),
                        "uploaded": file_upload_date,
                        "url": f"{directory}/{filename}"
                    })
    
    all_files.sort(key=lambda x: x["uploaded"], reverse=True)
    
    index_data = {
        "files": all_files,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_files": len(all_files),
        "files_by_type": {
            "ipa": len([f for f in all_files if f["type"] == "ipa"]),
            "deb": len([f for f in all_files if f["type"] == "deb"]),
            "dylib": len([f for f in all_files if f["type"] == "dylib"])
        }
    }

    os.makedirs("_data", exist_ok=True)
    with open("_data/files_index.json", "w") as f:
        json.dump(index_data, f, indent=2)
    
    with open("files_index.json", "w") as f:
        json.dump(index_data, f, indent=2)
    
    print(f"Generated index with {len(all_files)} files:")
    print(f"  - IPA files: {index_data['files_by_type']['ipa']}")
    print(f"  - DEB files: {index_data['files_by_type']['deb']}")
    print(f"  - DYLIB files: {index_data['files_by_type']['dylib']}")

if __name__ == "__main__":
    generate_index()
