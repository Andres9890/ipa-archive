#!/usr/bin/env python3
import os
import json
import time
from datetime import datetime

def get_file_size(file_path):
    return os.path.getsize(file_path)

def generate_index():
    ipa_dir = "ipa"
    
    if not os.path.exists(ipa_dir):
        os.makedirs(ipa_dir)
        print(f"Created directory: {ipa_dir}")
    
    ipa_files = []
    
    if os.path.exists(ipa_dir):
        for filename in os.listdir(ipa_dir):
            if filename.lower().endswith(".ipa"):
                file_path = os.path.join(ipa_dir, filename)
                file_size = get_file_size(file_path)
                file_mod_time = os.path.getmtime(file_path)
                
                ipa_files.append({
                    "name": filename,
                    "size": file_size,
                    "modified": datetime.fromtimestamp(file_mod_time).strftime("%Y-%m-%d %H:%M:%S"),
                    "url": f"ipa/{filename}"
                })
    
    ipa_files.sort(key=lambda x: x["name"].lower())
    
    index_data = {
        "ipa_files": ipa_files,
        "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_files": len(ipa_files)
    }

    os.makedirs("_data", exist_ok=True)
    with open("_data/ipa_index.json", "w") as f:
        json.dump(index_data, f, indent=2)
    
    with open("ipa_index.json", "w") as f:
        json.dump(index_data, f, indent=2)
    
    print(f"Generated index with {len(ipa_files)} IPA files")

if __name__ == "__main__":
    generate_index()
