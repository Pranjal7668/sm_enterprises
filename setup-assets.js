const fs = require('fs');
const path = require('path');

const srcDir = __dirname;
const destDir = path.join(__dirname, 'public', 'images');

// Ensure public/images directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  console.log('Created directory:', destDir);
}

const filesToCopy = [
  { src: 'Aramex Logo.jpg', dest: 'aramex.jpg' },
  { src: 'DHL logo.jpg', dest: 'dhl.jpg' },
  { src: 'DTDC logo.jpg', dest: 'dtdc.jpg' },
  { src: 'FedEx logo.jpg', dest: 'fedex.jpg' },
  { src: 'UPS logo.jpg', dest: 'ups.jpg' },
  { src: 'Sunny Chaudhary .jpeg', dest: 'sunny.jpg' },
  { src: 'Mohit Chaudhary .jpeg', dest: 'mohit.jpg' },
  { src: 'business logo.jpeg', dest: 'logo.jpg' },
  { src: 'dpd logo.jpg', dest: 'dpd.jpg' }
];

filesToCopy.forEach(item => {
  const srcPath = path.join(srcDir, item.src);
  const destPath = path.join(destDir, item.dest);

  if (fs.existsSync(srcPath)) {
    fs.copyFileSync(srcPath, destPath);
    console.log(`Successfully copied ${item.src} to public/images/${item.dest}`);
  } else {
    // Try to search case-insensitively or with trimmed spaces
    const trimmedSrc = item.src.trim();
    const matches = fs.readdirSync(srcDir).filter(f => f.trim().toLowerCase() === trimmedSrc.toLowerCase());
    if (matches.length > 0) {
      fs.copyFileSync(path.join(srcDir, matches[0]), destPath);
      console.log(`Successfully copied matched file ${matches[0]} to public/images/${item.dest}`);
    } else {
      console.warn(`Source file not found: "${item.src}" (Also searched trimmed: "${trimmedSrc}")`);
    }
  }
});
