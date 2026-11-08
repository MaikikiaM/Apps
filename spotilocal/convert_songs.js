const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const songsDir = path.join(__dirname, 'songs');
const files = fs.readdirSync(songsDir);

console.log('Starting conversion of songs to MP3...');

for (const file of files) {
  if (file.endsWith('.webm')) {
    const inputPath = path.join(songsDir, file);
    const outputPath = path.join(songsDir, file.replace(/\.webm$/, '.mp3'));
    console.log(`Converting: ${file} -> ${path.basename(outputPath)}`);
    try {
      execSync(`ffmpeg -y -i "${inputPath}" -vn -c:a libmp3lame -b:a 320k "${outputPath}"`, { stdio: 'inherit' });
      fs.unlinkSync(inputPath);
      console.log(`Converted and removed: ${file}`);
    } catch (e) {
      console.error(`Failed to convert ${file}:`, e.message);
    }
  }
}

console.log('Conversion complete!');
const finalFiles = fs.readdirSync(songsDir);
console.log('Final songs in directory:', finalFiles);
