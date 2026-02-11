import React, { useEffect, useState } from 'react';

export const LockBodyScroll = () => {
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => document.body.style.overflow = 'auto';
    }, []);
    return null;
};

export const Modal = ({ title, children, actions, onClose, type = 'info' }) => (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm">
        <LockBodyScroll />
        <div className={`bg-[#1a1a1a] border-2 ${type === 'danger' ? 'border-red-600 shadow-[0_0_30px_rgba(220,38,38,0.3)]' : type === 'success' ? 'border-green-500 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-gray-600 shadow-[0_0_30px_rgba(0,0,0,0.8)]'} p-8 rounded-lg max-w-md w-full relative transform transition-all paper-texture`}>
            <h3 className={`text-2xl font-black mb-6 border-b pb-4 tracking-widest uppercase ${type === 'danger' ? 'text-red-500 border-red-900' : type === 'success' ? 'text-green-500 border-green-900' : 'text-white border-gray-700'}`}>{title}</h3>
            <div className="text-gray-300 mb-8 whitespace-pre-wrap font-mono text-sm leading-relaxed">{children}</div>
            <div className="flex justify-end gap-3">
                {actions ? actions : <button onClick={onClose} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded font-bold text-sm border border-gray-600 transition-colors">关闭</button>}
            </div>
        </div>
    </div>
);

export const GradeReveal = ({ grade, onComplete }) => {
    const [visible, setVisible] = useState(false);
    const [displayGrade, setDisplayGrade] = useState('');
    const [decoding, setDecoding] = useState(true);

    useEffect(() => {
        requestAnimationFrame(() => setVisible(true));

        // Decoding effect
        let iterations = 0;
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        const interval = setInterval(() => {
            setDisplayGrade(chars[Math.floor(Math.random() * chars.length)]);
            iterations++;
            if (iterations > 20) {
                clearInterval(interval);
                setDisplayGrade(grade);
                setDecoding(false);
                setTimeout(onComplete, 3000);
            }
        }, 50);

        return () => clearInterval(interval);
    }, [grade]);

    let colorClass = "text-gray-500";
    if (!decoding) {
        if (grade === 'S') colorClass = "text-red-600 drop-shadow-[0_0_50px_rgba(220,38,38,1)]";
        else if (grade === 'A') colorClass = "text-yellow-500 drop-shadow-[0_0_50px_rgba(234,179,8,1)]";
        else if (grade === 'B') colorClass = "text-purple-500 drop-shadow-[0_0_50px_rgba(168,85,247,1)]";
        else if (grade === 'C') colorClass = "text-blue-500 drop-shadow-[0_0_50px_rgba(59,130,246,1)]";
        else if (grade === 'F') colorClass = "text-gray-400 drop-shadow-[0_0_50px_rgba(156,163,175,1)]";
    } else {
        colorClass = "text-green-500 animate-pulse";
    }

    return (
        <div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center overflow-hidden">
            <LockBodyScroll />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-gray-800/30 via-black to-black"></div>

            {/* Scanlines */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-10 pointer-events-none background-size-[100%_2px,3px_100%]"></div>

            <div className={`font-black transition-all duration-300 transform ${visible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'} ${colorClass} relative z-20`} style={{fontSize: '20vw', fontFamily: 'Impact, sans-serif', lineHeight: 1}}>
                {displayGrade}
            </div>
            <div className={`mt-8 text-green-500 font-mono tracking-[1em] text-xl md:text-3xl uppercase transition-opacity duration-1000 delay-500 ${visible ? 'opacity-100' : 'opacity-0'} relative z-20`}>
                CASE EVALUATION
            </div>
        </div>
    );
};

export const FlashbackReveal = ({ truth, onComplete }) => {
    const [visibleLines, setVisibleLines] = useState([]);
    const [currentLine, setCurrentLine] = useState('');
    const [lineIndex, setLineIndex] = useState(0);
    const [charIndex, setCharIndex] = useState(0);
    const [narrative, setNarrative] = useState([]);

    useEffect(() => {
        // Construct the narrative
        // Pre-process method string to ensure better line breaks for lists
        const formattedMethod = truth.method
            .replace(/(\d+[\.\)])/g, '\n$1') // Add newline before "1)" or "1."
            .replace(/([：:])\s*/g, '$1\n')  // Add newline after colons
            .replace(/([。])\s*/g, '$1\n');  // Add newline after periods

        const methodLines = formattedMethod
            .split('\n')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        const lines = [
            "【记忆重构中...】",
            "",
            `真凶锁定：${truth.killer}`,
            "",
            ...methodLines,
            "",
            `动机分析：${truth.motive}`,
            "",
            "【案件归档】"
        ];
        setNarrative(lines);
    }, [truth]);

    useEffect(() => {
        if (narrative.length === 0) return;

        if (lineIndex >= narrative.length) {
            const timer = setTimeout(onComplete, 3000);
            return () => clearTimeout(timer);
        }

        const targetLine = narrative[lineIndex];

        if (charIndex < targetLine.length) {
            const timer = setTimeout(() => {
                setCurrentLine(prev => prev + targetLine[charIndex]);
                setCharIndex(prev => prev + 1);
            }, 30); // Typing speed
            return () => clearTimeout(timer);
        } else {
            const timer = setTimeout(() => {
                setVisibleLines(prev => [...prev, targetLine]);
                setCurrentLine('');
                setCharIndex(0);
                setLineIndex(prev => prev + 1);
            }, 500); // Pause between lines
            return () => clearTimeout(timer);
        }
    }, [charIndex, lineIndex, narrative]);

    return (
        <div className="fixed inset-0 bg-[#1a1510] z-[9999] flex flex-col items-center justify-center p-8 font-serif text-[#a89f91] overflow-hidden">
            <LockBodyScroll />
            <div className="absolute inset-0 pointer-events-none opacity-20 bg-[url('https://www.transparenttextures.com/patterns/aged-paper.png')]"></div>
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/50 pointer-events-none"></div>

            <div className="max-w-3xl w-full space-y-4 relative z-10">
                {visibleLines.map((line, i) => (
                    <div key={i} className={`text-xl md:text-2xl leading-relaxed ${line.includes('真凶') ? 'text-red-800 font-bold' : line.includes('记忆') ? 'text-sm tracking-widest opacity-50 font-sans' : ''}`}>
                        {line}
                    </div>
                ))}
                <div className={`text-xl md:text-2xl leading-relaxed border-r-2 border-[#a89f91] animate-pulse inline-block ${narrative[lineIndex]?.includes('真凶') ? 'text-red-800 font-bold' : ''}`}>
                    {currentLine}
                </div>
            </div>
        </div>
    );
};

export const CustomSelect = ({ value, onChange, options, placeholder, className, color = 'green' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = React.useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);
    const borderColor = color === 'red' ? 'border-red-900' : 'border-green-900';
    const textColor = color === 'red' ? 'text-red-500' : 'text-green-500';
    const hoverBg = color === 'red' ? 'hover:bg-red-900/20' : 'hover:bg-green-900/20';
    const activeBg = color === 'red' ? 'bg-red-900/30' : 'bg-green-900/30';

    return (
        <div className={`relative ${className}`} ref={containerRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full bg-black border ${borderColor} p-3 ${textColor} rounded cursor-pointer flex justify-between items-center transition-colors ${hoverBg}`}
            >
                <span className={!selectedOption ? 'text-gray-500' : ''}>
                    {selectedOption ? selectedOption.label : placeholder || 'Select...'}
                </span>
                <svg className={`fill-current h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                    <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
                </svg>
            </div>
            {isOpen && (
                <div className={`absolute z-50 w-full mt-1 bg-black border ${borderColor} rounded shadow-xl max-h-60 overflow-y-auto`}>
                    {options.map((opt) => (
                        <div
                            key={opt.value}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                            className={`p-3 cursor-pointer transition-colors ${opt.value === value ? activeBg : 'hover:bg-gray-900'} ${textColor}`}
                        >
                            {opt.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export const HackingMinigame = ({ onSuccess, onFailure, targetName }) => {
    const [mode, setMode] = useState('pin'); // 'pin', 'pattern', 'morse'
    const [gameState, setGameState] = useState('init'); // init, memorize, input, success, fail
    const [target, setTarget] = useState([]);
    const [input, setInput] = useState([]);
    const [timeLeft, setTimeLeft] = useState(15000); // 15 seconds total
    const [message, setMessage] = useState('INITIALIZING...');
    const [morseTarget, setMorseTarget] = useState(''); // For morse mode
    const [morseInput, setMorseInput] = useState('');

    const MORSE_CODE = {
        'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
        'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
        'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
        'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
        'Y': '-.--', 'Z': '--..', '0': '-----', '1': '.----', '2': '..---',
        '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...',
        '8': '---..', '9': '----.'
    };

    useEffect(() => {
        // Determine mode based on targetName
        let newMode = 'pin';
        if (targetName) {
            if (targetName.includes('手机') || targetName.includes('平板') || targetName.includes('主机')) {
                newMode = 'pattern'; // Fingerprint/Pattern for phones
            } else if (targetName.includes('保险柜') || targetName.includes('U盘') || targetName.includes('密码')) {
                newMode = 'morse'; // Morse code for safes/USBs
            } else {
                newMode = Math.random() > 0.5 ? 'pin' : 'pattern';
            }
        }
        setMode(newMode);

        if (newMode === 'pin') {
            const newTarget = Array.from({length: 6}, () => Math.floor(Math.random() * 10));
            setTarget(newTarget);
            setMessage('MEMORIZE THE PIN CODE');
            setGameState('memorize');
        } else if (newMode === 'pattern') {
            // Generate a pattern of 5-7 points
            const length = Math.floor(Math.random() * 3) + 5;
            const newTarget = [];
            let current = Math.floor(Math.random() * 9);
            newTarget.push(current);

            while (newTarget.length < length) {
                let next;
                do {
                    next = Math.floor(Math.random() * 9);
                } while (newTarget.includes(next));
                newTarget.push(next);
            }
            setTarget(newTarget);
            setMessage('MEMORIZE THE PATTERN SEQUENCE');
            setGameState('memorize');
        } else if (newMode === 'morse') {
            // Generate a 4-digit code
            const code = Math.floor(1000 + Math.random() * 9000).toString();
            setMorseTarget(code);
            setMessage('DECODE THE SIGNAL');
            setGameState('input'); // Morse starts directly in input mode
            setTimeLeft(30000); // More time for morse
        }

        if (newMode !== 'morse') {
            // Switch to input mode after 3 seconds for memory games
            const memorizeTimer = setTimeout(() => {
                setGameState('input');
                setMessage('ENTER SEQUENCE');
            }, 3000);
            return () => clearTimeout(memorizeTimer);
        }
    }, [targetName]);

    useEffect(() => {
        if (gameState !== 'input') return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 100) {
                    clearInterval(timer);
                    handleFail();
                    return 0;
                }
                return prev - 100;
            });
        }, 100);

        return () => clearInterval(timer);
    }, [gameState]);

    const handleFail = () => {
        setGameState('fail');
        setMessage('ACCESS DENIED');
        setTimeout(onFailure, 1500);
    };

    const handleSuccess = () => {
        setGameState('success');
        setMessage('ACCESS GRANTED');
        setTimeout(onSuccess, 1000);
    };

    const handlePinInput = (num) => {
        if (gameState !== 'input') return;

        if (mode === 'morse') {
            const newInput = morseInput + num;
            setMorseInput(newInput);
            if (newInput.length === morseTarget.length) {
                if (newInput === morseTarget) handleSuccess();
                else handleFail();
            }
            return;
        }

        const newInput = [...input, num];
        setInput(newInput);

        // Check validity immediately
        if (newInput[newInput.length - 1] !== target[newInput.length - 1]) {
            handleFail();
            return;
        }

        if (newInput.length === target.length) {
            handleSuccess();
        }
    };

    const handlePatternInput = (index) => {
        if (gameState !== 'input') return;

        const newInput = [...input, index];
        setInput(newInput);

        if (newInput[newInput.length - 1] !== target[newInput.length - 1]) {
            handleFail();
            return;
        }

        if (newInput.length === target.length) {
            handleSuccess();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[200] flex items-center justify-center backdrop-blur-sm p-4">
            <LockBodyScroll />
            <div className={`bg-black border-2 ${gameState === 'fail' ? 'border-red-600' : gameState === 'success' ? 'border-green-500' : 'border-green-800'} p-8 rounded-lg shadow-[0_0_50px_rgba(0,255,0,0.2)] w-full max-w-4xl relative overflow-hidden flex flex-col md:flex-row gap-8`}>
                {/* Scanlines */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(0,255,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] pointer-events-none background-size-[100%_2px,3px_100%] z-0"></div>

                {/* Main Game Area */}
                <div className="flex-1 relative z-10 text-center">
                    {targetName && <div className="text-xs text-green-800 font-mono mb-2 tracking-widest uppercase border-b border-green-900/50 pb-2 inline-block px-4">TARGET: {targetName}</div>}
                    <h3 className={`font-mono tracking-widest mb-4 text-sm ${gameState === 'fail' ? 'text-red-500' : 'text-green-500'}`}>
                        {message}
                    </h3>

                    {/* Timer Bar */}
                    <div className="w-full h-1 bg-gray-900 mb-6">
                        <div
                            className={`h-full transition-all duration-100 ${timeLeft < 5000 ? 'bg-red-500' : 'bg-green-500'}`}
                            style={{ width: `${(timeLeft / (mode === 'morse' ? 30000 : 15000)) * 100}%` }}
                        />
                    </div>

                    {mode === 'morse' && (
                        <div className="mb-8">
                            <div className="text-4xl font-mono text-green-400 tracking-[0.5em] mb-4 animate-pulse">
                                {morseTarget.split('').map(char => MORSE_CODE[char]).join(' / ')}
                            </div>
                            <div className="text-2xl font-mono text-green-600 h-8 border-b border-green-900 w-32 mx-auto">
                                {morseInput}
                            </div>
                        </div>
                    )}

                    {mode === 'pin' || mode === 'morse' ? (
                        <div className="space-y-6">
                            {/* PIN Display (Only for PIN mode) */}
                            {mode === 'pin' && (
                                <div className="flex justify-center gap-2 mb-6 h-12">
                                    {target.map((num, i) => (
                                        <div key={i} className={`w-10 h-12 border-b-2 flex items-center justify-center text-2xl font-mono ${
                                            gameState === 'memorize' || gameState === 'success' || (gameState === 'input' && i < input.length)
                                                ? 'text-green-400 border-green-500'
                                                : 'text-transparent border-gray-800'
                                        }`}>
                                            {gameState === 'memorize' ? num :
                                             gameState === 'success' ? num :
                                             i < input.length ? input[i] : '*'}
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Keypad */}
                            <div className="grid grid-cols-3 gap-3 max-w-[200px] mx-auto">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                                    <button
                                        key={num}
                                        onClick={() => handlePinInput(num)}
                                        disabled={gameState !== 'input'}
                                        className={`h-12 border border-green-900 rounded text-green-500 font-mono text-xl hover:bg-green-900/30 hover:border-green-500 active:bg-green-500 active:text-black transition-all ${num === 0 ? 'col-start-2' : ''}`}
                                    >
                                        {num}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center">
                            {/* Pattern Grid */}
                            <div className="grid grid-cols-3 gap-6 p-4 bg-gray-900/50 rounded-xl border border-green-900/30">
                                {Array.from({length: 9}).map((_, i) => {
                                    const isTarget = gameState === 'memorize' && target.includes(i);
                                    const isInput = input.includes(i);
                                    const orderIndex = gameState === 'memorize' ? target.indexOf(i) : input.indexOf(i);

                                    return (
                                        <button
                                            key={i}
                                            onClick={() => handlePatternInput(i)}
                                            disabled={gameState !== 'input' || input.includes(i)}
                                            className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-300 relative ${
                                                (isTarget || isInput)
                                                    ? 'border-green-400 bg-green-900/50 shadow-[0_0_15px_rgba(74,222,128,0.5)]'
                                                    : 'border-gray-700 bg-black hover:border-green-700'
                                            }`}
                                        >
                                            {(isTarget || isInput) && (
                                                <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
                                            )}
                                            {(isTarget || isInput) && (
                                                <span className="absolute -top-2 -right-2 text-xs font-mono text-green-300 bg-black px-1 border border-green-900">
                                                    {orderIndex + 1}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            <div className="mt-4 text-xs text-gray-500 font-mono">
                                {gameState === 'memorize' ? 'MEMORIZE SEQUENCE' : 'REPEAT SEQUENCE'}
                            </div>
                        </div>
                    )}
                </div>

                {/* Morse Code Table (Only visible in Morse mode) */}
                {mode === 'morse' && (
                    <div className="w-full md:w-64 border-l border-green-900/30 pl-8 relative z-10 hidden md:block">
                        <h4 className="text-green-500 font-mono text-xs mb-4 tracking-widest border-b border-green-900/50 pb-2">DECRYPTION KEY</h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs font-mono text-gray-500 h-[300px] overflow-y-auto custom-scrollbar">
                            {Object.entries(MORSE_CODE).map(([char, code]) => (
                                <div key={char} className="flex justify-between hover:text-green-400 transition-colors">
                                    <span className="font-bold">{char}</span>
                                    <span className="text-green-700">{code}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

