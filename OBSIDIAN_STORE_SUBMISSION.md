# 🚀 Obsidian Plugin Store Submission

## Plugin Information

**Plugin Name**: PDF to MD
**Plugin ID**: pdf-to-md
**Author**: WANG Jian
**Version**: 2.0.0
**GitHub Repository**: https://github.com/Cosmoto-jian/obsidian-PDF-to-md

## Description

A powerful PDF to Markdown conversion plugin for Obsidian with 6 different conversion modes and folder organization features. Convert any PDF file directly within your vault with just one click.

### Key Features

- 📋 **6 Conversion Modes**: From Fast to Complete mode for different needs
- 📁 **Folder Organization**: Save converted files to custom folders
- 🎯 **High Quality**: Uses @opendataloader/pdf library for accurate conversion
- 🛠️ **No External Dependencies**: Works locally with just Java
- 🎨 **User-Friendly Interface**: Clean modal with mode selection

### Conversion Modes

1. **Fast Mode** - Quick basic conversion
2. **Standard Mode** - Balanced with layout detection (Default)
3. **Enhanced Mode** - Better images and text extraction
4. **OCR Mode** - For scanned documents
5. **Formula Mode** - Math formula detection
6. **Complete Mode** - All enhancements combined

## Technical Details

- **Platform**: Desktop only (requires Java)
- **Dependencies**: @opendataloader/pdf, Java 11+
- **License**: MIT
- **File Size**: ~19KB (main.js)

## Installation

1. Install Java 11+ (required for PDF conversion)
2. Install via Obsidian Community Plugins
3. Enable the plugin
4. Right-click any PDF → "Convert to Markdown"

## Testing

✅ All 6 conversion modes tested and working
✅ Folder output functionality verified
✅ Error handling tested
✅ UI/UX validated

## Repository Structure

```
obsidian-PDF-to-md/
├── main.js              # Production build
├── src/main.ts          # TypeScript source
├── styles.css           # Plugin styles
├── manifest.json        # Plugin manifest
├── package.json         # Dependencies
├── README.md            # Documentation
└── LICENSE              # MIT License
```

## Compliance

- ✅ Plugin ID is unique and follows naming conventions
- ✅ Code is open source (MIT License)
- ✅ No malicious code or data collection
- ✅ Follows Obsidian plugin guidelines
- ✅ Desktop-only as specified in manifest

## Support

For issues and feature requests, please use the GitHub repository:
https://github.com/Cosmoto-jian/obsidian-PDF-to-md/issues

## Changelog

### v2.0.0
- Added 6 conversion modes with dropdown selection
- Added output folder organization
- Enhanced UI with mode descriptions
- Fixed all compatibility issues
- Improved error handling

### v1.0.0
- Initial release with basic PDF conversion
- Fixed Electron compatibility issues
- Integrated @opendataloader/pdf library