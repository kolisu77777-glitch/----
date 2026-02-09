const { useState, useEffect, useRef } = React;
const SERVER_URL = "http://localhost:3000";

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
    const [finalGrade, setFinalGrade] = useState(null);
    const [showDeductionModal, setShowDeductionModal] = useState(false);
    const [evaluation, setEvaluation] = useState('');
    const [deductionDraft, setDeductionDraft] = useState({ killer: '', method: '', motive: '' });

    // Notes & Connections State
    const [notes, setNotes] = useState([]);
    const [foundClues, setFoundClues] = useState([]);
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
    const [canGiveUp, setCanGiveUp] = useState(false);

    // Points System
    const [points, setPoints] = useState(0);
    const isDev = apiKey === 'sk-606bfbb79c9640d78aebabb7c5e596cf';

    // --- Effects ---

    useEffect(() => {
        if (caseData) {
            const timer = setTimeout(() => setCanGiveUp(true), 300000); // 5 minutes
            return () => clearTimeout(timer);
        } else {
            setCanGiveUp(false);
        }
    }, [caseData]);

    useEffect(() => {
        const today = new Date().toDateString();
        const lastLogin = localStorage.getItem('detective_last_login');
        let currentPoints = parseInt(localStorage.getItem('detective_points') || '0');

        if (lastLogin !== today) {
            currentPoints += 50;
            localStorage.setItem('detective_last_login', today);
            localStorage.setItem('detective_points', currentPoints); // Save immediately
            setModal({ title: "每日登录奖励", content: "欢迎回来侦探。\n已发放每日配给：50 积分。" });
        }
        setPoints(currentPoints);
    }, []);

    useEffect(() => {
        localStorage.setItem('detective_points', points);
    }, [points]);

    useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [suspectsState, currentSuspect]);

    // Timer & Events Logic
    useEffect(() => {
        if (!caseData || finalGrade) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                const newTime = Math.max(0, prev - 1);
                const elapsedMinutes = (5400 - newTime) / 60; // Assuming 90 mins total
                const remainingMinutes = newTime / 60;

                // 1. News Events (Y)
                // Probability: Max 50% at 0 mins, linear decrease to 0% at 20 mins.
                // Check every minute (when newTime % 60 === 0)
                if (newTime % 60 === 0 && elapsedMinutes <= 20) {
                    const baseProb = 0.5;
                    const currentProb = Math.max(0, baseProb * (1 - (elapsedMinutes / 20)));

                    if (Math.random() < currentProb) {
                        // Trigger News Event
                        const newsTitles = [
                            "突发新闻：警方在嫌疑人住所附近发现可疑车辆",
                            "最新情报：受害者生前曾收到匿名威胁信",
                            "独家报道：嫌疑人所在的集团股价暴跌",
                            "市民爆料：有人目击案发当晚有黑衣人出入"
                        ];
                        const randomNews = newsTitles[Math.floor(Math.random() * newsTitles.length)];
                        setModal({
                            title: "突发新闻",
                            content: randomNews,
                            type: 'info'
                        });
                        window.SoundManager.playAlert();
                        addNote('text', randomNews); // Add to Detective Notes
                    }
                }

                // 2. Suspect Breakdown / Evidence Destruction (X)
                // Trigger once after 30 mins, 30% chance total.
                // Check once at exactly 30 mins elapsed? Or random time after 30?
                // Let's check every minute after 30 mins if not triggered yet.
                // Small chance per minute to simulate "random time >= 30 mins"
                if (elapsedMinutes >= 30 && !eventsTriggered.breakdown) {
                        // 30% chance to happen in the whole game.
                        // Let's say we check every minute.
                        if (Math.random() < 0.02) { // Small chance per minute
                            setEventsTriggered(prev => ({ ...prev, breakdown: true }));
                            setModal({
                                title: "⚠️ 紧急事态",
                                content: "嫌疑人情绪失控，试图销毁证据！\n\n(已解锁新的搜查区域：【私人保险箱】)",
                                type: 'warning'
                            });
                            window.SoundManager.playAlert();
                            // Add new searchable area if possible (requires backend support or pre-hidden area)
                            // For now, just reveal a hidden clue if any
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
                            title: "⚡️ 上级施压",
                            content: "局长发来最后通牒：\n\n“再给你 5 分钟！如果还破不了案，就等着扣工资吧！”\n\n(结案评分将受到严厉惩罚)",
                            type: 'danger'
                        });
                        window.SoundManager.playAlert();
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
                    // Only decay if 15 seconds have passed since last increase
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
        } catch (e) { setDailyTheme("历史上的今日：神秘事件调查"); } finally { setDailyLoading(false); }
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
                setConnections([]);
                setSearchTimers({});
                setSearchResult(null);
                setDeductionDraft({ killer: '', method: '', motive: '' });
                localStorage.removeItem('detective_deduction_draft');
                setEventsTriggered({ news: [], breakdown: false, urgency: false, interference: false });
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
        window.SoundManager.playTyping();

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
                window.SoundManager.playAlert();

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
                    window.SoundManager.playTone(800, 'triangle', 0.1);
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
                window.SoundManager.playConnectSuccess();

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
                window.SoundManager.playTyping();
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
                    }} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded font-bold text-sm ml-2">确认放弃</button>
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
                        <button onClick={() => { setModal(null); onLogout(); }} className="bg-red-700 hover:bg-red-600 text-white px-4 py-2 rounded font-bold text-sm ml-2">确认断开</button>
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
                // Refund point
                if (!isDev) {
                    setPoints(prev => {
                        const newPoints = prev + 1;
                        localStorage.setItem('detective_points', newPoints); // Force save
                        return newPoints;
                    });
                }
                setConnections(prev => prev.map(c => c.id === connId ? { ...c, verified: true, status: 'correct' } : c));
                window.SoundManager.playConnectSuccess();

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

                setModal({ title: "验证成功", content: `✅ 猜想正确！\n\n${data.reason}\n\n(已生成新的推理节点，积分已返还)` });
            } else {
                setConnections(prev => prev.map(c => c.id === connId ? { ...c, verified: true, status: 'incorrect' } : c));
                window.SoundManager.playAlert();
                setModal({ title: "验证失败", content: `❌ 猜想错误。\n\n${data.reason}\n\n(积分不予返还)`, type: 'danger' });
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
        window.SoundManager.playPageFlip();

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

        // Find HIDDEN clue index in this area
        const foundIndex = caseData.clues.findIndex(c => c.is_hidden && c.location && area.includes(c.location));

        if (foundIndex !== -1) {
            if (!foundClues.includes(foundIndex)) {
                setFoundClues(prev => [...prev, foundIndex]);
                setSearchResult({
                    success: true,
                    title: "发现隐藏线索！",
                    content: `在【${area}】发现了：${caseData.clues[foundIndex].title}`,
                    detail: caseData.clues[foundIndex].content
                });
                window.SoundManager.playConnectSuccess();
            } else {
                 setSearchResult({
                    success: true,
                    title: "再次确认",
                    content: `这里只有【${caseData.clues[foundIndex].title}】，没有其他发现了。`,
                    detail: ""
                });
            }
        } else {
            setSearchResult({
                success: false,
                title: "搜查无果",
                content: `在【${area}】没有发现任何隐藏线索。`,
                detail: ""
            });
            window.SoundManager.playAlert();
        }
        // setTimeLeft(t => Math.max(0, t - 30)); // Removed time deduction
    };

    const getGradeColor = (g) => {
        if (g === 'S') return 'text-red-600';
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
        <div className={`min-h-screen p-0 font-mono relative ${isOverloaded ? 'glitch-mode' : ''}`}>
            <window.MatrixRain />
            {modal && <window.Modal title={modal.title} type={modal.type} actions={modal.actions} onClose={() => setModal(null)}>{modal.content}</window.Modal>}

            {searchResult && (
                <window.Modal
                    title={searchResult.title}
                    type={searchResult.success ? 'success' : 'danger'}
                    onClose={() => setSearchResult(null)}
                    actions={
                        <button
                            onClick={() => setSearchResult(null)}
                            className={`w-full py-3 rounded font-bold ${searchResult.success ? 'bg-green-700 hover:bg-green-600 text-white' : 'bg-red-700 hover:bg-red-600 text-white'}`}
                        >
                            确认
                        </button>
                    }
                >
                    <p className="text-white text-lg mb-2">{searchResult.content}</p>
                    {searchResult.detail && <p className="text-gray-400 text-sm mb-6">{searchResult.detail}</p>}
                </window.Modal>
            )}

            {showGradeReveal && <window.GradeReveal grade={finalGrade} onComplete={() => { setShowGradeReveal(false); setShowTruth(true); }} />}

            {/* Header */}
            <header className="flex justify-between items-start border-b border-green-900 pb-4 bg-black p-6 shadow-[0_4px_20px_rgba(0,255,0,0.05)] w-full">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-white leading-none">DETECTIVE</h1>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-500 leading-none">ARCHIVE</h1>
                    <div className="text-xs text-green-800 font-mono mt-2 flex items-center gap-2 tracking-widest">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        {caseData ? "ACTIVE" : "TRYING TO CONNECT..."}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <div className="text-green-800 font-mono text-sm">{todayDate}</div>
                    <div className="text-green-500 font-bold text-xl">POINTS {points}</div>
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-400 text-xs border border-red-900 px-2 py-1 rounded hover:bg-red-900/20 transition-colors mt-1">断开连接</button>
                </div>
            </header>

            <div className="p-4 md:p-8 max-w-5xl mx-auto">
            {/* Setup Phase */}
            {!caseData && (
                <div className="max-w-2xl mx-auto space-y-8 animate-fade-in mt-8">
                    {/* Custom Case */}
                    <div className="bg-[#1a1a1a] p-8 rounded border border-green-500/30 shadow-[0_0_30px_rgba(0,255,0,0.1)] backdrop-blur relative overflow-hidden paper-texture">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-green-500 to-transparent opacity-50"></div>
                        <h2 className="text-2xl font-bold mb-6 text-green-500 flex items-center gap-2">
                            <span className="animate-pulse">_</span>建立新档案
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-green-700 text-xs mb-2 tracking-widest uppercase">案件题材 / 关键词</label>
                                <input
                                    type="text"
                                    value={theme}
                                    onChange={(e) => setTheme(e.target.value)}
                                    className="w-full bg-black border border-green-800 p-4 text-green-400 focus:border-green-500 focus:outline-none rounded text-lg placeholder-green-900/50 font-mono"
                                    placeholder="输入案件题材..."
                                />
                            </div>
                            <button
                                onClick={generateCase}
                                disabled={loading}
                                className={`w-full py-4 rounded font-bold text-lg tracking-widest transition-all border ${loading ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed' : 'bg-green-900/20 hover:bg-green-900/40 text-green-400 border-green-500 hover:shadow-[0_0_20px_rgba(0,255,0,0.4)]'}`}
                            >
                                {loading ? '系统处理中...' : '初始化案件 [ -10 积分 ]'}
                            </button>
                        </div>
                        {loading && (
                            <div className="mt-6">
                                <div className="flex justify-between text-xs text-green-700 mb-1 font-mono">
                                    <span>数据编译中</span>
                                    <span>{Math.round(progress)}%</span>
                                </div>
                                <div className="w-full h-1 bg-green-900/30 rounded overflow-hidden">
                                    <div className="h-full bg-green-500 shadow-[0_0_10px_rgba(0,255,0,0.8)] transition-all duration-300" style={{width: `${progress}%`}}></div>
                                </div>
                                <div className="mt-2 text-center text-xs text-green-800 font-mono animate-pulse">
                                    构建嫌疑人心理模型... 生成现场指纹... 伪造不在场证明...
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Daily Challenge */}
                    <div className="border border-red-900/30 bg-[#1a1a1a] p-6 rounded relative overflow-hidden group hover:border-red-600/50 transition-all paper-texture">
                        <div className="absolute top-0 right-0 bg-red-900/80 text-red-200 text-[10px] px-2 py-1 font-mono tracking-wider">每日悬赏</div>
                        <h2 className="text-xl font-bold text-red-600 mb-4 flex items-center gap-2">
                            每日悬赏
                        </h2>
                        {dailyLoading ? (
                            <div className="text-red-900 animate-pulse font-mono">解密档案中...</div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-400 italic border-l-2 border-red-900 pl-4 py-2">"{dailyTheme}"</p>
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
                    <div className="flex justify-between items-start mb-4 bg-black/40 p-4 rounded border border-gray-800">
                        <div>
                            <h2 className="text-xl font-black text-red-600 mb-1">{caseData.title}</h2>
                            <div className="text-sm text-gray-400 flex gap-4">
                                <span>受害者: {caseData.victim}</span>
                                <span>死因: {caseData.cause}</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-mono font-bold text-red-500 flicker-text">
                                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                            </div>
                            <div className="text-xs text-gray-400">
                                {timeLeft > 0 && !finalGrade ? (
                                    <span className="text-green-400">剩余时间</span>
                                ) : !finalGrade ? (
                                    <button onClick={handleGiveUp} className="bg-red-900/50 hover:bg-red-800 text-red-200 px-2 py-1 rounded text-xs border border-red-800">放弃推理</button>
                                ) : (
                                    <span className="text-yellow-500 font-bold">案件已归档 ({finalGrade})</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Main Workspace */}
                    <div className="flex-1 flex gap-4 overflow-hidden">
                        {/* Left: Navigation */}
                        <div className="w-16 md:w-48 flex flex-col gap-2">
                            <button onClick={() => setActiveTab('case')} className={`p-3 rounded text-left border transition-all font-bold ${activeTab === 'case' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-black border-gray-800 text-gray-600 hover:bg-gray-900 hover:text-gray-400'}`}>
                                <span className="text-xl block md:inline md:mr-2">📁</span> <span className="hidden md:inline">嫌疑人档案</span>
                            </button>
                            <button onClick={() => setActiveTab('clues')} className={`p-3 rounded text-left border transition-all font-bold ${activeTab === 'clues' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-black border-gray-800 text-gray-600 hover:bg-gray-900 hover:text-gray-400'}`}>
                                <span className="text-xl block md:inline md:mr-2">🔍</span> <span className="hidden md:inline">线索</span>
                            </button>
                            <button onClick={() => setActiveTab('interrogate')} className={`p-3 rounded text-left border transition-all font-bold ${activeTab === 'interrogate' ? 'bg-red-900/30 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : 'bg-black border-gray-800 text-gray-600 hover:bg-gray-900 hover:text-gray-400'}`}>
                                <span className="text-xl block md:inline md:mr-2">💬</span> <span className="hidden md:inline">对话</span>
                            </button>
                            <button onClick={() => setActiveTab('mindmap')} className={`p-3 rounded text-left border transition-all font-bold ${activeTab === 'mindmap' ? 'bg-green-900/30 border-green-500 text-green-400 shadow-[0_0_10px_rgba(34,197,94,0.2)]' : 'bg-black border-gray-800 text-gray-600 hover:bg-gray-900 hover:text-gray-400'}`}>
                                <span className="text-xl block md:inline md:mr-2">🧠</span> <span className="hidden md:inline">侦探笔记</span>
                            </button>
                            <div className="mt-auto space-y-2">
                                {canGiveUp && !finalGrade && (
                                    <button onClick={handleGiveUp} className="w-full p-3 rounded bg-red-900/20 hover:bg-red-900/40 text-red-500 font-bold border border-red-800 hover:border-red-500 transition-all tracking-widest text-sm">
                                        放弃探案
                                    </button>
                                )}
                                <button onClick={() => setShowDeductionModal(true)} className="w-full p-3 rounded bg-green-900 hover:bg-green-800 text-black font-black border border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] transition-all tracking-widest">
                                    <span className="text-xl block md:inline md:mr-2">⚖️</span> <span className="hidden md:inline">结案</span>
                                </button>
                            </div>
                        </div>

                        {/* Center: Content */}
                        <div className="flex-1 bg-black border border-green-900/50 rounded p-4 overflow-y-auto relative shadow-inner">
                            {activeTab === 'case' && caseData && (
                                <div className="space-y-6 animate-fade-in">
                                    <div className="bg-black p-6 rounded border border-green-900/50">
                                        <h3 className="text-lg font-bold text-green-500 mb-4 border-b border-green-900 pb-2 flex items-center gap-2">
                                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                                            嫌疑人档案
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            {caseData.suspects.map((s, i) => (
                                                <div key={i} className="bg-black p-4 rounded border border-gray-800 hover:border-green-500 transition-colors cursor-pointer group" onClick={() => { setCurrentSuspect(s.name); setActiveTab('interrogate'); }}>
                                                    <div className="mb-2">
                                                        <div className="font-bold text-gray-200 text-xl mb-1 group-hover:text-green-400 transition-colors">{s.name}</div>
                                                        <div className="text-xs bg-gray-900 px-2 py-1 rounded text-gray-500 border border-gray-800 inline-block">{s.desc.split(' ')[0]}</div>
                                                    </div>
                                                    <p className="text-sm text-gray-500 mb-2 line-clamp-2">{s.desc}</p>
                                                    <div className="text-xs text-gray-600 bg-gray-900/50 p-2 rounded border border-gray-800/50">
                                                        <span className="block text-gray-500 mb-1 font-bold">主张:</span>
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
                                    <div className="bg-black p-4 border border-green-900/50 rounded">
                                        <h3 className="text-lg font-bold text-green-500 mb-2 border-b border-green-900 pb-2">现场勘查记录</h3>
                                        <div className="space-y-2 text-gray-400 text-sm mb-6 font-mono">
                                            {caseData.scene.map((item, i) => (
                                                <div key={i} className="flex gap-2">
                                                    <span className="text-green-700">[{i+1}]</span>
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>

                                        <h3 className="text-lg font-bold text-green-500 mb-4 border-b border-green-900 pb-2">搜查区域</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {caseData.searchable_areas ? caseData.searchable_areas.map((area, i) => {
                                                const endTime = searchTimers[area];
                                                const isSearching = !!endTime;
                                                const isAnySearching = Object.keys(searchTimers).length > 0;
                                                const progress = isSearching ? Math.min(100, ((Date.now() - (endTime - 30000)) / 30000) * 100) : 0;
                                                // Check if there are any HIDDEN clues in this area that haven't been found
                                                const hasHiddenClues = caseData.clues.some(c => c.is_hidden && c.location && area.includes(c.location) && !foundClues.includes(caseData.clues.indexOf(c)));
                                                const hasSearched = !hasHiddenClues && foundClues.some(idx => caseData.clues[idx].location && area.includes(caseData.clues[idx].location));

                                                return (
                                                    <div key={i} className="relative">
                                                        <button
                                                            onClick={() => startSearch(area)}
                                                            disabled={isAnySearching}
                                                            className={`w-full p-4 rounded border text-left transition-all relative overflow-hidden h-24 flex flex-col justify-center ${hasSearched ? 'bg-green-900/20 border-green-600 text-green-400' : isSearching ? 'bg-yellow-900/20 border-yellow-600 text-yellow-200' : isAnySearching ? 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed opacity-50' : 'bg-black border-gray-700 text-gray-300 hover:border-green-500 hover:text-green-400'}`}
                                                        >
                                                            <div className="relative z-10 flex justify-between items-center w-full">
                                                                <span className="font-bold text-sm md:text-base">{area}</span>
                                                                {hasSearched && <span className="text-green-500 text-xl">✓</span>}
                                                                {isAnySearching && !isSearching && !hasSearched && <span className="text-gray-600 text-xs">🔒 锁定</span>}
                                                            </div>
                                                            {isSearching && (
                                                                <div className="relative z-10 text-xs font-mono mt-2 text-yellow-500 animate-pulse">
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
                                        {/* Show Public Clues Immediately */}
                                        {caseData.clues.map((c, index) => {
                                            if (c.is_hidden && !foundClues.includes(index)) return null; // Hide undiscovered hidden clues

                                            return (
                                                <div key={index} className="bg-black p-4 border border-green-900/30 animate-fade-in hover:border-green-500/50 transition-colors">
                                                    <h4 className="font-bold text-green-400 flex items-center">
                                                        {c.title}
                                                        {c.is_hidden && <span className="text-[10px] bg-red-900/50 text-red-200 px-2 py-0.5 rounded ml-2 border border-red-800">HIDDEN</span>}
                                                        <span className="text-xs text-gray-600 font-normal ml-auto font-mono">LOCATION: {c.location || '现场'}</span>
                                                    </h4>
                                                    <p className="text-gray-400 mt-2 text-sm">{c.content}</p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'interrogate' && (
                                <div className="h-full flex flex-col animate-fade-in">
                                    <div className="flex gap-2 mb-4 overflow-x-auto pb-2 border-b border-gray-800">
                                        {caseData.suspects.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => setCurrentSuspect(s.name)}
                                                className={`px-4 py-2 rounded whitespace-nowrap border transition-all font-bold ${currentSuspect === s.name ? 'bg-red-900/50 border-red-500 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.3)]' : 'bg-black border-gray-800 text-gray-500 hover:bg-gray-900 hover:text-gray-300'}`}
                                            >
                                                {s.name}
                                            </button>
                                        ))}
                                    </div>

                                    <div className="flex-1 flex flex-col">
                                        {currentSuspect ? (
                                            <React.Fragment>
                                                <div className="mb-2">
                                                    <window.HeartRateMonitor stress={suspectsState[currentSuspect]?.stress || 0} />
                                                </div>
                                                <div className="flex-1 relative mb-4 bg-black border border-green-900/30 rounded overflow-hidden shadow-inner">
                                                    <div className={`absolute inset-0 overflow-y-auto p-4 space-y-4 ${Date.now() < (suspectsState[currentSuspect]?.lockedUntil || 0) ? 'overflow-hidden pointer-events-none filter blur-sm' : ''}`}>
                                                        {suspectsState[currentSuspect]?.history.length === 0 && (
                                                            <div className="text-center text-green-900 text-sm mt-10 font-mono animate-pulse">
                                                                &gt; ESTABLISHING NEURAL LINK WITH {currentSuspect}...
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
                                                                <div className="text-5xl mb-2 drop-shadow-[0_0_10px_rgba(220,38,38,0.8)]">🔒</div>
                                                                <h3 className="text-red-500 font-bold text-xl mb-2 tracking-widest">NEURAL LOCK</h3>
                                                                <p className="text-red-400 text-xs mt-2 font-mono">
                                                                    {Math.ceil((suspectsState[currentSuspect].lockedUntil - Date.now()) / 1000 / 60)} MIN REMAINING
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
                                                        className="flex-1 bg-black border border-green-900 p-3 text-green-400 focus:border-green-500 focus:outline-none rounded font-mono placeholder-green-900"
                                                        disabled={Date.now() < (suspectsState[currentSuspect]?.lockedUntil || 0)}
                                                    />
                                                    <button onClick={() => askQuestion()} className="bg-red-900/20 hover:bg-red-900/40 text-red-500 px-6 rounded font-bold border border-red-800 hover:border-red-500 transition-all" disabled={Date.now() < (suspectsState[currentSuspect]?.lockedUntil || 0)}>SEND</button>
                                                </div>
                                            </React.Fragment>
                                        ) : (
                                            <div className="flex-1 flex items-center justify-center text-green-900 font-mono animate-pulse">
                                                &lt; SELECT TARGET TO INTERROGATE &gt;
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'mindmap' && (
                                <div className="h-full flex gap-4 animate-fade-in">
                                    <div className="w-48 bg-black border-r border-green-900 p-2 overflow-y-auto">
                                        <h4 className="text-xs text-green-700 uppercase mb-2 font-bold tracking-widest">EVIDENCE_POOL</h4>
                                        <div className="space-y-2">
                                            {caseData.suspects.map((s, i) => (
                                                <button key={`s-${i}`} onClick={() => addNote('suspect', s.name)} className="block w-full text-left bg-black text-gray-400 text-xs p-2 rounded border border-gray-800 hover:border-green-500 hover:text-green-400 truncate transition-colors">👤 {s.name}</button>
                                            ))}
                                            {caseData.clues.map((c, i) => (
                                                <button key={`c-${i}`} onClick={() => addNote('clue', c.title)} className={`block w-full text-left bg-black text-gray-400 text-xs p-2 rounded border border-gray-800 hover:border-green-500 hover:text-green-400 truncate transition-colors ${c.is_hidden && !foundClues.includes(i) ? 'hidden' : ''}`}>🔍 {c.title}</button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex-1 relative bg-black overflow-hidden rounded border border-green-900/50 cursor-crosshair"
                                         ref={canvasRef}
                                         onMouseMove={handleMouseMove}
                                         onMouseUp={handleMouseUp}
                                         onMouseLeave={handleMouseUp}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none" style={{backgroundImage: 'radial-gradient(#22c55e 1px, transparent 1px)', backgroundSize: '20px 20px'}}></div>
                                        <div className="absolute top-2 right-2 text-xs text-green-900 pointer-events-none select-none font-mono">
                                            SHIFT+DRAG: LINK | DRAG: MOVE | DBL_CLICK: DELETE
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
                                                        <line x1={from.x + 75} y1={from.y + 40} x2={to.x + 75} y2={to.y + 40} stroke={c.status === 'correct' ? "#22c55e" : c.status === 'incorrect' ? "#ef4444" : "#22c55e"} strokeWidth="1" strokeDasharray={c.status === 'correct' ? "" : "5,5"} opacity="0.5" />
                                                        {!c.verified && (
                                                            <foreignObject x={midX - 30} y={midY - 15} width="60" height="30">
                                                                <button onClick={() => verifyConnection(c.id)} className="bg-black text-green-500 text-[10px] px-2 py-1 rounded border border-green-800 hover:bg-green-900/30 w-full shadow-lg font-mono">
                                                                    VERIFY?
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
                                                className={`absolute w-[150px] p-2 rounded border shadow-[0_0_15px_rgba(0,0,0,0.5)] cursor-move select-none transition-all ${note.type === 'suspect' ? 'bg-black border-red-900 text-red-400' : note.type === 'clue' ? 'bg-black border-green-900 text-green-400' : note.type === 'deduction' ? 'bg-green-900/20 border-green-500 text-green-300 font-bold' : 'bg-gray-800 border-gray-600 text-gray-200'} ${note.verified ? 'ring-1 ring-green-500 shadow-[0_0_10px_rgba(34,197,94,0.3)]' : ''}`}
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
                            <div className="bg-gray-900 border-2 border-green-600 p-8 rounded-lg max-w-2xl w-full shadow-[0_0_50px_rgba(0,255,0,0.1)]">
                                <h3 className="text-2xl font-black text-green-500 mb-6 border-b border-green-800 pb-4">提交结案报告</h3>
                                <div className="space-y-4 mb-8">
                                    <div>
                                        <label className="block text-gray-400 text-sm mb-2">认定的真凶</label>
                                        <select
                                            value={deductionDraft.killer}
                                            onChange={(e) => setDeductionDraft({...deductionDraft, killer: e.target.value})}
                                            className="w-full bg-black border border-gray-700 p-3 text-white focus:border-green-500 rounded"
                                        >
                                            <option value="">选择嫌疑人...</option>
                                            {caseData.suspects.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                                        </select>
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
                                <div className="flex gap-4 justify-end">
                                    <button onClick={saveDeductionDraft} className="text-gray-400 hover:text-white px-4 py-2 text-sm">保存草稿</button>
                                    <button onClick={() => setShowDeductionModal(false)} className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-2 rounded font-bold border border-gray-600">取消</button>
                                    <button onClick={submitDeduction} className="bg-green-900 hover:bg-green-800 text-white px-6 py-2 rounded font-bold border border-green-600 shadow-lg hover:shadow-green-900/50">提交报告</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {showTruth && (
                        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 animate-fade-in">
                            <window.LockBodyScroll />
                            <div className="relative w-full max-w-4xl h-[80vh] flex flex-col items-center justify-center">
                                <div className={`absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-30 font-sans font-black text-9xl scale-[4] ${getGradeColor(finalGrade)}`} style={{ zIndex: 0 }}>{finalGrade}</div>
                                <div className="bg-gray-900/95 border-2 border-red-600 p-8 rounded-lg shadow-2xl relative z-10 w-full max-w-2xl backdrop-blur-sm max-h-[90vh] overflow-y-auto">
                                    <h3 className="text-3xl font-black text-red-500 mb-6 border-b border-red-800 pb-4 text-center">案件真相 (CASE CLOSED)</h3>

                                    {evaluation && (
                                        <div className="mb-6 bg-black/50 p-4 rounded border border-gray-700 text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                            <div className="text-yellow-500 font-bold mb-2">侦探评级报告：</div>
                                            {evaluation}
                                        </div>
                                    )}

                                    <div className="space-y-6 text-gray-200">
                                        <div><span className="text-red-400 text-xs uppercase tracking-widest block mb-1">真凶</span><p className="text-2xl font-bold">{caseData.truth.killer}</p></div>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div><span className="text-red-400 text-xs uppercase tracking-widest block mb-1">手法</span><p className="text-gray-300 leading-relaxed text-sm">{caseData.truth.method}</p></div>
                                            <div><span className="text-red-400 text-xs uppercase tracking-widest block mb-1">动机</span><p className="text-gray-300 leading-relaxed text-sm">{caseData.truth.motive}</p></div>
                                        </div>
                                    </div>
                                    <div className="flex gap-4 mt-8">
                                        <button onClick={() => setShowTruth(false)} className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 rounded font-bold border border-gray-600">离开档案 (结束/回顾)</button>
                                        <button onClick={resetGame} className="flex-1 bg-red-800 hover:bg-red-700 text-white py-3 rounded font-bold shadow-lg shadow-red-900/50">新档案 (重新开始)</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

window.MainGame = MainGame;