const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');

// SVG with Kanban board icon - 3 columns with cards
const createSvg = (size) => {
  const padding = Math.round(size * 0.15);
  const innerSize = size - padding * 2;
  const colWidth = Math.round(innerSize / 3.5);
  const colGap = Math.round(innerSize * 0.08);
  const cardHeight = Math.round(innerSize * 0.12);
  const cardGap = Math.round(innerSize * 0.04);
  const cornerRadius = Math.round(size * 0.08);
  const cardRadius = Math.round(size * 0.02);
  
  // Column positions
  const col1X = padding + colGap / 2;
  const col2X = padding + colWidth + colGap;
  const col3X = padding + (colWidth + colGap) * 2 - colGap / 2;
  
  const startY = padding + innerSize * 0.15;
  
  return `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${cornerRadius}" fill="#6366f1"/>
  
  <!-- Column 1 - 3 cards -->
  <rect x="${col1X}" y="${startY}" width="${colWidth}" height="${cardHeight}" rx="${cardRadius}" fill="white" opacity="0.95"/>
  <rect x="${col1X}" y="${startY + cardHeight + cardGap}" width="${colWidth}" height="${cardHeight}" rx="${cardRadius}" fill="white" opacity="0.85"/>
  <rect x="${col1X}" y="${startY + (cardHeight + cardGap) * 2}" width="${colWidth}" height="${cardHeight}" rx="${cardRadius}" fill="white" opacity="0.75"/>
  
  <!-- Column 2 - 2 cards -->
  <rect x="${col2X}" y="${startY}" width="${colWidth}" height="${cardHeight}" rx="${cardRadius}" fill="white" opacity="0.95"/>
  <rect x="${col2X}" y="${startY + cardHeight + cardGap}" width="${colWidth}" height="${cardHeight}" rx="${cardRadius}" fill="white" opacity="0.85"/>
  
  <!-- Column 3 - 1 card -->
  <rect x="${col3X}" y="${startY}" width="${colWidth}" height="${cardHeight}" rx="${cardRadius}" fill="white" opacity="0.95"/>
</svg>`;
};

async function generateIcons() {
  // Ensure directory exists
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  const sizes = [
    { name: 'icon-192.png', size: 192 },
    { name: 'icon-512.png', size: 512 },
    { name: 'apple-touch-icon.png', size: 180 },
  ];

  for (const { name, size } of sizes) {
    const svg = createSvg(size);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(path.join(iconsDir, name));
    console.log(`Generated ${name}`);
  }

  // Generate favicon.ico (32x32)
  const faviconSvg = createSvg(32);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(path.join(iconsDir, 'favicon-32.png'));
  
  // Also put favicon in public root
  await sharp(Buffer.from(createSvg(32)))
    .png()
    .toFile(path.join(__dirname, '../public/favicon.png'));
  
  console.log('Generated favicon.png');
  console.log('Done!');
}

generateIcons().catch(console.error);
