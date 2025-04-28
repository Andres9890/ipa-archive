from PIL import Image
import os
import logging

# Set up logging
logging.basicConfig(filename='conversion_errors.log', level=logging.ERROR)

# Path to the app icons directory
root_folder_path = 'assets/app-icons'

# Traverse the directory
for root, dirs, files in os.walk(root_folder_path):
    # Process each PNG file
    for file_name in files:
        if file_name.lower().endswith('.png'):
            file_path = os.path.join(root, file_name)
            try:
                # Open PNG file
                with Image.open(file_path) as img:
                    # Convert to JPG
                    jpg_file_name = os.path.splitext(file_name)[0] + '.jpg'
                    jpg_file_path = os.path.join(root, jpg_file_name)
                    
                    # Convert to RGB (in case the PNG has transparency)
                    img_rgb = img.convert('RGB')
                    
                    # Resize to standard size (120x120 to match process_ipa.py)
                    img_rgb = img_rgb.resize((120, 120), Image.LANCZOS)
                    
                    # Save as JPG with good quality
                    img_rgb.save(jpg_file_path, 'JPEG', quality=85)
                    
                    # Log successful conversion
                    logging.info(f'Converted {file_path} to {jpg_file_path}')
                    
                    # Optionally delete the original PNG file
                    os.remove(file_path)
                    
            except Exception as e:
                # Log the error
                logging.error(f'Error converting {file_path}: {e}')

print('Conversion completed. Errors logged in conversion_errors.log.')
