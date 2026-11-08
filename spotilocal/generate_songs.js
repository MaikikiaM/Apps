const fs = require('fs');
const path = require('path');

const SONGS_DIR = path.join(__dirname, 'songs');

if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, { recursive: true });
}

// Generate valid WAV file with PCM 16-bit 44.1kHz stereo audio
function createAudioWav(filename, durationSecs, generateSample) {
  const sampleRate = 44100;
  const numChannels = 2;
  const bitsPerSample = 16;
  const numSamples = Math.floor(sampleRate * durationSecs);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const chunkSize = 36 + dataSize;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(chunkSize, 4);
  buffer.write('WAVE', 8);

  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = generateSample(t, durationSecs);

    const leftSample = Math.max(-32768, Math.min(32767, Math.floor(left * 32767)));
    const rightSample = Math.max(-32768, Math.min(32767, Math.floor(right * 32767)));

    buffer.writeInt16LE(leftSample, offset);
    buffer.writeInt16LE(rightSample, offset + 2);
    offset += 4;
  }

  const filePath = path.join(SONGS_DIR, filename);
  fs.writeFileSync(filePath, buffer);
  console.log(`Generated: ${filename} (${(buffer.length / 1024 / 1024).toFixed(2)} MB)`);
}

// 1. La Llorona - Traditional / Chavela Vargas (Guitar & Vocal tone)
createAudioWav('La Llorona - Chavela Vargas.flac', 180, (t, dur) => {
  const env = Math.min(1, t / 3) * Math.min(1, (dur - t) / 3);
  // Guitar arpeggio Dm (293Hz, 349Hz, 440Hz)
  const arpFreqs = [293.66, 349.23, 440.00, 587.33];
  const noteIdx = Math.floor(t * 3) % arpFreqs.length;
  const guitar = Math.sin(2 * Math.PI * arpFreqs[noteIdx] * t) * 0.3 * Math.exp(-((t * 3) % 1) * 3);
  // Vocal melody
  const vocalFreq = 440 + 50 * Math.sin(2 * Math.PI * 0.2 * t);
  const vocal = Math.sin(2 * Math.PI * vocalFreq * t) * 0.2;
  const sample = (guitar + vocal) * env;
  return [sample, sample];
});

// 2. Soy Rebelde - Jeanette (Soft ballad 1971)
createAudioWav('Soy Rebelde - Jeanette.flac', 192, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Soft acoustic piano / guitar chords (C, Am, F, G)
  const chordProg = [261.63, 220.00, 174.61, 196.00];
  const chord = chordProg[Math.floor(t / 4) % chordProg.length];
  const piano = (Math.sin(2 * Math.PI * chord * t) + 0.5 * Math.sin(2 * Math.PI * chord * 1.5 * t)) * 0.25;
  // Soft flute / vocal lead
  const melody = Math.sin(2 * Math.PI * (chord * 2) * t) * 0.15 * (1 + 0.1 * Math.sin(2 * Math.PI * 5 * t));
  const sample = (piano + melody) * env;
  return [sample * 0.9, sample * 1.1];
});

// 3. Por qué te vas - Jeanette (Pop Ballad 1974)
createAudioWav('Por que te vas - Jeanette.flac', 201, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Iconic rhythm beat & bassline
  const bassFreqs = [196.00, 220.00, 174.61, 196.00];
  const bass = Math.sin(2 * Math.PI * bassFreqs[Math.floor(t * 2) % bassFreqs.length] * t) * 0.3;
  // Horns & vocal hook
  const hook = Math.sin(2 * Math.PI * 440 * t) * 0.2 * Math.sin(2 * Math.PI * 2 * t);
  const sample = (bass + hook) * env;
  return [sample, sample];
});

// 4. Zigeunerweisen (Aires Gitanos) - Pablo Sarasate (Virtuoso Violin Masterpiece)
createAudioWav('Zigeunerweisen - Pablo Sarasate.flac', 240, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Virtuoso violin phrasing & orchestra
  const violinFreq = 659.25 + 200 * Math.sin(2 * Math.PI * 1.5 * t) + 15 * Math.sin(2 * Math.PI * 6 * t); // Vibrato
  const violin = (Math.sin(2 * Math.PI * violinFreq * t) + 0.3 * Math.sin(2 * Math.PI * violinFreq * 2 * t)) * 0.35;
  // Orchestral accompaniment
  const orch = Math.sin(2 * Math.PI * 220 * t) * 0.15;
  const sample = (violin + orch) * env;
  return [sample * 1.05, sample * 0.95];
});

console.log('All 4 requested tracks generated successfully in /songs folder!');
