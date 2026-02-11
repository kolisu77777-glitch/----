import React, { useState, useEffect } from 'react';
import MatrixRain from './MatrixRain';
import { CustomSelect } from './UIComponents';

const LoginScreen = ({ onLogin, apiKey, setApiKey, baseUrl, setBaseUrl, model, setModel }) => {
    const [loading, setLoading] = useState(false);

    const handleLogin = () => {
        setLoading(true);
        // Simulate login delay
        setTimeout(() => {
            setLoading(false);
            onLogin();
        }, 1000);
    };

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center relative overflow-hidden font-mono">
            <MatrixRain />

            <div className="z-10 bg-gray-900/80 p-8 rounded border border-green-900 shadow-[0_0_50px_rgba(0,255,0,0.1)] backdrop-blur-sm max-w-md w-full">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-black tracking-tighter text-green-600 mb-2 glitch-text">DETECTIVE</h1>
                    <h1 className="text-4xl font-black tracking-tighter text-green-600 glitch-text">ARCHIVE</h1>
                    <div className="h-1 w-20 bg-green-600 mx-auto mt-4"></div>
                </div>

                <div className="space-y-4">
                    <div className="flex gap-2 mb-4">
                        <button
                            onClick={() => {
                                setBaseUrl('https://api.openai.com/v1');
                                setModel('gpt-3.5-turbo');
                                localStorage.setItem('detective_base_url', 'https://api.openai.com/v1');
                                localStorage.setItem('detective_model', 'gpt-3.5-turbo');
                            }}
                            className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${baseUrl.includes('openai') ? 'bg-green-900/40 border-green-500 text-green-400' : 'bg-black border-green-900 text-green-800 hover:border-green-700'}`}
                        >
                            OpenAI
                        </button>
                        <button
                            onClick={() => {
                                setBaseUrl('https://api.deepseek.com');
                                setModel('deepseek-chat');
                                localStorage.setItem('detective_base_url', 'https://api.deepseek.com');
                                localStorage.setItem('detective_model', 'deepseek-chat');
                            }}
                            className={`flex-1 py-2 rounded text-xs font-bold border transition-all ${baseUrl.includes('deepseek') ? 'bg-green-900/40 border-green-500 text-green-400' : 'bg-black border-green-900 text-green-800 hover:border-green-700'}`}
                        >
                            DeepSeek
                        </button>
                    </div>

                    <div>
                        <label className="block text-green-800 text-xs mb-1 tracking-widest">访问密钥</label>
                        <div className="relative">
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => {
                                    setApiKey(e.target.value);
                                    localStorage.setItem('detective_api_key', e.target.value);
                                }}
                                className={`w-full bg-black border p-3 text-green-500 focus:outline-none rounded font-mono placeholder-green-900/50 ${
                                    apiKey && (apiKey.includes('http') || apiKey.includes('localhost') || !apiKey.startsWith('sk-'))
                                    ? 'border-red-900 focus:border-red-500'
                                    : 'border-green-900 focus:border-green-500'
                                }`}
                                placeholder="sk-..."
                            />
                            {apiKey && (
                                <button
                                    onClick={() => {
                                        setApiKey('');
                                        localStorage.removeItem('detective_api_key');
                                    }}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-800 hover:text-green-500 text-xs"
                                >
                                    清除
                                </button>
                            )}
                        </div>
                        {apiKey && (apiKey.includes('http') || apiKey.includes('localhost')) && (
                            <div className="text-red-500 text-xs mt-1">
                                警告：检测到您可能输入了网址而非API Key。API Key通常以 "sk-" 开头。
                            </div>
                        )}
                    </div>

                    <div>
                        <label className="block text-green-800 text-xs mb-1 tracking-widest">API地址</label>
                        <input
                            type="text"
                            list="api-urls"
                            value={baseUrl}
                            onChange={(e) => {
                                setBaseUrl(e.target.value);
                                localStorage.setItem('detective_base_url', e.target.value);
                            }}
                            className="w-full bg-black border border-green-900 p-3 text-green-500 focus:border-green-500 focus:outline-none rounded font-mono placeholder-green-900/50"
                            placeholder="https://api.openai.com/v1"
                        />
                        <datalist id="api-urls">
                            <option value="https://api.openai.com/v1">OpenAI Default</option>
                            <option value="https://api.deepseek.com">DeepSeek API</option>
                        </datalist>
                    </div>

                    <div>
                        <label className="block text-green-800 text-xs mb-1 tracking-widest">模型名称</label>
                        <CustomSelect
                            value={model}
                            onChange={(val) => {
                                setModel(val);
                                localStorage.setItem('detective_model', val);
                            }}
                            options={
                                baseUrl.includes('openai') ? [
                                    { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
                                    { value: 'gpt-4', label: 'gpt-4' },
                                    { value: 'gpt-4-turbo', label: 'gpt-4-turbo' },
                                    { value: 'gpt-4o', label: 'gpt-4o' },
                                    { value: 'gpt-4o-mini', label: 'gpt-4o-mini' }
                                ] : baseUrl.includes('deepseek') ? [
                                    { value: 'deepseek-chat', label: 'deepseek-chat' },
                                    { value: 'deepseek-coder', label: 'deepseek-coder' }
                                ] : [
                                    { value: 'gpt-3.5-turbo', label: 'gpt-3.5-turbo' },
                                    { value: 'gpt-4', label: 'gpt-4' },
                                    { value: 'deepseek-chat', label: 'deepseek-chat' }
                                ]
                            }
                            placeholder="选择模型..."
                        />
                    </div>

                    <button
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full bg-green-900/20 hover:bg-green-900/40 text-green-500 border border-green-800 hover:border-green-500 py-3 rounded font-bold tracking-widest transition-all mt-4 hover:shadow-[0_0_20px_rgba(0,255,0,0.2)]"
                    >
                        {loading ? '正在初始化...' : '进入系统'}
                    </button>
                </div>

                <div className="mt-6 text-center text-xs text-green-900 font-mono">
                    安全连接已建立
                </div>
            </div>
        </div>
    );
};

export default LoginScreen;
