#!/bin/bash
# Convert and optimize icon images in the assets directory
# Note: This script uses some macOS-specific tools like 'sips'
cd "$(dirname "$0")" || exit

echo "⚠️  Some features of this script require macOS tools like 'sips'"
echo "   PIL/Pillow is used as a fallback on other platforms"

MAX_SIZE=120
total_converted=0

convert_with_pil() {
    # Use Python/PIL as a fallback on non-macOS systems
    python3 -c "
from PIL import Image
import os
import sys

try:
    img = Image.open('$1')
    width, height = img.size
    new_size = min($MAX_SIZE, max(width, height))
    img = img.resize((new_size, new_size), Image.LANCZOS)
    img = img.convert('RGB')
    img.save('$2', 'JPEG', quality=85)
    print(f'Converted and optimized {os.path.basename('$1')} to {os.path.basename('$2')}')
except Exception as e:
    print(f'Error processing {os.path.basename('$1')}: {e}', file=sys.stderr)
    sys.exit(1)
"
    return $?
}

convert_with_sips() {
    # Use sips on macOS
    if command -v sips &> /dev/null; then
        w=$(sips -g pixelWidth "$1" | cut -d: -f2 | tail -1 | xargs)
        if [ "$w" -gt $MAX_SIZE ]; then w=$MAX_SIZE; fi
        sips -Z "$w" "$1" -s format jpeg -o "$2" &> /dev/null
        return $?
    fi
    return 1
}

# Count total PNG files
total=$(find ../assets/app-icons -name "*.png" | wc -l)
total=${total##* }

if [ "$total" -eq 0 ]; then
    echo "No PNG files found in assets/app-icons directory."
    exit 0
fi

echo "Found $total PNG files to process."
i=0

# Process each PNG file
for file in ../assets/app-icons/*.png; do
    if [ ! -f "$file" ]; then continue; fi
    
    i=$((i+1))
    filename=$(basename "$file")
    base_name="${filename%.png}"
    out_file="../assets/app-icons/${base_name}.jpg"
    
    echo "[$i/$total] Processing $filename"
    
    # Try sips first (macOS), fall back to PIL
    if convert_with_sips "$file" "$out_file" || convert_with_pil "$file" "$out_file"; then
        if [ -f "$out_file" ]; then
            # Remove the original PNG if conversion successful
            rm "$file"
            total_converted=$((total_converted+1))
        fi
    else
        echo "Failed to convert $filename"
    fi
done

echo "Completed: Converted $total_converted out of $total files."
