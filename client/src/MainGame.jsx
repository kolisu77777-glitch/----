import React, { useState, useEffect, useRef } from 'react';
import MatrixRain from './MatrixRain';
import RadioWidget from './RadioWidget';
import { Modal, LockBodyScroll, GradeReveal, FlashbackReveal, CustomSelect, HackingMinigame } from './UIComponents';
import HeartRateMonitor from './HeartRateMonitor';
import SoundManager from './SoundManager';
import VisualEffects from './VisualEffects';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || (import.meta.env.PROD ? "" : "http://localhost:3000");

const MainGame = ({ apiKey, baseUrl, model, onLogout }) => {
    const [caseData, setCaseData] = useState(null);
    const [activeTab, setActiveTab] = useState('setup');
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [theme, setTheme] = useState('');
    const [modal, setModal] = useState(null);

    // Suspect Interrogation State
    const [suspectsState, setSuspectsState] = useState({});
    const [currentSuspect, setCurrentSuspect] = useState(null);
    const [inputQuestion, setInputQuestion] = useState('');
    const [isOverloaded, setIsOverloaded] = useState(false);
    const chatEndRef = useRef(null);

    // Truth State
    const [showTruth, setShowTruth] = useState(false);
    const [showGradeReveal, setShowGradeReveal] = useState(false);
    const [showFlashback, setShowFlashback] = useState(false);
    const [finalGrade, setFinalGrade] = useState(null);
    const [showDeductionModal, setShowDeductionModal] = useState(false);
    const [evaluation, setEvaluation] = useState('');
    const [deductionDraft, setDeductionDraft] = useState({ killer: '', method: '', motive: '' });

    // Notes & Connections State
    const [notes, setNotes] = useState([]);
    const [foundClues, setFoundClues] = useState([]);
    const [searchedAreas, setSearchedAreas] = useState([]);
    const [connections, setConnections] = useState([]);
    const [searchTimers, setSearchTimers] = useState({});
    const [searchResult, setSearchResult] = useState(null);
    const [draggedItem, setDraggedItem] = useState(null);
    const [drawingLine, setDrawingLine] = useState(null);
    const canvasRef = useRef(null);

    // Daily Challenge State
    const [dailyTheme, setDailyTheme] = useState('');
    const [todayDate, setTodayDate] = useState('');
    const [dailyLoading, setDailyLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300);

    // Dynamic Events State
    const [eventsTriggered, setEventsTriggered] = useState({
        news: [], // List of timestamps when news triggered
        breakdown: false, // Has breakdown event happened?
        urgency: false, // Has urgency warning happened?
        interference: false // Is interference active?
    });
    const [discoveredNews, setDiscoveredNews] = useState([]); // New state for news history
    const [canGiveUp, setCanGiveUp] = useState(false);
    const [extraLocations, setExtraLocations] = useState([]); // Changed from single string to array
    const [hiddenLocationData, setHiddenLocationData] = useState(null); // Store hidden location data
    const [hackingTarget, setHackingTarget] = useState(null); // { area, clueIndex }

    // Points System
    const [points, setPoints] = useState(0);
    const isDev = apiKey === 'sk-606bfbb79c9640d78aebabb7c5e596cf';

    // Radio State
    const [radioChannels, setRadioChannels] = useState({ 1: null, 2: null, 3: null });
    const [activeChannel, setActiveChannel] = useState(1);
    const [unreadChannels, setUnreadChannels] = useState([]);

    // User Stress System
    const [userStress, setUserStress] = useState(5);
    const [stressModifiers, setStressModifiers] = useState([]); // Array of { id, amount, startTime, duration, type: 'spike'|'relief' }
    const [stressOffset, setStressOffset] = useState(0); // Permanent reductions from breakthroughs

    // --- Effects ---

    const unlockHiddenLocation = (sourceType) => {
        if (!hiddenLocationData || extraLocations.includes(hiddenLocationData.name)) return;

        setExtraLocations(prev => [...prev, hiddenLocationData.name]);

        let title = "新地点发现！";
        let content = "";

        if (sourceType === 'radio') {
            content = `通过电台情报，你锁定了新的搜查区域：\n\n【${hiddenLocationData.name}】\n\n(已添加至搜查列表)`;
        } else if (sourceType === 'hacking') {
            content = `在加密数据中，你发现了隐藏地点的坐标：\n\n【${hiddenLocationData.name}】\n\n(已添加至搜查列表)`;
        } else {
            content = `你发现了新的搜查区域：\n\n【${hiddenLocationData.name}】`;
        }

        setModal({
            title: title,
            content: content,
            type: 'info'
        });
        SoundManager.playAlert();

        // Add hidden clues to caseData.clues
        if (hiddenLocationData.clues) {
            const newClues = hiddenLocationData.clues.map(c => ({...c, location: hiddenLocationData.name, is_hidden: true}));
            setCaseData(prev => ({
                ...prev,
                clues: [...prev.clues, ...newClues]
            }));
        }
    };

    useEffect(() => {
        if (caseData) {
            const timer = setTimeout(() => setCanGiveUp(true), 300000); // 5 minutes
            return () => clearTimeout(timer);
        } else {
            setCanGiveUp(false);
        }
    }, [caseData]);

    useEffect(() => {
        if (!apiKey) return;

        fetch(`${SERVER_URL}/user/login`, {
             method: 'POST',
             headers: { 'x-api-key': apiKey }
        })
        .then(res => res.json())
        .then(data => {
             setPoints(data.points);
             if (data.awarded) {
                  setModal({ title: "每日登录奖励", content: data.message });
             }
        })
        .catch(err => console.error("Login Error:", err));
    }, [apiKey]); // Run once when apiKey changes

    useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [suspectsState, currentSuspect]);

    // Radio Logic: Expiration & Observation
    useEffect(() => {
        const timer = setInterval(() => {
            setRadioChannels(prev => {
                const next = { ...prev };
                let changed = false;
                [1, 2, 3].forEach(ch => {
                    if (next[ch] && Date.now() > next[ch].expiresAt) {
                        next[ch] = null;
                        changed = true;
                    }
                });
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Clean up unread channels when messages expire
    useEffect(() => {
        setUnreadChannels(prev => prev.filter(ch => radioChannels[ch] !== null));
    }, [radioChannels]);

    useEffect(() => {
        const msg = radioChannels[activeChannel];
        if (msg && !msg.discovered) {
            // Mark as discovered
            setRadioChannels(prev => ({
                ...prev,
                [activeChannel]: { ...msg, discovered: true }
            }));
            // Add to evidence/notes
            if (!discoveredNews.includes(msg.content)) {
                addNote('text', msg.content);
                setDiscoveredNews(prev => [...prev, msg.content]);
                SoundManager.playConnectSuccess();

                // Check for Hidden Location Unlock
                if (hiddenLocationData && msg.content === hiddenLocationData.unlock_news && !extraLocations.includes(hiddenLocationData.name)) {
                    unlockHiddenLocation('radio');
                }
            }
            // Remove from unread
            setUnreadChannels(prev => prev.filter(c => c !== activeChannel));
        }
    }, [activeChannel, radioChannels, discoveredNews]);

    // Timer & Events Logic
    useEffect(() => {
        if (!caseData || finalGrade) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const newTime = Math.max(0, prev - 1);
                const elapsedMinutes = (5400 - newTime) / 60; // Assuming 90 mins total
                const remainingMinutes = newTime / 60;

                // 1. News Events (Y)
                if (newTime % 60 === 0 && elapsedMinutes <= 20) {
                    const baseProb = 0.5;
                    const currentProb = Math.max(0, baseProb * (1 - (elapsedMinutes / 20)));

                    if (Math.random() < currentProb) {
                        // Trigger News Event
                        let randomNews = null;
                        if (caseData.radio_broadcasts && caseData.radio_broadcasts.length > 0) {
                            // Pick a random specific news that hasn't been discovered yet
                            const undiscovered = caseData.radio_broadcasts.filter(n => !discoveredNews.includes(n));
                            if (undiscovered.length > 0) {
                                randomNews = undiscovered[Math.floor(Math.random() * undiscovered.length)];
                            }
                        }

                        if (randomNews) {
                            const targetChannel = Math.floor(Math.random() * 3) + 1;
                            const newMessage = {
                                type: 'NEWS',
                                content: randomNews,
                                timestamp: Date.now(),
                                expiresAt: Date.now() + 120000, // 2 minutes
                                discovered: false
                            };

                            setRadioChannels(prev => ({ ...prev, [targetChannel]: newMessage }));
                            setUnreadChannels(prev => [...new Set([...prev, targetChannel])]);
                            SoundManager.playTone(600, 'sine', 0.5); // Beep
                            setTimeout(() => SoundManager.playTone(600, 'sine', 0.5), 200); // Beep beep
                        }
                    }
                }

                // 2. Suspect Breakdown / Evidence Destruction (X)
                if (elapsedMinutes >= 30 && !eventsTriggered.breakdown) {
                        if (Math.random() < 0.02) { // Small chance per minute
                            setEventsTriggered(prev => ({ ...prev, breakdown: true }));
                            const locationName = hiddenLocationData ? hiddenLocationData.name : "私人保险箱";
                            setExtraLocations(prev => [...prev, locationName]); // Add the new location

                            // Inject clues associated with the hidden location
                            if (hiddenLocationData && hiddenLocationData.clues) {
                                const newClues = hiddenLocationData.clues.map(c => ({
                                    ...c,
                                    location: hiddenLocationData.name,
                                    is_hidden: true
                                }));
                                setCaseData(prev => ({
                                    ...prev,
                                    clues: [...prev.clues, ...newClues]
                                }));
                            }

                            setModal({
                                title: "紧急事态",
                                content: `嫌疑人情绪失控，试图销毁证据！\n\n(已解锁新的搜查区域：【${locationName}】)`,
                                type: 'warning'
                            });
                            SoundManager.playAlert();
                            const hiddenClueIndex = caseData.clues.findIndex(c => c.is_hidden && !foundClues.includes(caseData.clues.indexOf(c)));
                            if (hiddenClueIndex !== -1) {
                                setFoundClues(prev => [...prev, hiddenClueIndex]);
                            }
                        }
                }

                // 3. Urgency Event (5 mins remaining)
                if (remainingMinutes <= 5 && remainingMinutes > 4 && !eventsTriggered.urgency) {
                        setEventsTriggered(prev => ({ ...prev, urgency: true }));
                        setModal({
                            title: "上级施压",
                            content: "局长发来最后通牒：\n\n“再给你 5 分钟！如果还破不了案，就等着扣工资吧！”\n\n(结案评分将受到严厉惩罚)",
                            type: 'danger'
                        });
                        SoundManager.playAlert();
                }

                return newTime;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [caseData, finalGrade, eventsTriggered, foundClues]);

    useEffect(() => {
        const timer = setInterval(() => {
            setSuspectsState(prev => {
                const next = { ...prev };
                let changed = false;
                for (const name in next) {
                    const s = next[name];
                    // Stress Decay
                    const timeSinceIncrease = Date.now() - (s.lastStressIncreaseTime || 0);
                    if (s.stress > 0 && timeSinceIncrease > 15000) {
                        next[name] = { ...next[name], stress: Math.max(0, s.stress - 2) };
                        changed = true;
                    }
                    // Fatigue Decay
                    if (s.fatigue > s.baseFatigue) {
                        const decayRate = s.fatigue <= 20 ? 0.5 : 0.33;
                        next[name] = { ...next[name], fatigue: Math.max(s.baseFatigue, s.fatigue - decayRate) };
                        changed = true;
                    }
                }
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // User Stress Calculation Loop
    useEffect(() => {
        if (!caseData || finalGrade) return;

        // Clean up expired modifiers
        const now = Date.now();
        let modifierSum = 0;
        let activeModifiers = [];
        let hasExpired = false;

        stressModifiers.forEach(m => {
            if (now > m.startTime + m.duration) {
                hasExpired = true;
            } else {
                activeModifiers.push(m);
                let currentAmount = m.amount;
                if (m.type === 'spike') {
                    // Linear decay
                    currentAmount = m.amount * (1 - (now - m.startTime) / m.duration);
                }
                modifierSum += currentAmount;
            }
        });

        if (hasExpired) {
             setStressModifiers(activeModifiers);
        }

        // Base Stress Calculation
        const elapsed = 5400 - timeLeft;
        let base = 5;

        if (timeLeft > 1800) {
             // First 60 mins (3600s): 5 -> 80
             base = 5 + (75 * (elapsed / 3600));
        } else {
             // Last 30 mins (1800s): 80 -> 100
             base = 80 + (20 * ((1800 - timeLeft) / 1800));
        }

        const total = Math.max(0, Math.min(100, base + modifierSum + stressOffset));
        setUserStress(total);

    }, [timeLeft, stressModifiers, stressOffset, caseData, finalGrade]);

    useEffect(() => {
        try {
            const savedNotes = localStorage.getItem('detective_notes_v2');
            if (savedNotes) setNotes(JSON.parse(savedNotes));
            const savedConns = localStorage.getItem('detective_connections_v1');
            if (savedConns) setConnections(JSON.parse(savedConns));
        } catch (e) { console.error("Failed to load notes", e); }
    }, []);

    useEffect(() => {
        localStorage.setItem('detective_notes_v2', JSON.stringify(notes));
        localStorage.setItem('detective_connections_v1', JSON.stringify(connections));
    }, [notes, connections]);

    useEffect(() => {
        const now = new Date();
        const dateStr = `${now.getFullYear()}/${now.getMonth()+1}/${now.getDate()}`;
        setTodayDate(dateStr);
        const cachedTheme = localStorage.getItem('detective_daily_theme_' + dateStr);
        if (cachedTheme) setDailyTheme(cachedTheme);
        else if (apiKey) fetchDailyTheme(dateStr);

        try {
            const savedDraft = localStorage.getItem('detective_deduction_draft');
            if (savedDraft) setDeductionDraft(JSON.parse(savedDraft));
        } catch (e) {}
    }, []);

    // --- API Calls ---

    const fetchDailyTheme = async (dateStr) => {
        setDailyLoading(true);
        try {
            const res = await fetch(`${SERVER_URL}/daily-theme`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-base-url': baseUrl },
                body: JSON.stringify({ date: dateStr, model })
            });
            const data = await res.json();
            if (data.theme) {
                setDailyTheme(data.theme);
                localStorage.setItem('detective_daily_theme_' + dateStr, data.theme);
            }
        } catch (e) { setDailyTheme("历史上的今日神秘事件调查"); } finally { setDailyLoading(false); }
    };

    const generateCase = async () => {
        if (!isDev) {
            if (points < 10) {
                setModal({ title: "积分不足", content: "开启新案件需要 10 积分。\n请等待明日配给或联系管理员。", type: 'danger' });
                return;
            }
            setPoints(p => p - 10);
        }

        if (!theme) return setModal({ title: "提示", content: "请输入题材！" });
        setLoading(true);
        setProgress(0);
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 95) return 95;
                const increment = prev < 30 ? 5 : prev < 60 ? 2 : prev < 80 ? 1 : 0.2;
                return Math.min(prev + increment, 95);
            });
        }, 500);

        try {
            const promptTheme = `${theme} (请用中文生成)`;
            const res = await fetch(`${SERVER_URL}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-base-url': baseUrl },
                body: JSON.stringify({ theme: promptTheme, model })
            });
            const data = await res.json();
            if (data.error) throw new Error(data.error);

            clearInterval(interval);
            setProgress(100);
            setTimeout(() => {
                setCaseData(data);
                const initialSuspectsState = {};
                const personalities = ['急躁', '固执', '软弱', '冷静', '阴险'];
                const baseFatigueMap = { '急躁': 20, '固执': 10, '软弱': 5, '冷静': 0, '阴险': 15 };

                data.suspects.forEach(s => {
                    const p = personalities[Math.floor(Math.random() * personalities.length)];
                    initialSuspectsState[s.name] = {
                        history: [],
                        stress: 0,
                        fatigue: baseFatigueMap[p],
                        baseFatigue: baseFatigueMap[p],
                        personality: p,
                        lockedUntil: 0,
                        lastStressIncreaseTime: 0
                    };
                });
                setSuspectsState(initialSuspectsState);
                setCurrentSuspect(data.suspects[0].name);

                setActiveTab('case');
                setShowTruth(false);
                setFinalGrade(null);
                setTimeLeft(5400); // 90 minutes = 5400 seconds
                setLoading(false);
                setNotes([]);
                setFoundClues([]);
                setSearchedAreas([]);
                setConnections([]);
                setSearchTimers({});
                setSearchResult(null);
                setDeductionDraft({ killer: '', method: '', motive: '' });
                localStorage.removeItem('detective_deduction_draft');
                setEventsTriggered({ news: [], breakdown: false, urgency: false, interference: false });
                setDiscoveredNews([]);
                setExtraLocations([]);
                setHiddenLocationData(null);

                // Always load Hidden Location if server provides it
                if (data.hidden_location) {
                    setHiddenLocationData(data.hidden_location);

                    // Only 2.3% Chance for News to reveal it
                    if (Math.random() < 0.023) {
                        if (!data.radio_broadcasts) data.radio_broadcasts = [];
                        data.radio_broadcasts.push(data.hidden_location.unlock_news);
                    }
                }
            }, 500);
        } catch (e) {
            clearInterval(interval);
            setModal({ title: "生成失败", content: e.message, type: 'danger' });
            setLoading(false);
        }
    };

    const askQuestion = async (overrideQuestion = null) => {
        if (isOverloaded || !currentSuspect) return;
        const suspectState = suspectsState[currentSuspect];
        if (!suspectState) return;

        if (Date.now() < (suspectState.lockedUntil || 0)) {
            const remaining = Math.ceil((suspectState.lockedUntil - Date.now()) / 1000 / 60);
            setModal({ title: "对话暂停", content: `${currentSuspect} 情绪过于激动，拒绝回答任何问题。\n\n需要冷静时间：约 ${remaining} 分钟。`, type: 'danger' });
            return;
        }

        const q = overrideQuestion || inputQuestion;
        if (!q.trim()) return;

        const currentStress = suspectState.stress || 0;

        const userMsg = { role: 'user', content: q };
        setSuspectsState(prev => {
            const current = prev[currentSuspect];
            if (!current) return prev;
            return {
                ...prev,
                [currentSuspect]: { ...current, history: [...current.history, userMsg] }
            };
        });

        setInputQuestion('');
        SoundManager.playTyping();

        try {
            const latestHistory = [...suspectState.history, userMsg];

            const res = await fetch(`${SERVER_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-base-url': baseUrl },
                body: JSON.stringify({
                    question: q,
                    caseData,
                    history: latestHistory,
                    model,
                    stress: currentStress,
                    fatigue: suspectState.fatigue || 0,
                    personality: suspectState.personality || '冷静',
                    suspectName: currentSuspect
                })
            });
            const data = await res.json();
            console.log("Server Response:", data);

            if (data.lockout) {
                const unlockTime = Date.now() + data.lockout;

                // Add Stress Modifier (Spike)
                setStressModifiers(prev => [
                    ...prev,
                    {
                        id: Date.now(),
                        amount: 15,
                        startTime: Date.now(),
                        duration: 900000,
                        type: 'spike'
                    }
                ]);

                const VIOLATION_MAP = {
                    "VIOLATION_VIOLENCE": {
                        title: "禁止暴力对话",
                        content: "检测到不正当对话倾向（威胁、身体接触或环境恐吓）。\n\n根据《侦探行为准则》，对话已强制中断 5 分钟以示警戒。",
                        log: "【系统警告】检测到暴力倾向，对话强制中断。"
                    },
                    "VIOLATION_ENUMERATION": {
                        title: "禁止穷举线索",
                        content: "检测到机械式穷举提问（如反复询问不同物品）。\n\n侦探应基于逻辑构建证据链，而非通过试错来获取信息。\n对话已暂时锁定 5 分钟。",
                        log: "【系统警告】检测到穷举线索行为，对话暂停。"
                    }
                };

                const violation = VIOLATION_MAP[data.answer] || {
                    title: "嫌疑人拒绝配合",
                    content: data.answer || "嫌疑人拒绝继续回答问题。\n请等待其冷静后再进行对话。",
                    log: "【系统记录】嫌疑人拒绝回答并保持沉默。"
                };

                setSuspectsState(prev => {
                    const current = prev[currentSuspect];
                    if (!current) return prev;
                    return {
                        ...prev,
                        [currentSuspect]: {
                            ...current,
                            lockedUntil: unlockTime,
                            history: [...current.history, { role: 'assistant', content: violation.log }]
                        }
                    };
                });
                SoundManager.playAlert();

                setModal({
                    title: violation.title,
                    content: violation.content,
                    type: 'danger'
                });
                return;
            }

            let answerText = data.answer;
            const verifiedMatch = answerText.match(/\[VERIFIED:\s*(.*?)\]/);

            setSuspectsState(prev => {
                const current = prev[currentSuspect];
                if (!current) return prev;

                const newStress = data.newStress !== undefined ? data.newStress : current.stress;
                const newFatigue = data.newFatigue !== undefined ? data.newFatigue : current.fatigue;

                if (newStress - current.stress > 10) {
                    SoundManager.playTone(800, 'triangle', 0.1);
                }

                const isStressIncreased = newStress > current.stress;

                return {
                    ...prev,
                    [currentSuspect]: {
                        ...current,
                        stress: newStress,
                        fatigue: newFatigue,
                        history: [...current.history, { role: 'assistant', content: answerText }],
                        lastStressIncreaseTime: isStressIncreased ? Date.now() : (current.lastStressIncreaseTime || 0)
                    }
                };
            });

            if (verifiedMatch) {
                const verifiedName = verifiedMatch[1].trim();
                answerText = answerText.replace(verifiedMatch[0], '').trim();
                SoundManager.playConnectSuccess();

                setNotes(prevNotes => {
                    const exists = prevNotes.find(n => n.content === verifiedName);
                    if (exists) return prevNotes.map(n => n.id === exists.id ? { ...n, verified: true } : n);
                    else {
                        let type = 'text';
                        if (caseData.suspects.some(s => s.name === verifiedName)) type = 'suspect';
                        else if (caseData.clues.some(c => c.title === verifiedName)) type = 'clue';
                        return [...prevNotes, { id: Date.now() + Math.random(), type, content: verifiedName, x: Math.random() * 200 + 50, y: Math.random() * 200 + 50, verified: true }];
                    }
                });
            } else {
                SoundManager.playTyping();
            }

        } catch (e) {
            console.error("Ask Error:", e);
            setSuspectsState(prev => {
                const current = prev[currentSuspect];
                if (!current) return prev;
                return {
                    ...prev,
                    [currentSuspect]: {
                        ...current,
                        history: [...current.history, { role: 'assistant', content: "Error: 连接中断，请重试。" }]
                    }
                };
            });
        }
    };

    const submitDeduction = async () => {
        const k = deductionDraft.killer;
        const m = deductionDraft.method;
        const r = deductionDraft.motive;
        if(!k || !m || !r) return setModal({ title: "提示", content: "请填写完整的结案报告！" });
        const prompt = `玩家提交的推理报告：\n凶手：${k}\n手法：${m}\n动机：${r}\n\n请根据案件真相进行评分（S/A/B/C）。最低评级为C。\n请在回复的第一行只输出评级字母（例如：S）。\n第二行开始输出简短点评。`;

        try {
            const res = await fetch(`${SERVER_URL}/ask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-base-url': baseUrl },
                body: JSON.stringify({ question: prompt, caseData, history: [], model })
            });
            const data = await res.json();
            const lines = data.answer.split('\n');
            const gradeMatch = lines[0].match(/[SABC]/);
            const grade = gradeMatch ? gradeMatch[0] : 'C';

            setFinalGrade(grade);
            setEvaluation(data.answer);
            setShowDeductionModal(false);
            setShowGradeReveal(true);

            if (!isDev) {
                let reward = 0;
                if (grade === 'S') reward = 20;
                else if (grade === 'A') reward = 15;
                else if (grade === 'B') reward = 10;
                else if (grade === 'C') reward = -5; // Penalty for C grade

                if (reward !== 0) {
                    setPoints(prev => {
                        const newPoints = prev + reward;
                        localStorage.setItem('detective_points', newPoints);
                        return newPoints;
                    });
                    // Show reward modal after a short delay to allow grade reveal to start
                    setTimeout(() => {
                        setModal({
                            title: reward > 0 ? "结案奖励" : "结案惩罚",
                            content: reward > 0
                                ? `恭喜侦探！\n\n评级: ${grade}\n获得积分: +${reward}`
                                : `遗憾。\n\n评级: ${grade}\n表现不佳，扣除积分: ${reward}`,
                            type: reward > 0 ? 'info' : 'danger'
                        });
                    }, 2000);
                }
            }
        } catch(e) { setModal({ title: "错误", content: "提交失败", type: 'danger' }); }
    };

    const saveDeductionDraft = () => {
        localStorage.setItem('detective_deduction_draft', JSON.stringify(deductionDraft));
        setModal({ title: "提示", content: "草稿已保存" });
    };

    const handleGiveUp = () => {
        setModal({
            title: "放弃推理",
            content: "确定要放弃推理吗？这将导致本次案件评级为 F。",
            type: 'danger',
            actions: (
                <React.Fragment>
                    <button onClick={() => setModal(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold text-sm">取消</button>
                    <button onClick={() => {
                        setModal(null);
                        setFinalGrade('F');
                        setEvaluation("玩家放弃了推理。");
                        setShowGradeReveal(true);
                        if (!isDev) {
                            setPoints(prev => {
                                const newPoints = prev - 10;
                                localStorage.setItem('detective_points', newPoints);
                                return newPoints;
                            });
                            setTimeout(() => {
                                setModal({
                                    title: "结案惩罚",
                                    content: `遗憾。\n\n评级: F (放弃)\n扣除积分: -10`,
                                    type: 'danger'
                                });
                            }, 2000);
                        }
                    }} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded font-bold text-sm ml-2 shadow-[0_0_10px_rgba(220,38,38,0.4)]">确认放弃</button>
                </React.Fragment>
            )
        });
    };

    const handleLogout = () => {
        if (caseData) {
            setModal({
                title: "断开连接",
                content: "当前案件正在进行中。断开连接将丢失所有未保存的进度。\n确定要退出终端吗？",
                type: 'danger',
                actions: (
                    <React.Fragment>
                        <button onClick={() => setModal(null)} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-bold text-sm">取消</button>
                        <button onClick={() => { setModal(null); onLogout(); }} className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded font-bold text-sm ml-2">确认断开</button>
                    </React.Fragment>
                )
            });
        } else {
            onLogout();
        }
    };

    const addNote = (type, content) => {
        setNotes([...notes, { id: Date.now() + Math.random(), type, content, x: Math.random() * 200 + 50, y: Math.random() * 200 + 50 }]);
    };
    const deleteNote = (id) => {
        setNotes(notes.filter(n => n.id !== id));
        setConnections(connections.filter(c => c.from !== id && c.to !== id));
    };
    const handleMouseDown = (e, id) => {
        if (e.shiftKey) {
            e.stopPropagation();
            const rect = e.target.getBoundingClientRect();
            const containerRect = canvasRef.current.getBoundingClientRect();
            const startX = rect.left + rect.width / 2 - containerRect.left;
            const startY = rect.top + rect.height / 2 - containerRect.top;
            setDrawingLine({ fromId: id, startX, startY, endX: startX, endY: startY });
        } else {
            setDraggedItem({ id, startX: e.clientX, startY: e.clientY });
        }
    };
    const handleMouseMove = (e) => {
        if (draggedItem) {
            const containerRect = canvasRef.current.getBoundingClientRect();
            const x = e.clientX - containerRect.left - 75; // Center offset
            const y = e.clientY - containerRect.top - 40;
            setNotes(notes.map(n => n.id === draggedItem.id ? { ...n, x, y } : n));
        } else if (drawingLine) {
            const containerRect = canvasRef.current.getBoundingClientRect();
            setDrawingLine({ ...drawingLine, endX: e.clientX - containerRect.left, endY: e.clientY - containerRect.top });
        }
    };
    const handleMouseUp = (e) => {
        if (drawingLine) {
            let target = e.target;
            while (target && !target.dataset.noteId) {
                target = target.parentElement;
                if (target === canvasRef.current) break;
            }
            if (target && target.dataset.noteId) {
                const toId = parseFloat(target.dataset.noteId);
                if (toId !== drawingLine.fromId) {
                    // Create new connection (unverified by default)
                    setConnections([...connections, { id: Date.now() + Math.random(), from: drawingLine.fromId, to: toId, verified: false }]);
                }
            }
            setDrawingLine(null);
        }
        setDraggedItem(null);
    };

    const verifyConnection = async (connId) => {
        if (!isDev && points < 1) {
            setModal({ title: "积分不足", content: "验证猜想需要 1 积分。", type: 'danger' });
            return;
        }

        const conn = connections.find(c => c.id === connId);
        if (!conn) return;
        const fromNode = notes.find(n => n.id === conn.from);
        const toNode = notes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;

        // Deduct point immediately
        if (!isDev) {
            setPoints(prev => {
                const newPoints = prev - 1;
                localStorage.setItem('detective_points', newPoints); // Force save
                return newPoints;
            });
        }

        try {
            const res = await fetch(`${SERVER_URL}/verify-connection`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'x-base-url': baseUrl },
                body: JSON.stringify({
                    connection: { from: fromNode.content, to: toNode.content },
                    caseData,
                    model
                })
            });
            const data = await res.json();

            if (data.isCorrect) {
                // Permanent Stress Relief
                setStressOffset(prev => prev - 10);

                // Refund point
                if (!isDev) {
                    setPoints(prev => {
                        const newPoints = prev + 1;
                        localStorage.setItem('detective_points', newPoints); // Force save
                        return newPoints;
                    });
                }
                setConnections(prev => prev.map(c => c.id === connId ? { ...c, verified: true, status: 'correct' } : c));
                SoundManager.playConnectSuccess();

                // Create Deduction Node
                const deductionId = Date.now() + Math.random();
                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2;

                setNotes(prev => [
                    ...prev,
                    {
                        id: deductionId,
                        type: 'deduction',
                        content: data.reason,
                        x: midX,
                        y: midY + 100, // Place below the connection
                        verified: true
                    }
                ]);

                // Link deduction to original nodes
                setConnections(prev => [
                    ...prev,
                    { id: Date.now() + Math.random(), from: fromNode.id, to: deductionId, verified: true, status: 'correct' },
                    { id: Date.now() + Math.random() + 1, from: toNode.id, to: deductionId, verified: true, status: 'correct' }
                ]);

                setModal({ title: "验证成功", content: `[验证成功] 猜想正确！\n\n${data.reason}\n\n(已生成新的推理节点，积分已返还)` });
            } else {
                setConnections(prev => prev.map(c => c.id === connId ? { ...c, verified: true, status: 'incorrect' } : c));
                SoundManager.playAlert();
                setModal({ title: "验证失败", content: `[验证失败] 猜想错误。\n\n${data.reason}\n\n(积分不予返还)`, type: 'danger' });
            }

        } catch (e) {
            setModal({ title: "错误", content: "验证服务连接失败", type: 'danger' });
            if (!isDev) {
                setPoints(prev => {
                    const newPoints = prev + 1;
                    localStorage.setItem('detective_points', newPoints); // Force save
                    return newPoints;
                });
            }
        }
    };

    const startSearch = (area) => {
        if (searchTimers[area]) return;
        const isAnySearching = Object.keys(searchTimers).length > 0;
        if (isAnySearching) return;

        const endTime = Date.now() + 30000;
        setSearchTimers(prev => ({ ...prev, [area]: endTime }));
        SoundManager.playPageFlip();

        // Start a timer to check completion
        const timer = setInterval(() => {
            if (Date.now() >= endTime) {
                clearInterval(timer);
                completeSearch(area);
            } else {
                // Force re-render for progress bar
                setSearchTimers(prev => ({ ...prev }));
            }
        }, 100);
    };

    const completeSearch = (area) => {
        setSearchTimers(prev => {
            const next = { ...prev };
            delete next[area];
            return next;
        });

        // Mark area as searched regardless of outcome
        setSearchedAreas(prev => [...new Set([...prev, area])]);

        // 1. Try to find an UNFOUND hidden clue first
        let foundIndex = caseData.clues.findIndex((c, index) =>
            c.is_hidden &&
            c.location &&
            area.includes(c.location) &&
            !foundClues.includes(index)
        );

        // 2. If all hidden clues are found, find ANY hidden clue to show "already found" message
        if (foundIndex === -1) {
            foundIndex = caseData.clues.findIndex(c => c.is_hidden && c.location && area.includes(c.location));

            if (foundIndex !== -1) {
                 setSearchResult({
                    success: true,
                    title: "再次确认",
                    content: `这里只有【${caseData.clues[foundIndex].title}】，没有其他发现了。`,
                    detail: ""
                });
                return;
            }
        }

        if (foundIndex !== -1) {
            // Check for Hacking Keywords
            const clueTitle = caseData.clues[foundIndex].title;
            const hackingKeywords = ["电脑", "手机", "加密", "密码", "U盘", "监控", "录音笔", "平板", "服务器", "硬盘", "芯片", "笔记本", "终端", "主机", "数据库"];
            if (hackingKeywords.some(k => clueTitle.includes(k))) {
                setHackingTarget({ area, clueIndex: foundIndex });
                return;
            }

            revealClue(foundIndex, area);
        } else {
            setSearchResult({
                success: false,
                title: "搜查无果",
                content: `在【${area}】没有发现任何隐藏线索。`,
                detail: ""
            });
            SoundManager.playAlert();
        }
    };

    const revealClue = (index, area) => {
        setFoundClues(prev => [...prev, index]);
        setSearchResult({
            success: true,
            title: "发现隐藏线索！",
            content: `在【${area}】发现了：${caseData.clues[index].title}`,
            detail: caseData.clues[index].content
        });
        SoundManager.playConnectSuccess();
    };

    const onHackingSuccess = () => {
        if (!hackingTarget) return;
        revealClue(hackingTarget.clueIndex, hackingTarget.area);

        // Try to unlock hidden location via hacking
        if (hiddenLocationData && !extraLocations.includes(hiddenLocationData.name)) {
            unlockHiddenLocation('hacking');
        }

        setHackingTarget(null);
    };

    const onHackingFailure = () => {
        setHackingTarget(null);
        setSearchResult({
            success: false,
            title: "入侵失败",
            content: "安全系统触发！数据访问被拒绝。",
            detail: "你的行踪可能已暴露，精神压力上升。"
        });
        // Increase Stress
        setStressModifiers(prev => [
            ...prev,
            {
                id: Date.now(),
                amount: 10,
                startTime: Date.now(),
                duration: 300000, // 5 mins decay
                type: 'spike'
            }
        ]);
        SoundManager.playAlert();
    };

    const getGradeColor = (g) => {
        if (g === 'S') return 'text-green-600';
        if (g === 'A') return 'text-yellow-500';
        if (g === 'B') return 'text-purple-500';
        if (g === 'C') return 'text-blue-500';
        return 'text-gray-500';
    };

    const resetGame = () => {
        setCaseData(null);
        setActiveTab('setup');
        setTheme('');
    };

    return (
        <div className={`min-h-screen p-0 font-mono relative ${caseData && !finalGrade && isOverloaded ? 'glitch-mode' : ''}`}>
            <MatrixRain />
            <VisualEffects
                timeLeft={caseData && !finalGrade ? timeLeft : 5400}
                stressLevel={caseData && !finalGrade ? userStress : 0}
                isLocked={Boolean(currentSuspect && suspectsState[currentSuspect] && Date.now() < suspectsState[currentSuspect].lockedUntil)}
                isOverloaded={caseData && !finalGrade ? isOverloaded : false}
            />
            {modal && <Modal title={modal.title} type={modal.type} actions={modal.actions} onClose={() => setModal(null)}>{modal.content}</Modal>}

            {searchResult && (
                <Modal
                    title={searchResult.title}
                    type={searchResult.success ? 'success' : 'danger'}
                    onClose={() => setSearchResult(null)}
                    actions={
                        <button
                            onClick={() => setSearchResult(null)}
                            className={`w-full py-3 rounded font-bold ${searchResult.success ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}
                        >
                            确认
                        </button>
                    }
                >
                    <p className="text-white text-lg mb-2">{searchResult.content}</p>
                    {searchResult.detail && <p className="text-gray-400 text-sm mb-6">{searchResult.detail}</p>}
                </Modal>
            )}

            {showGradeReveal && <GradeReveal grade={finalGrade} onComplete={() => { setShowGradeReveal(false); setShowFlashback(true); }} />}
            {showFlashback && <FlashbackReveal truth={caseData.truth} onComplete={() => { setShowFlashback(false); setShowTruth(true); }} />}
            {hackingTarget && (
                <HackingMinigame
                    onSuccess={onHackingSuccess}
                    onFailure={onHackingFailure}
                    targetName={caseData.clues[hackingTarget.clueIndex].title}
                />
            )}

            {/* Header */}
            <header className="flex justify-between items-start border-b border-transparent pb-4 bg-transparent p-6 w-full">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-red-600 leading-none">DETECTIVE</h1>
                    <h1 className="text-4xl font-black tracking-tighter text-red-600 leading-none">ARCHIVE</h1>
                    <div className="text-sm text-green-800 font-mono mt-2 flex items-center gap-2 tracking-widest">
                        <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
                        {caseData ? "在线" : "正在连接..."}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="text-green-800 font-mono text-sm">{todayDate}</div>
                    <div className="text-green-500 font-bold text-xl">积分 {points}</div>
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-sm border border-red-900 px-3 py-1.5 rounded hover:bg-red-900/20 transition-colors mt-1 font-bold">断开连接</button>
                </div>
            </header>

            <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* Setup Phase */}
            {!caseData && (
                <div className="max-w-2xl mx-auto space-y-8 animate-fade-in mt-8">
                    {/* Custom Case */}
                    <div className="bg-[#0b1015] p-8 rounded border border-gray-700 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur relative overflow-hidden paper-texture">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-50"></div>
                        <h2 className="text-2xl font-bold mb-6 text-green-500 flex items-center gap-2">
                            创建档案
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-gray-400 text-xs mb-2 tracking-widest uppercase">案件题材 / 关键词</label>
                                <input
                                    type="text"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className="w-full bg-[#0f1720] border border-gray-600 p-4 text-gray-200 focus:border-green-500 focus:outline-none rounded text-lg placeholder-gray-600 font-mono"
                                    placeholder="输入案件题材..."
                                />
                            </div>
                            <button
                                onClick={generateCase}
                                disabled={loading}
                                className={`w-full py-4 rounded font-bold text-lg tracking-widest transition-all border ${loading ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-green-900/20 hover:bg-green-900/40 text-green-400 border-green-500 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]'}`}
                            >
                                {loading ? '系统处理中...' : '创建档案 [ -10 积分 ]'}
                            </button>
                        </div>
                        {loading && (
                            <div className="mt-6">
                                <div className="flex justify-between text-xs text-gray-500 mb-1 font-mono">
                                    <span>数据编译中</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full h-1 bg-gray-800 rounded overflow-hidden">
                                    <div className="h-full bg-green-500 shadow-[0_0_10px_rgba(220,38,38,0.8)] transition-all duration-300" style={{width: `${progress}%`}}></div>
                                </div>
                                <div className="mt-2 text-center text-xs text-green-800 font-mono animate-pulse">
                                    构建嫌疑人心理模型... 生成现场指纹... 伪造不在场证明...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Daily Challenge */}
                    <div className="border border-red-900/30 bg-[#0b1015] p-6 rounded relative overflow-hidden group hover:border-red-600/50 transition-all paper-texture">
                        <div className="absolute top-0 right-0 bg-red-900/80 text-red-200 text-[10px] px-2 py-1 font-mono tracking-wider">每日悬赏</div>
                        <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                            每日悬赏
                        </h2>
                        {dailyLoading ? (
                            <div className="text-green-900 animate-pulse font-mono">解密档案中...</div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-400 italic border-l-2 border-red-900 pl-4 py-2">{dailyTheme}</p>
                                <button
                                    onClick={() => { setTheme(dailyTheme); }}
                                    className="w-full py-3 bg-red-900/10 hover:bg-red-900/30 text-red-500 border border-red-800 hover:border-red-500 rounded font-bold transition-all text-sm tracking-widest hover:shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                                >
                                    接受委托
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Game Phase */}
            {caseData && (
                <div className="flex flex-col h-[calc(100vh-140px)]">
                    {/* Top Info Bar */}
                    <div className="flex justify-between items-start mb-4 bg-[#0b1015] p-4 rounded border border-gray-700">
                        <div>
                            <h2 className="text-xl font-black text-green-600 mb-1">{caseData.title}</h2>
                            <div className="text-sm text-gray-400 flex gap-4">
                                <span>受害者: {caseData.victim}</span>
                                <span>死因: {caseData.cause}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-mono font-bold text-green-500 flicker-text">
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </div>
                            <div className="text-xs text-gray-400">
                                {timeLeft > 0 && !finalGrade ? (
                                    <span className="text-green-400">剩余时间</span>
                                ) : !finalGrade ? (
                                    <button onClick={handleGiveUp} className="bg-green-900/50 hover:bg-green-800 text-red-200 px-2 py-1 rounded text-xs border border-green-800">放弃推理</button>
                                ) : (
                                    <span className="text-yellow-500 font-bold">案件已归档 ({finalGrade})</span>
                                )}
                            </div>
                            {/* Removed Stress Indicator */}
                        </div>
                    </div>

                    {/* Main Workspace */}
                    <div className="flex-1 flex gap-4 overflow-hidden">
                        {/* Left: Navigation */}
                        <div className="w-16 md:w-48 flex flex-col gap-1 h-full">
                            <div className="hidden md:block mb-1 flex-shrink-0">
                                <RadioWidget
                                    channels={radioChannels}
                                    activeChannel={activeChannel}
                                    onTune={setActiveChannel}
                                    unreadChannels={unreadChannels}
                                    stressLevel={userStress}
                                />
                            </div>

                            <div className="flex-1 flex flex-col gap-1 min-h-0">
                                <button onClick={() => setActiveTab('case')} className={`flex-1 p-2 rounded text-left border transition-all font-bold text-sm flex items-center ${activeTab === 'case' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-[#0b1015] border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                                    <span className="hidden md:inline">嫌疑人档案</span>
                                </button>
                                <button onClick={() => setActiveTab('clues')} className={`flex-1 p-2 rounded text-left border transition-all font-bold text-sm flex items-center ${activeTab === 'clues' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-[#0b1015] border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                                    <span className="hidden md:inline">线索</span>
                                </button>
                                <button onClick={() => setActiveTab('interrogate')} className={`flex-1 p-2 rounded text-left border transition-all font-bold text-sm flex items-center ${activeTab === 'interrogate' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-[#0b1015] border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                                    <span className="hidden md:inline">对话</span>
                                </button>
                                <button onClick={() => setActiveTab('mindmap')} className={`flex-1 p-2 rounded text-left border transition-all font-bold text-sm flex items-center ${activeTab === 'mindmap' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(220,38,38,0.2)]' : 'bg-[#0b1015] border-gray-700 text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
                                    <span className="hidden md:inline">侦探笔记</span>
                                </button>
                            </div>

                            <div className="mt-1 space-y-2 flex-shrink-0">
                                {finalGrade ? (
                                    <button onClick={resetGame} className="w-full p-3 rounded bg-green-900 hover:bg-green-800 text-white font-black border border-green-500 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all tracking-widest text-sm">
                                        <span className="hidden md:inline">新档案</span>
                                    </button>
                                ) : (
                                    <button onClick={() => setShowDeductionModal(true)} className="w-full p-3 rounded bg-green-900 hover:bg-green-800 text-gray-300 font-black border border-green-500 shadow-[0_0_15px_rgba(220,38,38,0.4)] transition-all tracking-widest text-sm">
                                        <span className="hidden md:inline">结案</span>
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Center: Content */}
                        <div className="flex-1 bg-[#0b1015] border border-gray-700 rounded p-4 overflow-y-auto relative shadow-inner">
                            {activeTab === 'case' && caseData && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-[#0b1015] p-6 rounded border border-gray-700">
                                        <h3 className="text-lg font-bold text-green-500 mb-4 border-b border-gray-700 pb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            嫌疑人档案
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {caseData.suspects.map((s, i) => (
                                                <div key={i} className="bg-[#0f1720] p-4 rounded border border-gray-700 hover:border-red-500 transition-colors cursor-pointer group" onClick={() => { setCurrentSuspect(s.name); setActiveTab('interrogate'); }}>
                                                    <div className="mb-2">
                                                        <div className="font-bold text-gray-200 text-xl mb-1 group-hover:text-green-400 transition-colors">{s.name}</div>
                                                        <div className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400 border border-gray-700 inline-block">{s.desc.split(' ')[0]}</div>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{s.desc}</p>
                                                    <div className="text-xs text-gray-500 bg-gray-800/50 p-2 rounded border border-gray-700">
                                                        <span className="block text-gray-400 mb-1 font-bold">主张:</span>
                                                        {s.alibi}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'clues' && caseData && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-[#0b1015] p-4 border border-gray-700 rounded">
                                        <h3 className="text-lg font-bold text-green-500 mb-2 border-b border-gray-700 pb-2">现场勘查记录</h3>
                                        <div className="space-y-2 text-gray-400 text-sm mb-6 font-mono">
                                            {caseData.scene.map((item, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <span className="text-green-700">[{i+1}]</span>
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <h3 className="text-lg font-bold text-green-500 mb-4 border-b border-gray-700 pb-2">搜查区域</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {caseData.searchable_areas ? [...caseData.searchable_areas, ...extraLocations].filter(Boolean).map((area, i) => {
                                                const endTime = searchTimers[area];
                                                const isSearching = !!endTime;
                                                const isAnySearching = Object.keys(searchTimers).length > 0;
                                                const progress = isSearching ? Math.min(100, ((Date.now() - (endTime - 30000)) / 30000) * 100) : 0;
                                                const hasSearched = searchedAreas.includes(area);

                                                // Parse area name to separate description
                                                // e.g. "书房，有一张桌子" -> title: "书房"
                                                const separators = /[，,。（(]/;
                                                const parts = area.split(separators);
                                                const title = parts[0];
                                                // Removed description rendering as requested

                                                return (
                                                    <div key={i} className="relative">
                                                        <button
                                                            onClick={() => startSearch(area)}
                                                            disabled={isAnySearching}
                                                            className={`w-full p-3 rounded border text-left transition-all relative overflow-hidden h-24 flex flex-col justify-center ${hasSearched ? 'bg-green-900/20 border-green-600 text-green-400' : isSearching ? 'bg-yellow-900/20 border-yellow-600 text-yellow-200' : isAnySearching ? 'bg-gray-800 border-gray-700 text-gray-600 cursor-not-allowed opacity-50' : 'bg-[#0f1720] border-gray-600 text-gray-300 hover:border-red-500 hover:text-green-400'}`}
                                                        >
                                                            <div className="relative z-10 w-full flex justify-between items-center px-2">
                                                                <span className="font-bold text-lg md:text-xl truncate block pr-2" title={area}>{title}</span>
                                                                {hasSearched && <span className="text-green-500 text-xs font-bold whitespace-nowrap">[已搜查]</span>}
                                                                {isAnySearching && !isSearching && !hasSearched && <span className="text-gray-500 text-xs whitespace-nowrap">[锁定]</span>}
                                                            </div>
                                                            {isSearching && (
                                                                <div className="relative z-10 text-xs font-mono mt-2 text-yellow-500 animate-pulse px-2">
                                                                    搜查中... {Math.ceil((endTime - Date.now()) / 1000)}s
                                                                </div>
                                                            )}
                                                            {isSearching && (
                                                                <div className="absolute bottom-0 left-0 h-1 bg-yellow-500 transition-all duration-100" style={{width: `${progress}%`}}></div>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            }) : (
                                                <div className="col-span-3 text-center text-gray-500 py-8 border border-dashed border-gray-700 rounded">
                                                    正在分析现场结构... (请重新生成案件以获取搜查点)
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h3 className="text-lg font-bold text-green-500 border-l-4 border-green-600 pl-3">物证清单</h3>
                                        {caseData.clues.map((c, index) => {
                                            if (c.is_hidden && !foundClues.includes(index)) return null;

                                            const hackingKeywords = ["电脑", "手机", "加密", "密码", "U盘", "监控", "录音笔", "平板", "服务器", "硬盘", "芯片", "笔记本", "终端", "主机", "数据库"];
                                            const isHackable = hackingKeywords.some(k => c.title.includes(k));

                                            return (
                                                <div
                                                    key={index}
                                                    onClick={() => {
                                                        if (isHackable) {
                                                            setHackingTarget({ area: c.location, clueIndex: index });
                                                        }
                                                    }}
                                                    className={`bg-[#0f1720] p-4 border border-gray-700 animate-fade-in transition-all relative group ${isHackable ? 'cursor-pointer hover:border-green-500 hover:bg-green-900/10 hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]' : 'hover:border-red-500/50'}`}
                                                >
                                                    <h4 className="font-bold text-green-400 flex items-center">
                                                        {c.title}
                                                        {c.is_hidden && <span className="text-[10px] bg-green-900/50 text-red-200 px-2 py-0.5 rounded ml-2 border border-green-800">隐藏</span>}
                                                        {isHackable && <span className="text-[10px] bg-blue-900/50 text-blue-200 px-2 py-0.5 rounded ml-2 border border-blue-800 animate-pulse">可破解</span>}
                                                        <span className="text-xs text-gray-500 font-normal ml-auto font-mono">位置: {c.location || '现场'}</span>
                                                    </h4>
                                                    <p className="text-gray-400 mt-2 text-sm">{c.content}</p>
                                                    {isHackable && (
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-[1px]">
                                                            <span className="text-green-500 font-mono font-bold tracking-widest border border-green-500 px-4 py-2 rounded bg-black">
                                                                &gt; 点击入侵系统 &lt;
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'interrogate' && (
                                <div className="h-full flex flex-col animate-fade-in">
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 border-b border-gray-700">
                                        {caseData.suspects.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentSuspect(s.name)}
                                                className={`px-4 py-2 rounded whitespace-nowrap border transition-all font-bold ${currentSuspect === s.name ? 'bg-green-900/50 border-green-500 text-green-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-[#0f1720] border-gray-700 text-gray-500 hover:bg-gray-800 hover:text-gray-300'}`}
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        {currentSuspect ? (
                                            <React.Fragment>
                                                <div className="mb-2">
                                                    <HeartRateMonitor stress={suspectsState[currentSuspect]?.stress || 0} />
                                                </div>
                                                <div className="flex-1 relative mb-4 bg-[#0f1720] border border-gray-700 rounded overflow-hidden shadow-inner">
                                                    <div className={`absolute inset-0 overflow-y-auto p-4 space-y-4 ${Date.now() < (suspectsState[currentSuspect]?.lockedUntil || 0) ? 'overflow-hidden pointer-events-none filter blur-sm' : ''}`}>
                                                        {suspectsState[currentSuspect]?.history.length === 0 && (
                                                            <div className="text-center text-green-900 text-sm mt-10 font-mono animate-pulse">
                                                                &gt; 正在联线 {currentSuspect}...
                                                            </div>
                                                        )}
                                                        {suspectsState[currentSuspect]?.history.map((msg, i) => (
                                                            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                                <div className={`chat-bubble ${msg.role === 'user' ? 'chat-user' : 'chat-ai'}`}>{msg.content}</div>
                                                            </div>
                                                        ))}
                                                        <div ref={chatEndRef} />
                                                    </div>

                                                    {suspectsState[currentSuspect]?.lockedUntil > Date.now() && (
                                                        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/80 backdrop-blur-sm">
                                                            <div className="text-center p-6 border border-red-900 rounded bg-black shadow-[0_0_30px_rgba(220,38,38,0.2)] animate-pulse">
                                                                <div className="text-2xl mb-2 font-bold text-red-600 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">[LOCKED]</div>
                                                                <h3 className="text-red-600 font-bold text-xl mb-2 tracking-widest">对方拒绝对话</h3>
                                                                <p className="text-red-500 text-xs mt-2 font-mono">
                                                                    {Math.ceil((suspectsState[currentSuspect].lockedUntil - Date.now()) / 1000 / 60)} 分钟剩余
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={inputQuestion}
                                                        onChange={(e) => setInputQuestion(e.target.value)}
                                                        onKeyDown={(e) => e.key === 'Enter' && askQuestion()}
                                                        placeholder="输入审讯指令..."
                                                        className="flex-1 bg-[#0f1720] border border-gray-600 p-3 text-green-400 focus:border-green-500 focus:outline-none rounded font-mono placeholder-gray-600"
                                                        disabled={Date.now() < (suspectsState[currentSuspect]?.lockedUntil || 0)}
                                                    />
                                                    <button onClick={() => askQuestion()} className="bg-green-900/20 hover:bg-green-900/40 text-green-500 px-6 rounded font-bold border border-green-800 hover:border-red-500 transition-all" disabled={Date.now() < (suspectsState[currentSuspect]?.lockedUntil || 0)}>发送</button>
                                                </div>
                                            </React.Fragment>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-green-900 font-mono animate-pulse">
                                                &lt; 选择审讯目标 &gt;
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'mindmap' && (
                                <div className="h-full flex gap-4 animate-fade-in">
                                    <div className="w-48 bg-[#0b1015] border-r border-gray-700 p-2 overflow-y-auto">
                                        <h4 className="text-xs text-green-700 uppercase mb-2 font-bold tracking-widest">证据池</h4>
                                        <div className="space-y-2">
                                            {caseData.suspects.map((s, i) => (
                                                <button key={`s-${i}`} onClick={() => addNote('suspect', s.name)} className="block w-full text-left bg-[#0f1720] text-gray-400 text-xs p-2 rounded border border-gray-700 hover:border-red-500 hover:text-green-400 transition-colors whitespace-normal break-words h-auto leading-tight">[嫌疑人] {s.name}</button>
                                            ))}
                                            {caseData.clues.map((c, i) => (
                                                <button key={`c-${i}`} onClick={() => addNote('clue', c.title)} className={`block w-full text-left bg-[#0f1720] text-gray-400 text-xs p-2 rounded border border-gray-700 hover:border-red-500 hover:text-green-400 transition-colors whitespace-normal break-words h-auto leading-tight ${c.is_hidden && !foundClues.includes(i) ? 'hidden' : ''}`}>[线索] {c.title}</button>
                                            ))}
                                            {discoveredNews.map((n, i) => (
                                                <button key={`n-${i}`} onClick={() => addNote('text', n)} className="block w-full text-left bg-[#0f1720] text-gray-400 text-xs p-2 rounded border border-gray-700 hover:border-red-500 hover:text-green-400 transition-colors whitespace-normal break-words h-auto leading-tight">[新闻] {n}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 relative bg-[#0b1015] overflow-hidden rounded border border-gray-700 cursor-crosshair"
                                         ref={canvasRef}
                                         onMouseMove={handleMouseMove}
                                         onMouseUp={handleMouseUp}
                                         onMouseLeave={handleMouseUp}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                                        <div className="absolute top-2 right-2 text-xs text-green-900 pointer-events-none select-none font-mono">
                                            Shift+拖拽: 连线 | 拖拽: 移动 | 双击: 删除
                                        </div>
                                        <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
                                            {connections.map(c => {
                                                const from = notes.find(n => n.id === c.from);
                                                const to = notes.find(n => n.id === c.to);
                                                if (!from || !to) return null;
                                                const midX = (from.x + 75 + to.x + 75) / 2;
                                                const midY = (from.y + 40 + to.y + 40) / 2;

                                                return (
                                                    <g key={c.id} className="pointer-events-auto">
                                                        <line x1={from.x + 75} y1={from.y + 40} x2={to.x + 75} y2={to.y + 40} stroke={c.status === 'correct' ? "#22c55e" : c.status === 'incorrect' ? "#22c55e" : "#22c55e"} strokeWidth="1" strokeDasharray={c.status === 'correct' ? "" : "5,5"} opacity="0.5" />
                                                        {!c.verified && (
                                                            <foreignObject x={midX - 30} y={midY - 15} width="60" height="30">
                                                                <button onClick={() => verifyConnection(c.id)} className="bg-black text-green-500 text-[10px] px-2 py-1 rounded border border-green-800 hover:bg-red-900/30 w-full shadow-lg font-mono">
                                                                    验证?
                                                                </button>
                                                            </foreignObject>
                                                        )}
                                                    </g>
                                                );
                                            })}
                                            {drawingLine && (
                                                <line x1={drawingLine.startX} y1={drawingLine.startY} x2={drawingLine.endX} y2={drawingLine.endY} stroke="#22c55e" strokeWidth="1" strokeDasharray="5,5" opacity="0.5" />
                                            )}
                                        </svg>
                                        {notes.map(note => (
                                            <div
                                                key={note.id}
                                                data-note-id={note.id}
                                                className={`absolute w-[150px] p-2 rounded border shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-move select-none transition-all ${note.type === 'suspect' ? 'bg-[#0f1720] border-green-900 text-green-400' : note.type === 'clue' ? 'bg-[#0f1720] border-gray-700 text-gray-300' : note.type === 'deduction' ? 'bg-green-900/20 border-green-500 text-green-300 font-bold' : 'bg-gray-800 border-gray-600 text-gray-200'} ${note.verified ? 'ring-1 ring-green-500 shadow-[0_0_10px_rgba(220,38,38,0.3)]' : ''}`}
                                                style={{ left: note.x, top: note.y, zIndex: 10 }}
                                                onMouseDown={(e) => handleMouseDown(e, note.id)}
                                                onDoubleClick={() => deleteNote(note.id)}
                                            >
                                                <div className={`text-xs ${note.type === 'deduction' ? 'whitespace-normal' : 'truncate'} text-center pointer-events-none font-mono`}>{note.content}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Deduction Modal */}
                    {showDeductionModal && (
                        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm">
                            <div className="bg-gray-900 border-2 border-green-600 p-8 rounded-lg max-w-2xl w-full shadow-[0_0_50px_rgba(220,38,38,0.1)]">
                                <h3 className="text-2xl font-black text-green-500 mb-6 border-b border-green-800 pb-4">提交结案报告</h3>
                                <div className="space-y-4 mb-8">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">认定的真凶</label>
                                        <CustomSelect
                                            value={deductionDraft.killer}
                                            onChange={(val) => setDeductionDraft({...deductionDraft, killer: val})}
                                            options={caseData.suspects.map(s => ({ value: s.name, label: s.name }))}
                                            placeholder="选择嫌疑人..."
                                            color="red"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">作案手法 (简述)</label>
                                        <textarea
                                            value={deductionDraft.method}
                                            onChange={(e) => setDeductionDraft({...deductionDraft, method: e.target.value})}
                                            className="w-full bg-black border border-gray-700 p-3 text-white focus:border-green-500 rounded h-24"
                                            placeholder="他是如何实施犯罪的？使用了什么诡计？"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">作案动机</label>
                                        <textarea
                                            value={deductionDraft.motive}
                                            onChange={(e) => setDeductionDraft({...deductionDraft, motive: e.target.value})}
                                            className="w-full bg-black border border-gray-700 p-3 text-white focus:border-green-500 rounded h-24"
                                            placeholder="他为什么要这么做？"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-4 justify-end items-center">
                                    <button onClick={handleGiveUp} className="bg-red-900/20 hover:bg-red-900/40 text-red-500 px-4 py-2 text-sm border border-red-800 rounded font-bold mr-auto">放弃推理</button>
                                    <button onClick={saveDeductionDraft} className="text-gray-400 hover:text-white px-4 py-2 text-sm">保存草稿</button>
                                    <button onClick={() => setShowDeductionModal(false)} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded font-bold border border-gray-600">取消</button>
                                    <button onClick={submitDeduction} className="bg-green-900 hover:bg-green-800 text-white px-6 py-2 rounded font-bold border border-green-600 shadow-lg hover:shadow-green-900/50">提交报告</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showTruth && (
                        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in">
                            <LockBodyScroll />
                            <div className="relative w-full max-w-4xl h-[80vh] flex flex-col items-center justify-center">
                                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-30 font-sans font-black text-9xl scale-[4] ${getGradeColor(finalGrade)}`} style={{ zIndex: 0 }}>{finalGrade}</div>
                                <div className="bg-gray-900/95 border-2 border-red-600 p-8 rounded-lg shadow-[0_0_50px_rgba(220,38,38,0.3)] relative z-10 w-full max-w-3xl backdrop-blur-sm max-h-[90vh] overflow-y-auto">
                                    <h3 className="text-3xl font-black text-red-500 mb-6 border-b border-red-800 pb-4 text-center tracking-widest uppercase">结案归档</h3>

                                    {evaluation && (
                                        <div className="mb-6 bg-black/50 p-4 rounded border border-gray-700 text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                            <div className="text-yellow-500 font-bold mb-2">侦探评级报告：</div>
                                            {evaluation}
                                        </div>
                                    )}

                                    <div className="space-y-6 text-gray-200">
                                        <div className="bg-red-900/10 border border-red-900/50 p-6 rounded relative overflow-hidden group hover:border-red-500 transition-colors">
                                            <div className="absolute top-0 right-0 w-20 h-20 bg-red-500/10 rounded-bl-full -mr-10 -mt-10"></div>
                                            <span className="text-red-500 text-xs font-bold uppercase tracking-widest block mb-2 border-b border-red-900/30 pb-2">真凶锁定</span>
                                            <p className="text-4xl font-black text-white tracking-tight">{caseData.truth.killer}</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="bg-red-900/10 border border-red-900/50 p-6 rounded relative overflow-hidden hover:border-red-500 transition-colors h-full">
                                                <span className="text-red-500 text-xs font-bold uppercase tracking-widest block mb-3 border-b border-red-900/30 pb-2">作案手法</span>
                                                <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap font-mono">{caseData.truth.method}</p>
                                            </div>
                                            <div className="bg-red-900/10 border border-red-900/50 p-6 rounded relative overflow-hidden hover:border-red-500 transition-colors h-full">
                                                <span className="text-red-500 text-xs font-bold uppercase tracking-widest block mb-3 border-b border-red-900/30 pb-2">作案动机</span>
                                                <p className="text-gray-300 leading-relaxed text-sm whitespace-pre-wrap font-mono">{caseData.truth.motive}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-8 pt-6 border-t border-gray-800">
                                        <button onClick={() => setShowTruth(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded font-bold border border-gray-600 transition-all">离开档案 (结束/回顾)</button>
                                        <button onClick={resetGame} className="flex-1 bg-red-900 hover:bg-red-800 text-white py-3 rounded font-bold shadow-lg shadow-red-900/50 border border-red-700 hover:border-red-500 transition-all">新档案 (重新开始)</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
        </div>
    );
};

export default MainGame;
