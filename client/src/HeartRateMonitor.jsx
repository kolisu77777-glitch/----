import React, { useEffect, useRef } from 'react';

const HeartRateMonitor = ({ stress }) => {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    // Use refs for animation state to persist across renders without resetting
    const stateRef = useRef({
        x: 0,
        lastY: 0,
        lastBeatTime: 0,
        beatPhase: 0,
        currentStress: stress, // Smoothly interpolated stress
        targetStress: stress
    });

    // Update target stress when prop changes
    useEffect(() => {
        stateRef.current.targetStress = stress;
    }, [stress]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const ctx = canvas.getContext('2d');
        let width = canvas.width = container.offsetWidth;
        let height = canvas.height = container.offsetHeight;
        let animId;

        // Initialize Y if needed
        if (stateRef.current.lastY === 0) stateRef.current.lastY = height / 2;

        const speed = 2; // Pixels per frame

        // Clear canvas initially
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);

        const drawGrid = () => {
            ctx.strokeStyle = '#0a220a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            for(let i=0; i<width; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
            for(let i=0; i<height; i+=20) { ctx.moveTo(0,i); ctx.lineTo(width,i); }
            ctx.stroke();
        };
        drawGrid();

        const draw = (timestamp) => {
            const state = stateRef.current;

            // Smoothly interpolate stress (approx 0.5s to converge)
            // Frame time approx 16ms. 0.5s = 30 frames.
            // Lerp factor ~ 0.05
            state.currentStress += (state.targetStress - state.currentStress) * 0.05;

            // Calculate Beat Parameters based on SMOOTH Stress
            const bpm = 60 + state.currentStress;
            const beatInterval = 60000 / bpm;

            // Trigger Beat
            if (timestamp - state.lastBeatTime > beatInterval) {
                state.lastBeatTime = timestamp;
                state.beatPhase = 1; // Start P wave
            }

            // Calculate Y based on phase
            let targetY = height / 2;
            const timeSinceBeat = timestamp - state.lastBeatTime;
            const amp = 15 + (state.currentStress / 3); // Amplitude scales with stress

            if (state.beatPhase > 0) {
                if (timeSinceBeat < 80) { // P wave (small up)
                    targetY -= amp * 0.2 * Math.sin((timeSinceBeat / 80) * Math.PI);
                } else if (timeSinceBeat < 120) { // Q (small down)
                    targetY += amp * 0.2;
                } else if (timeSinceBeat < 180) { // R (HUGE up)
                    // Sharp spike
                    const progress = (timeSinceBeat - 120) / 60;
                    if (progress < 0.5) targetY -= amp * 2.5 * (progress * 2);
                    else targetY -= amp * 2.5 * (1 - (progress - 0.5) * 2);

                    // Add jitter for high stress
                    if (state.currentStress > 60) targetY += (Math.random() - 0.5) * 10;
                } else if (timeSinceBeat < 220) { // S (medium down)
                    targetY += amp * 0.5;
                } else if (timeSinceBeat < 350) { // ST segment (flat)
                    targetY = height / 2;
                } else if (timeSinceBeat < 500) { // T wave (medium up)
                    targetY -= amp * 0.4 * Math.sin(((timeSinceBeat - 350) / 150) * Math.PI);
                } else {
                    state.beatPhase = 0; // End beat
                }
            }

            // Add baseline noise
            targetY += (Math.random() - 0.5) * (state.currentStress > 50 ? 3 : 1);

            // Fade Effect (Draw semi-transparent black rect over everything ahead)
            // Scan Bar Logic
            const scanBarWidth = 10;
            ctx.fillStyle = '#000';
            ctx.fillRect(state.x + speed, 0, scanBarWidth, height); // Clear ahead

            // Redraw grid in cleared area (simple approximation)
            ctx.strokeStyle = '#0a220a';
            ctx.lineWidth = 1;
            ctx.beginPath();
            const nextX = state.x + speed + scanBarWidth;
            for(let i=Math.floor((state.x+speed)/20)*20; i<nextX; i+=20) {
                 if(i > state.x+speed) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
            }
            ctx.stroke();

            // Draw Line Segment
            ctx.beginPath();
            ctx.strokeStyle = state.currentStress > 80 ? '#ef4444' : '#22c55e';
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';
            ctx.moveTo(state.x, state.lastY);
            ctx.lineTo(state.x + speed, targetY);
            ctx.stroke();

            // Glow Effect
            ctx.shadowBlur = 10;
            ctx.shadowColor = ctx.strokeStyle;
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Advance X
            state.x += speed;
            state.lastY = targetY;

            // Wrap around
            if (state.x > width) {
                state.x = 0;
                state.lastY = height / 2;
            }

            animId = requestAnimationFrame(draw);
        };

        animId = requestAnimationFrame(draw);

        const handleResize = () => {
            width = canvas.width = container.offsetWidth;
            height = canvas.height = container.offsetHeight;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, width, height);
            drawGrid();
            stateRef.current.x = 0;
        };
        window.addEventListener('resize', handleResize);
        return () => {
            cancelAnimationFrame(animId);
            window.removeEventListener('resize', handleResize);
        };
    }, []); // Empty dependency array - effect runs once, updates handled via ref

    return (
        <div ref={containerRef} className="relative w-full h-32 bg-black rounded border border-gray-800 shadow-[inset_0_0_20px_rgba(0,0,0,1)] overflow-hidden mb-4">
            <div className="absolute top-2 right-2 text-xs font-mono text-green-500 opacity-50">BPM: {Math.round(60 + stress)}</div>
            <canvas ref={canvasRef} className="w-full h-full block" />
            <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(transparent_50%,rgba(0,0,0,0.2)_50%)] bg-[length:100%_4px]"></div>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle,transparent_60%,rgba(0,0,0,0.8)_100%)]"></div>
        </div>
    );
};

export default HeartRateMonitor;
