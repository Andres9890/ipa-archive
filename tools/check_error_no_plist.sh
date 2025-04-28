#!/bin/bash
# Check for inconsistencies between database and icon files
cd "$(dirname "$0")" || exit

# Create a tools/README.md to explain this script's purpose
if [ ! -f "README.md" ]; then
    echo "# IPA Archive Utility Scripts

This directory contains utility scripts for maintaining the IPA archive.
These scripts are primarily for development and maintenance purposes." > README.md
fi

echo "Checking for files that should have icons but don't..."

# Ensure SQLite is installed
if ! command -v sqlite3 &> /dev/null; then
    echo "SQLite3 is required for this script to run."
    exit 1
fi

# Check if the database exists
if [ ! -f "../_data/ipa_database.db" ]; then
    echo "Database not found at _data/ipa_database.db"
    exit 1
fi

# Find apps marked as having icons (has_icon=1) but missing the actual icon file
while read -r filename; do
    base_name=$(echo "$filename" | sed 's/\.ipa$//')
    
    if [ ! -f "../assets/app-icons/${base_name}.jpg" ] && [ ! -f "../assets/app-icons/${base_name}.png" ]; then
        echo "Missing icon for $filename"
    fi
done < <(sqlite3 ../_data/ipa_database.db 'SELECT filename FROM apps WHERE has_icon=1;')

echo "Check complete."
