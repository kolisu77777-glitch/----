const { useState, useEffect } = React;

const App = () => {
    const [isLogin, setIsLogin] = useState(false);
    const [apiKey, setApiKey] = useState(localStorage.getItem('detective_api_key') || '');
    const [baseUrl, setBaseUrl] = useState(localStorage.getItem('detective_base_url') || 'https://api.openai.com/v1');
    const [model, setModel] = useState(localStorage.getItem('detective_model') || 'gpt-3.5-turbo');

    // Global click listener to resume audio context
    useEffect(() => {
        const resumeAudio = () => {
            window.SoundManager.ensureContext();
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
                <window.LoginScreen onLogin={() => setIsLogin(true)} apiKey={apiKey} setApiKey={setApiKey} baseUrl={baseUrl} setBaseUrl={setBaseUrl} model={model} setModel={setModel} />
            ) : (
                <window.MainGame apiKey={apiKey} baseUrl={baseUrl} model={model} onLogout={() => setIsLogin(false)} />
            )}
        </React.Fragment>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) { return { hasError: true }; }
    componentDidCatch(error, errorInfo) { this.setState({ error, errorInfo }); }
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-black text-red-500 font-mono p-8 flex flex-col items-center justify-center">
                    <div className="border border-red-800 p-6 rounded max-w-2xl w-full bg-gray-900">
                        <h1 className="text-2xl font-bold mb-4 border-b border-red-800 pb-2">SYSTEM FAILURE</h1>
                        <p className="mb-4">An unexpected error occurred.</p>
                        <button onClick={() => window.location.reload()} className="bg-red-900/50 hover:bg-red-800 text-white px-4 py-2 rounded border border-red-700 w-full">REBOOT SYSTEM</button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}
root.render(<ErrorBoundary><App /></ErrorBoundary>);