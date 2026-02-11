const SoundManager = {
    ctx: null,
    init: () => {
        if (!SoundManager.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            SoundManager.ctx = new AudioContext();
        }
    },
    ensureContext: () => {
        if (!SoundManager.ctx) SoundManager.init();
        if (SoundManager.ctx && SoundManager.ctx.state === 'suspended') {
            SoundManager.ctx.resume().catch(e => console.error("Audio resume failed", e));
        }
    },
    playTone: (freq, type, duration) => {
        SoundManager.ensureContext();
        if (!SoundManager.ctx) return;

        try {
            const osc = SoundManager.ctx.createOscillator();
            const gain = SoundManager.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, SoundManager.ctx.currentTime);
            gain.gain.setValueAtTime(0.1, SoundManager.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, SoundManager.ctx.currentTime + duration);
            osc.connect(gain);
            gain.connect(SoundManager.ctx.destination);
            osc.start();
            osc.stop(SoundManager.ctx.currentTime + duration);
        } catch (e) {
            console.warn("Audio play failed", e);
        }
    },
    playNoise: (duration) => {
        SoundManager.ensureContext();
        if (!SoundManager.ctx) return;

        try {
            const bufferSize = SoundManager.ctx.sampleRate * duration;
            const buffer = SoundManager.ctx.createBuffer(1, bufferSize, SoundManager.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = SoundManager.ctx.createBufferSource();
            noise.buffer = buffer;
            const gain = SoundManager.ctx.createGain();
            gain.gain.setValueAtTime(0.05, SoundManager.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, SoundManager.ctx.currentTime + duration);
            noise.connect(gain);
            gain.connect(SoundManager.ctx.destination);
            noise.start();
        } catch (e) {
            console.warn("Noise play failed", e);
        }
    },
    playPageFlip: () => {
        SoundManager.ensureContext();
        if (!SoundManager.ctx) return;

        try {
            const duration = 0.3;
            const bufferSize = SoundManager.ctx.sampleRate * duration;
            const buffer = SoundManager.ctx.createBuffer(1, bufferSize, SoundManager.ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            const noise = SoundManager.ctx.createBufferSource();
            noise.buffer = buffer;
            const filter = SoundManager.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1000, SoundManager.ctx.currentTime);
            filter.frequency.linearRampToValueAtTime(100, SoundManager.ctx.currentTime + duration);
            const gain = SoundManager.ctx.createGain();
            gain.gain.setValueAtTime(0.1, SoundManager.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0, SoundManager.ctx.currentTime + duration);
            noise.connect(filter);
            filter.connect(gain);
            gain.connect(SoundManager.ctx.destination);
            noise.start();
        } catch (e) {
            console.warn("Page flip failed", e);
        }
    },
    playTyping: () => {
        SoundManager.playTone(2000, 'square', 0.01);
        SoundManager.playNoise(0.05);
    },
    playConnectSuccess: () => {
        SoundManager.playTone(440, 'sine', 0.1);
        setTimeout(() => SoundManager.playTone(880, 'sine', 0.2), 100);
    },
    playAlert: () => {
        SoundManager.playTone(800, 'sawtooth', 0.1);
        setTimeout(() => SoundManager.playTone(600, 'sawtooth', 0.1), 100);
    },
    playHeartbeat: () => {
        SoundManager.ensureContext();
        if (!SoundManager.ctx) return;

        try {
            const t = SoundManager.ctx.currentTime;
            const osc = SoundManager.ctx.createOscillator();
            const gain = SoundManager.ctx.createGain();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.1);

            gain.gain.setValueAtTime(0.5, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);

            osc.connect(gain);
            gain.connect(SoundManager.ctx.destination);

            osc.start(t);
            osc.stop(t + 0.2);
        } catch (e) {
            console.warn("Heartbeat play failed", e);
        }
    },
    playGlitch: () => {
        SoundManager.ensureContext();
        if (!SoundManager.ctx) return;

        try {
            const t = SoundManager.ctx.currentTime;
            const duration = 0.2;
            const bufferSize = SoundManager.ctx.sampleRate * duration;
            const buffer = SoundManager.ctx.createBuffer(1, bufferSize, SoundManager.ctx.sampleRate);
            const data = buffer.getChannelData(0);

            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }

            const noise = SoundManager.ctx.createBufferSource();
            noise.buffer = buffer;

            // Random frequency modulation simulation via playback rate/detune
            // We can also use a filter with random frequency
            const filter = SoundManager.ctx.createBiquadFilter();
            filter.type = 'highpass';
            filter.frequency.setValueAtTime(1000, t);

            // Jitter the filter frequency
            for (let i = 0; i < duration; i += 0.05) {
                filter.frequency.setValueAtTime(Math.random() * 5000 + 500, t + i);
            }

            const gain = SoundManager.ctx.createGain();
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

            noise.connect(filter);
            filter.connect(gain);
            gain.connect(SoundManager.ctx.destination);

            noise.start(t);
        } catch (e) {
            console.warn("Glitch play failed", e);
        }
    }
};

export default SoundManager;
