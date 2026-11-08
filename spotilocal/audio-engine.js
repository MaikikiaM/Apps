/**
 * Web Audio Engine for SpotiLocal
 * Provides 5-Band Equalizer, Equalizer Presets, AnalyserNode for Canvas Visualizer, and Gain Control.
 */
class AudioEngine {
  constructor() {
    this.audioCtx = null;
    this.sourceNode = null;
    this.gainNode = null;
    this.limiter = null;
    this.analyser = null;
    this.eqNodes = [];
    this.bands = [60, 230, 910, 3600, 14000]; // 5 EQ Frequencies in Hz

    this.presets = {
      flat: [0, 0, 0, 0, 0],
      bassBoost: [7, 5, 1, 0, 0],
      pop: [-1, 2, 5, 3, -1],
      rock: [5, 3, -1, 3, 5],
      jazz: [4, 2, 0, 2, 4],
      vocal: [-2, 1, 6, 4, 1],
      acoustic: [4, 2, 1, 3, 4]
    };
  }

  init(audioElement) {
    if (this.audioCtx) return;

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();

      this.sourceNode = this.audioCtx.createMediaElementSource(audioElement);
      this.gainNode = this.audioCtx.createGain();

      // Transparent ceiling limiter to prevent harsh digital clipping at high boosts (+dB up to +30 dB)
      this.limiter = this.audioCtx.createDynamicsCompressor();
      this.limiter.threshold.setValueAtTime(-1.0, this.audioCtx.currentTime);
      this.limiter.knee.setValueAtTime(6.0, this.audioCtx.currentTime);
      this.limiter.ratio.setValueAtTime(20.0, this.audioCtx.currentTime);
      this.limiter.attack.setValueAtTime(0.002, this.audioCtx.currentTime);
      this.limiter.release.setValueAtTime(0.12, this.audioCtx.currentTime);

      // Create Analyser
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.8;

      // Create 5-band EQ filters
      this.eqNodes = this.bands.map((freq, idx) => {
        const filter = this.audioCtx.createBiquadFilter();
        if (idx === 0) {
          filter.type = "lowshelf";
        } else if (idx === this.bands.length - 1) {
          filter.type = "highshelf";
        } else {
          filter.type = "peaking";
          filter.Q.value = 1.0;
        }
        filter.frequency.value = freq;
        filter.gain.value = 0;
        return filter;
      });

      // Chain: Source -> EQ0 -> EQ1 -> EQ2 -> EQ3 -> EQ4 -> Gain -> Limiter -> Analyser -> Destination
      let currentNode = this.sourceNode;
      for (const eqNode of this.eqNodes) {
        currentNode.connect(eqNode);
        currentNode = eqNode;
      }

      currentNode.connect(this.gainNode);
      this.gainNode.connect(this.limiter);
      this.limiter.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn("Web Audio API init error:", e);
    }
  }

  resume() {
    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }
  }

  setGain(val) { // 0.0 to 32.0 (-inf to +30 dB)
    if (this.gainNode) {
      const clamped = Math.max(0, Math.min(32, Number.isFinite(val) ? val : 1.0));
      if (this.audioCtx && this.audioCtx.currentTime > 0 && this.gainNode.gain.setTargetAtTime) {
        this.gainNode.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.015);
      } else {
        this.gainNode.gain.setValueAtTime(clamped, this.audioCtx ? this.audioCtx.currentTime : 0);
      }
    }
  }

  setEqBand(bandIdx, gainValue) {
    if (this.eqNodes[bandIdx]) {
      this.eqNodes[bandIdx].gain.setValueAtTime(gainValue, this.audioCtx ? this.audioCtx.currentTime : 0);
    }
  }

  applyPreset(presetName) {
    const values = this.presets[presetName] || this.presets.flat;
    values.forEach((gain, idx) => {
      this.setEqBand(idx, gain);
    });
    return values;
  }

  getFrequencyData(dataArray) {
    if (this.analyser) {
      this.analyser.getByteFrequencyData(dataArray);
    }
  }
}

window.audioEngine = new AudioEngine();
