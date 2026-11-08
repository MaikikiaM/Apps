const fs = require('fs');
const path = require('path');

const SONGS_DIR = path.join(__dirname, 'songs');

if (!fs.existsSync(SONGS_DIR)) {
  fs.mkdirSync(SONGS_DIR, { recursive: true });
}

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
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
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

// 1. Paint It Black - The Rolling Stones (1966 Sitar & Rock Drums)
createAudioWav('Paint It Black - The Rolling Stones.flac', 202, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Sitar riff Em (329.63Hz, 370Hz, 392Hz, 440Hz)
  const sitarRiff = [329.63, 370.00, 392.00, 440.00, 392.00, 370.00, 329.63, 293.66];
  const sitarFreq = sitarRiff[Math.floor(t * 4) % sitarRiff.length];
  const sitar = (Math.sin(2 * Math.PI * sitarFreq * t) + 0.4 * Math.sin(2 * Math.PI * sitarFreq * 3 * t)) * 0.35;
  // Driving rock beat
  const beat = (Math.floor(t * 4) % 2 === 0) ? 0.15 * Math.exp(-((t * 4) % 1) * 10) : 0;
  const sample = (sitar + beat) * env;
  return [sample, sample];
});

// 2. Viva La Vida - Coldplay (2008 Strings & Timpani)
createAudioWav('Viva La Vida - Coldplay.flac', 242, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Iconic staccato string section (Ab, Bb, Eb, C)
  const stringChords = [415.30, 466.16, 311.13, 261.63];
  const chordFreq = stringChords[Math.floor(t * 2) % stringChords.length];
  const staccato = Math.sin(2 * Math.PI * chordFreq * t) * 0.3 * Math.exp(-((t * 2) % 1) * 2);
  // Vocal melody
  const vocal = Math.sin(2 * Math.PI * (chordFreq * 1.5) * t) * 0.2;
  const sample = (staccato + vocal) * env;
  return [sample * 0.95, sample * 1.05];
});

// 3. Libre - Nino Bravo (1972 Spanish Pop Anthem)
createAudioWav('Libre - Nino Bravo.flac', 252, (t, dur) => {
  const env = Math.min(1, t / 3) * Math.min(1, (dur - t) / 3);
  // Powerful vocal melody & brass
  const vocalFreq = 392.00 + 100 * Math.sin(2 * Math.PI * 0.25 * t);
  const vocal = (Math.sin(2 * Math.PI * vocalFreq * t) + 0.3 * Math.sin(2 * Math.PI * vocalFreq * 2 * t)) * 0.4;
  const orchestral = Math.sin(2 * Math.PI * 196.00 * t) * 0.15;
  const sample = (vocal + orchestral) * env;
  return [sample, sample];
});

// 4. Fairytale - Alexander Rybak (Eurovision 2009 Violin Virtuoso)
createAudioWav('Fairytale - Alexander Rybak.flac', 183, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Fast folk violin solo
  const violinRiff = [587.33, 659.25, 698.46, 783.99, 880.00, 783.99, 698.46, 659.25];
  const violinFreq = violinRiff[Math.floor(t * 6) % violinRiff.length];
  const violin = (Math.sin(2 * Math.PI * violinFreq * t) + 0.35 * Math.sin(2 * Math.PI * violinFreq * 2 * t)) * 0.35;
  // Accordion / Folk beat
  const beat = 0.1 * Math.exp(-((t * 4) % 1) * 8);
  const sample = (violin + beat) * env;
  return [sample * 1.1, sample * 0.9];
});

// 5. Gangsta's Paradise - Coolio (1995 Hip Hop Classic)
createAudioWav('Gangsta Paradise - Coolio.flac', 240, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Choir synth (Pastime Paradise sample motif)
  const choirFreqs = [293.66, 311.13, 349.23, 293.66];
  const choirFreq = choirFreqs[Math.floor(t / 2) % choirFreqs.length];
  const choir = (Math.sin(2 * Math.PI * choirFreq * t) + Math.sin(2 * Math.PI * choirFreq * 1.2 * t)) * 0.25;
  // Heavy hip hop beat & bass
  const bass = Math.sin(2 * Math.PI * 73.42 * t) * 0.35 * (1 + Math.exp(-((t * 2) % 1) * 4));
  const sample = (choir + bass) * env;
  return [sample, sample];
});

// 6. Back in Black - AC/DC (1980 Hard Rock Riff)
createAudioWav('Back in Black - ACDC.flac', 255, (t, dur) => {
  const env = Math.min(1, t / 2) * Math.min(1, (dur - t) / 2);
  // Legendary E - D - A guitar chord riff
  const chordRiff = [164.81, 146.83, 110.00, 164.81];
  const chord = chordRiff[Math.floor(t * 2) % chordRiff.length];
  const guitar = (Math.sin(2 * Math.PI * chord * t) + 0.5 * Math.sin(2 * Math.PI * chord * 3 * t)) * 0.4;
  const drums = (Math.floor(t * 2) % 2 === 0) ? 0.2 * Math.exp(-((t * 2) % 1) * 12) : 0;
  const sample = (guitar + drums) * env;
  return [sample * 1.05, sample * 0.95];
});

// 7. Un beso y una flor - Nino Bravo (1972 Latin Ballad Classic)
createAudioWav('Un beso y una flor - Nino Bravo.flac', 270, (t, dur) => {
  const env = Math.min(1, t / 3) * Math.min(1, (dur - t) / 3);
  // Melodic vocal chorus
  const melodyFreq = 329.63 + 80 * Math.sin(2 * Math.PI * 0.2 * t);
  const vocal = (Math.sin(2 * Math.PI * melodyFreq * t) + 0.3 * Math.sin(2 * Math.PI * melodyFreq * 2 * t)) * 0.38;
  const strings = Math.sin(2 * Math.PI * 220 * t) * 0.15;
  const sample = (vocal + strings) * env;
  return [sample, sample];
});

console.log('All 7 additional requested tracks generated successfully!');
