import React, { useState, useEffect } from 'react';
import LoginScreen from './LoginScreen';
import MainGame from './MainGame';
import SoundManager from './SoundManager';

const App = () => {
    const [isLogin, setIsLogin] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('detective_api_key') || '');
    const [baseUrl, setBaseUrl] = useState(localStorage.getItem('detective_base_url') || 'https://api.openai.com/v1');
    const [model, setModel] = useState(localStorage.getItem('detective_model') || 'gpt-3.5-turbo');

    // Global click listener to resume audio context
    useEffect(() => {
        const resumeAudio = () => {
            SoundManager.ensureContext();
        };
        window.addEventListener('click', resumeAudio);
        window.addEventListener('keydown', resumeAudio);

        // Hide loading screen
        const loader = document.getElementById('loading-screen');
        if (loader) loader.style.display = 'none';

        return () => {
            window.removeEventListener('click', resumeAudio);
            window.removeEventListener('keydown', resumeAudio);
        };
    }, []);

    return (
        <React.Fragment>
            {!isLogin ? (
                <LoginScreen onLogin={() => setIsLogin(true)} apiKey={apiKey} setApiKey={setApiKey} baseUrl={baseUrl} setBaseUrl={setBaseUrl} model={model} setModel={setModel} />
            ) : (
                <MainGame apiKey={apiKey} baseUrl={baseUrl} model={model} onLogout={() => setIsLogin(false)} />
            )}
        </React.Fragment>
    );
};

export default App;
