const { useState } = React;

const LoginScreen = ({ onLogin, apiKey, setApiKey, baseUrl, setBaseUrl, model, setModel }) => {
    const [animating, setAnimating] = useState(false);
    const [modal, setModal] = useState(null);

    const handleConnect = () => {
        if (!apiKey) {
            setModal({ title: "访问拒绝", content: "请输入安全许可代码 (API Key) 以继续。", type: 'danger' });
            return;
        }
        window.SoundManager.init();
        window.SoundManager.playConnectSuccess();
        setAnimating(true);
        setTimeout(() => { onLogin(); }, 2000);
    };
    const saveConfig = (key, url, mod) => {
        setApiKey(key);
        setBaseUrl(url);
        setModel(mod);
        localStorage.setItem('detective_api_key', key);
        localStorage.setItem('detective_base_url', url);
        localStorage.setItem('detective_model', mod);
    };
    if (animating) {
        return (
            <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center p-4">
                <div className="text-center space-y-4">
                    <div className="text-4xl font-bold animate-pulse">ACCESS GRANTED</div>
                    <div className="text-sm">ESTABLISHING SECURE CONNECTION...</div>
                    <div className="w-64 h-2 bg-gray-800 mx-auto rounded overflow-hidden">
                        <div className="h-full bg-green-500 animate-[width_2s_ease-in-out_forwards]" style={{width: '100%'}}></div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-black text-green-500 font-mono flex items-center justify-center p-4">
            {modal && <window.Modal title={modal.title} type={modal.type} onClose={() => setModal(null)}>{modal.content}</window.Modal>}
            <div className="w-full max-w-md border border-green-800 p-8 rounded shadow-[0_0_20px_rgba(0,255,0,0.1)] bg-gray-900/50 backdrop-blur">
                <h1 className="text-2xl font-bold mb-6 text-center tracking-widest border-b border-green-800 pb-4">
                    DETECTIVE ARCHIVE<br/>
                    <span className="text-xs font-normal opacity-70">SECURE TERMINAL V1.0</span>
                </h1>
                <div className="space-y-6">
                    <div>
                        <label className="block text-xs mb-2 opacity-70">&gt; SECURITY CLEARANCE CODE (API KEY)</label>
                        <input type="password" value={apiKey} onChange={(e) => saveConfig(e.target.value, baseUrl, model)} className="w-full bg-black border border-green-700 p-3 text-green-500 focus:outline-none focus:border-green-400 font-mono" placeholder="sk-..." />
                    </div>
                    <div>
                        <label className="block text-xs mb-2 opacity-70">&gt; ANALYSIS MODULE (MODEL)</label>
                        <div className="flex gap-2 mb-2">
                            {[{name: 'DeepSeek', url: 'https://api.deepseek.com', model: 'deepseek-chat'}, {name: 'Moonshot', url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k'}, {name: 'OpenAI', url: 'https://api.openai.com/v1', model: 'gpt-4o'}].map(p => (
                                <button key={p.name} onClick={() => saveConfig(apiKey, p.url, p.model)} className={`flex-1 text-xs py-1 border ${model === p.model ? 'bg-green-900/50 border-green-400 text-white' : 'border-green-900 text-green-700 hover:border-green-600'}`}>{p.name}</button>
                            ))}
                        </div>
                        <input type="text" value={model} onChange={(e) => saveConfig(apiKey, baseUrl, e.target.value)} className="w-full bg-black border border-green-700 p-3 text-green-500 focus:outline-none focus:border-green-400 font-mono text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs mb-2 opacity-70">&gt; NETWORK NODE (BASE URL)</label>
                        <input type="text" value={baseUrl} onChange={(e) => saveConfig(apiKey, e.target.value, model)} className="w-full bg-black border border-green-700 p-3 text-green-500 focus:outline-none focus:border-green-400 font-mono text-sm" />
                    </div>
                    <button onClick={handleConnect} className="w-full bg-green-900/30 hover:bg-green-800/50 text-green-400 border border-green-600 py-4 font-bold tracking-widest hover:shadow-[0_0_15px_rgba(0,255,0,0.2)] transition-all mt-4">INITIATE CONNECTION</button>
                </div>
            </div>
        </div>
    );
};

window.LoginScreen = LoginScreen;