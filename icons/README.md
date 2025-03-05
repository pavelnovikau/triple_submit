# Icon Generation Instructions

This folder contains SVG templates for the Triple Submit extension icons. You need to convert these to PNG files in appropriate sizes for the extension to work correctly.

## Method 1: Using Online Tools

1. Use an online SVG to PNG converter service:
   - [Convertio](https://convertio.co/svg-png/)
   - [SVG2PNG](https://svgtopng.com/)
   - [EZGIF](https://ezgif.com/svg-to-png)

2. Upload the SVG files (`icon_active.svg` and `icon_disabled.svg`) and convert them to the following sizes:
   - 16x16 pixels (icon16.png, icon16_disabled.png)
   - 48x48 pixels (icon48.png, icon48_disabled.png)
   - 128x128 pixels (icon128.png, icon128_disabled.png)

3. Rename the files according to the convention in the manifest.json:
   - From active SVG: icon16.png, icon48.png, icon128.png
   - From disabled SVG: icon16_disabled.png, icon48_disabled.png, icon128_disabled.png

## Method 2: Using Node.js script

If you have Node.js installed:

1. Install the sharp library:
   ```
   npm install sharp
   ```

2. Run the generation script:
   ```
   node generate_icons.js
   ```

This will automatically generate all required PNG files in the appropriate sizes.

## Method 3: Manual Creation

You can also create the icons manually using a graphics editor:

1. Create a blue circle with an Enter key symbol and three dots at the bottom
2. Create a gray version for the disabled state
3. Save in the following sizes:
   - 16x16 pixels (icon16.png, icon16_disabled.png)
   - 48x48 pixels (icon48.png, icon48_disabled.png)
   - 128x128 pixels (icon128.png, icon128_disabled.png)

## Icon Naming

Make sure the final icons have the exact names used in manifest.json:
- icon16.png
- icon48.png
- icon128.png
- icon16_disabled.png
- icon48_disabled.png
- icon128_disabled.png 