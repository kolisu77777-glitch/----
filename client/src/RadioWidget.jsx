import React, { useState, useEffect, useRef } from 'react';

const RadioWidget = ({ channels, activeChannel, onTune, unreadChannels, stressLevel = 0 }) => {
    const [knobRotation, setKnobRotation] = useState(0);
    const [volume, setVolume] = useState(0.5); // Default 50%
    const [volumeRotation, setVolumeRotation] = useState(0); // Visual rotation for volume knob
    const audioRef = useRef(null);

    // Initialize Audio
    useEffect(() => {
        audioRef.current = new Audio();
        audioRef.current.loop = true;
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
    }, []);

    // Handle Channel Change & Music Playback
    useEffect(() => {
        if (!audioRef.current) return;

        const playMusic = async () => {
            try {
                // Stop current
                audioRef.current.pause();

                // Set new source
                audioRef.current.src = `/bgm/ch${activeChannel}.mp3`;
                audioRef.current.volume = volume;

                // Play if volume is > 0
                if (volume > 0) {
                    await audioRef.current.play();
                }
            } catch (e) {
                console.warn("Audio play failed (file might be missing):", e);
            }
        };

        playMusic();
    }, [activeChannel]);

    // Handle Volume Change
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
            if (volume > 0 && audioRef.current.paused && audioRef.current.src) {
                audioRef.current.play().catch(e => console.warn("Play failed:", e));
            } else if (volume === 0) {
                audioRef.current.pause();
            }
        }

        // Map volume 0-1 to rotation -135 to 135
        setVolumeRotation((volume * 270) - 135);
    }, [volume]);

    // Map channel 1, 2, 3 to rotation angles (e.g., -45, 0, 45)
    useEffect(() => {
        const targetRotation = (activeChannel - 2) * 45;
        setKnobRotation(targetRotation);
    }, [activeChannel]);

    const handleKnobClick = () => {
        const nextChannel = activeChannel === 3 ? 1 : activeChannel + 1;
        onTune(nextChannel);
    };

    const handleVolumeClick = () => {
        // Cycle volume: 0 -> 0.3 -> 0.6 -> 1.0 -> 0
        setVolume(prev => {
            if (prev === 0) return 0.3;
            if (prev === 0.3) return 0.6;
            if (prev === 0.6) return 1.0;
            return 0;
        });
    };

    const currentMessage = channels[activeChannel];

    return (
        <div className="bg-[#0b1015] border border-gray-700 rounded p-4 shadow-[0_0_20px_rgba(0,0,0,0.5)] relative overflow-hidden group hover:border-gray-500 transition-all">
            {/* Header */}
            <div className="flex justify-between items-start mb-3 border-b border-gray-800 pb-2">
                <div className="flex flex-col">
                    <div className="text-xs font-bold text-gray-400 tracking-widest flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${unreadChannels.length > 0 ? 'bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'bg-gray-700'}`}></span>
                        电台
                    </div>
                    <div className="text-[10px] text-gray-600 font-mono mt-1 ml-4">FREQ: {90 + activeChannel * 2.5} MHz</div>
                </div>
                {/* Volume Indicator */}
                <div className="text-[10px] font-mono text-gray-600 flex flex-col items-end">
                    <span>VOL</span>
                    <div className="flex gap-0.5 mt-1">
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className={`w-1 h-2 rounded-sm ${volume >= i * 0.25 ? 'bg-green-500' : 'bg-gray-800'}`}></div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Main Display */}
            <div
                className={`bg-black border border-gray-800 rounded p-3 h-28 mb-4 relative overflow-hidden font-mono text-xs transition-all duration-200 ${stressLevel > 70 ? 'animate-pulse' : ''}`}
                style={{
                    filter: stressLevel > 30 ? `blur(${(stressLevel - 30) / 50}px) sepia(${(stressLevel - 30) / 100})` : 'none',
                    opacity: Math.max(0.6, 1 - (stressLevel > 50 ? (stressLevel - 50) / 200 : 0)),
                    transform: stressLevel > 80 ? `perspective(500px) rotateX(${(stressLevel-80)/5}deg)` : 'none'
                }}
            >
                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none background-size-[100%_2px,3px_100%]"></div>

                {currentMessage ? (
                    <div className="relative z-0 h-full overflow-y-auto custom-scrollbar">
                        <div className="flex justify-between items-start mb-2 text-[10px] text-gray-500 border-b border-gray-900 pb-1">
                            <span>[{currentMessage.type}]</span>
                            <span>{new Date(currentMessage.timestamp).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-green-400 leading-relaxed whitespace-pre-wrap animate-typewriter">
                            {currentMessage.content}
                        </p>
                        {currentMessage.expiresAt && (
                            <div className="mt-2 text-[10px] text-red-900/50 text-right">
                                信号将在 {Math.max(0, Math.ceil((currentMessage.expiresAt - Date.now()) / 1000))}s 后丢失
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-700 space-y-2">
                        <div className="w-full h-px bg-gray-800 animate-pulse"></div>
                        <span className="animate-pulse">NO SIGNAL</span>
                        <div className="w-full h-px bg-gray-800 animate-pulse"></div>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between px-2">
                {/* Channel Indicators */}
                <div className="flex gap-2">
                    {[1, 2, 3].map(ch => (
                        <div key={ch} className="flex flex-col items-center gap-1">
                            <div className={`w-1.5 h-1.5 rounded-full ${unreadChannels.includes(ch) ? 'bg-red-500 animate-ping' : activeChannel === ch ? 'bg-green-500' : 'bg-gray-800'}`}></div>
                            <span className={`text-[10px] ${activeChannel === ch ? 'text-green-500 font-bold' : 'text-gray-600'}`}>CH{ch}</span>
                        </div>
                    ))}
                </div>

                <div className="flex gap-4 items-center">
                    {/* Volume Knob (Small) */}
                    <div className="flex flex-col items-center gap-1">
                        <div
                            className="relative w-8 h-8 cursor-pointer active:scale-95 transition-transform"
                            onClick={handleVolumeClick}
                            title="Volume Control"
                        >
                            <div className="absolute inset-0 rounded-full border border-gray-600 bg-[#151515] shadow-inner"></div>
                            <div
                                className="absolute top-1 left-1/2 w-0.5 h-2 bg-gray-400 -translate-x-1/2 origin-[50%_12px] transition-transform duration-300 ease-out"
                                style={{ transform: `translateX(-50%) rotate(${volumeRotation}deg)` }}
                            ></div>
                        </div>
                        <span className="text-[8px] text-gray-600">VOL</span>
                    </div>

                    {/* Tuning Knob (Large) */}
                    <div className="flex flex-col items-center gap-1">
                        <div
                            className="relative w-12 h-12 cursor-pointer active:scale-95 transition-transform"
                            onClick={handleKnobClick}
                            title="Tuning Knob"
                        >
                            <div className="absolute inset-0 rounded-full border-2 border-gray-700 bg-[#151515] shadow-inner"></div>
                            {/* Marker */}
                            <div
                                className="absolute top-1 left-1/2 w-1 h-3 bg-gray-400 -translate-x-1/2 origin-[50%_20px] transition-transform duration-300 ease-out"
                                style={{ transform: `translateX(-50%) rotate(${knobRotation}deg)` }}
                            ></div>
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-2 h-2 bg-gray-800 rounded-full border border-gray-600"></div>
                            </div>
                        </div>
                        <span className="text-[8px] text-gray-600">TUNE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RadioWidget;
