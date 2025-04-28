#!/bin/sh
# Extract and convert plist files from IPA archives
# Note: This script requires PlistBuddy, which is macOS-specific
cd "$(dirname "$0")" || exit

echo "This script requires macOS with PlistBuddy installed."

if [ $# = 0 ]; then
    echo 'Usage: ./convert_plist.sh [IPA_FILENAME]'
    echo 'Example: ./convert_plist.sh "Talking Tom v1.0 iOS3.0 C.ipa"'
    exit 0
fi

for ipa_file in "$@"; do
    # Create a temp directory
    tmp_dir=$(mktemp -d)
    
    echo "Processing $ipa_file..."
    
    # Extract the IPA (which is a ZIP file)
    unzip -q "../ipa/$ipa_file" -d "$tmp_dir"
    
    # Find the Info.plist file
    plist_file=$(find "$tmp_dir" -name "Info.plist" | head -1)
    
    if [ -z "$plist_file" ]; then
        echo "No Info.plist found in $ipa_file"
        rm -rf "$tmp_dir"
        continue
    fi
    
    # Directory for storing extracted plists
    mkdir -p "../_data/plists"
    
    # Extract filename without extension
    base_name=$(echo "$ipa_file" | sed 's/\.ipa$//')
    
    # Convert and save the plist
    if command -v /usr/libexec/PlistBuddy &> /dev/null; then
        /usr/libexec/PlistBuddy -x -c print "$plist_file" > "../_data/plists/${base_name}.plist"
        echo "Saved plist to _data/plists/${base_name}.plist"
    else
        # If PlistBuddy is not available, just copy the file
        cp "$plist_file" "../_data/plists/${base_name}.plist"
        echo "Copied plist to _data/plists/${base_name}.plist (not converted)"
    fi
    
    # Clean up
    rm -rf "$tmp_dir"
done

echo "Plist conversion complete."
