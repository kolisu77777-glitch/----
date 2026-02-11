import React, { useEffect, useState } from 'react';
import SoundManager from './SoundManager';

const VisualEffects = ({ timeLeft, stressLevel, isLocked, isOverloaded }) => {
    const [shakeActive, setShakeActive] = useState(false);

    // Effect: Low Time -> Red Alert
    const isLowTime = timeLeft <= 300 && timeLeft > 0; // 5 minutes = 300 seconds

    // Effect: High Stress -> Chromatic Aberration & CRT Flicker
    const isHighStress = stressLevel > 80;

    // Effect: Locked State -> Screen Shake (Briefly)
    useEffect(() => {
        if (isLocked) {
            setShakeActive(true);
            SoundManager.playGlitch();
            const timer = setTimeout(() => setShakeActive(false), 500); // Shake for 0.5s
            return () => clearTimeout(timer);
        }
    }, [isLocked]);

    // Effect: Heartbeat Sound on Low Time or High Stress
    useEffect(() => {
        let interval;
        if (isLowTime || isHighStress) {
            interval = setInterval(() => {
                SoundManager.playHeartbeat();
            }, 1000); // Beat every second
        }
        return () => clearInterval(interval);
    }, [isLowTime, isHighStress]);

    return (
        <>
            {/* Red Alert Overlay */}
            {isLowTime && <div className="red-alert pointer-events-none fixed inset-0 z-50"></div>}

            {/* High Stress Overlay */}
            {isHighStress && (
                <>
                    <div className="chromatic-aberration pointer-events-none fixed inset-0 z-40 mix-blend-overlay"></div>
                    <div className="crt-flicker pointer-events-none fixed inset-0 z-50 opacity-20"></div>
                </>
            )}

            {/* Screen Shake Wrapper - This needs to be applied to the main container,
                but since we are a child, we can just render a fixed div that shakes the screen
                OR we can use a portal OR we can just return nothing and let the parent handle the class.

                Actually, the requirements say "Render a full-screen overlay div that applies the appropriate CSS classes".
                But `screen-shake` usually applies to the content.

                Let's use a class on the body or a root element if possible, or just a full screen shaker?
                A full screen shaker overlay won't shake the content behind it unless it IS the content container.

                Alternative: We can use a useEffect to add the class to the document.body or the root element.
            */}

            {/* Logic for Class Injection */}
            <ClassInjector
                shake={shakeActive}
                glitch={isHighStress || isOverloaded}
            />
        </>
    );
};

const ClassInjector = ({ shake, glitch }) => {
    useEffect(() => {
        const root = document.getElementById('root');
        if (shake) {
            root.classList.add('screen-shake');
        } else {
            root.classList.remove('screen-shake');
        }

        if (glitch) {
            document.body.classList.add('chromatic-aberration');
        } else {
            document.body.classList.remove('chromatic-aberration');
        }
    }, [shake, glitch]);

    return null;
};

export default VisualEffects;
