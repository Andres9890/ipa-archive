#!/bin/bash
# Find IPA files that don't have corresponding icon images
cd "$(dirname "$0")" || exit

echo "Checking for IPA files without corresponding icons..."

# Get all IPA filenames from database
while read -r filename; do
    base_name=$(echo "$filename" | sed 's/\.ipa$//')
    
    # Check if either JPG or PNG exists
    if [ ! -f "../assets/app-icons/${base_name}.jpg" ] && [ ! -f "../assets/app-icons/${base_name}.png" ]; then
        echo "$filename has no icon"
    fi
done < <(sqlite3 ../_data/ipa_database.db 'SELECT filename FROM apps;')

echo "Check complete."
