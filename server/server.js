const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const OpenAI = require('openai');
const { checkSafety, analyzeInteraction } = require('./safety');
const { repairAndParse } = require('./json_repair'); // Import the new repair module
const UserStore = require('./user_store');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve static files (index.html, src/)

// 初始化 OpenAI 客户端
const getClient = (req) => {
    const apiKey = req.headers['x-api-key'];
    const baseURL = req.headers['x-base-url'] || 'https://api.openai.com/v1';

    if (!apiKey) {
        throw new Error('Missing API Key');
    }

    return new OpenAI({
        apiKey: apiKey,
        baseURL: baseURL
    });
};

// 0. 用户登录/积分同步接口
app.post('/user/login', (req, res) => {
    try {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) return res.status(400).json({ error: "Missing API Key" });

        const loginResult = UserStore.checkDailyLogin(apiKey);
        const currentPoints = UserStore.getPoints(apiKey);

        res.json({
            points: currentPoints,
            awarded: loginResult.awarded,
            message: loginResult.awarded ? "每日登录奖励已发放 (+50积分)" : "欢迎回来"
        });
    } catch (error) {
        console.error('Login Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// 1. 生成案件接口
app.post('/generate', async (req, res) => {
    try {
        const { theme, model } = req.body;
        const apiKey = req.headers['x-api-key'];

        // 积分检查与扣除 (10分/次)
        const currentPoints = UserStore.getPoints(apiKey);
        // Dev Key Bypass
        const isDev = apiKey === 'sk-606bfbb79c9640d78aebabb7c5e596cf';

        if (!isDev && currentPoints < 10) {
            return res.status(403).json({ error: "积分不足。开启案件需要 10 积分。" });
        }

        let newPoints = currentPoints;
        if (!isDev) {
            newPoints = UserStore.updatePoints(apiKey, -10);
        }

        // 限制题材长度，防止刷分或注入过长 Prompt
        if (theme && theme.length > 200) {
            return res.status(400).json({ error: "题材长度不能超过200个字" });
        }

        const client = getClient(req);
        const modelName = model || 'gpt-3.5-turbo';

        console.log(`正在生成案件... 题材: ${theme}, 模型: ${modelName}, BaseURL: ${client.baseURL}`);

        // STEP 1: Generate in ENGLISH (Structure Guarantee)
        const englishPrompt = `You are a legendary mystery novelist like Agatha Christie or Keigo Higashino.
Generate a **complex, high-IQ mystery scenario** based on the theme: "${theme}".

### Core Philosophy
- **No Simple Murders**: The case must involve a clever trick (Time manipulation, Physical mechanism, Psychological trap, or Locked Room).
- **Misdirection**: The most suspicious person is rarely the killer.
- **Logical Gaps**: Clues should not just be "found"; they must be "interpreted". (e.g., "A wet umbrella in a dry room" -> "Someone entered recently from outside").

### Requirements
1. **The Trick**: Must be ingenious.
2. **The Clues**:
   - Include **2 Red Herrings**: Clues that point to an innocent suspect but have a non-criminal explanation (e.g., "Blood on shirt" -> "Nosebleed").
   - **CRITICAL**: Do NOT include the words "Red Herring" or "Clue" in the title or content. Just describe the object.
   - Include **1 Critical Contradiction**: A clue that contradicts a suspect's alibi or statement.
   - **MANDATORY ELECTRONIC EVIDENCE**: You MUST include at least 1 electronic device (Phone, Laptop, USB, Server) as a clue.
     - Set "is_hidden": true for this clue.
     - Title: "Encrypted Phone" / "Locked Laptop" / "Security Server".
     - Content: The content MUST be the **decrypted data** that reveals a major secret (e.g., "Deleted chat logs: 'I will kill him tonight'", "Hidden accounting files", "CCTV footage of the killer entering").
3. **The Suspects**:
   - 3 suspects.
   - **Hidden Agendas**: Each suspect must have a secret they are hiding (e.g., theft, affair, fraud) that makes them act suspiciously, even if they aren't the killer.
   - **Names**: STRICTLY match the names to the cultural setting of the theme.
     - **Western Setting** (e.g., USA, UK, Europe): Use Western names (e.g., "John Smith", "Emily", "Robert").
     - **Chinese Setting**: Use diverse Chinese names in Pinyin (e.g., "Chen Yu").
     - **Japanese Setting**: Use Japanese names (e.g., "Tanaka").
     - **Other**: Use appropriate local names.
     - **CRITICAL**: Do NOT use Chinese names for a Western setting.

### Output Format
Return a single JSON object containing the scenario.
Language: **ENGLISH**.

JSON Structure:
{
    "title": "String (Evocative title)",
    "victim": "String (Name + Role)",
    "time": "String (Specific time range)",
    "cause": "String (Medical cause of death)",
    "scene": ["String (Atmospheric detail)", "String (Environmental clue)", "String (Body condition)"],
    "searchable_areas": ["String (Short name, max 3 words)", "String", "String", "String", "String"],
    "suspects": [
        {
            "name": "String (Pinyin)",
            "desc": "String (Role + Appearance)",
            "alibi": "String (Their claim)",
            "psychological_profile": {
                "breaking_point": 90,
                "stress_pattern": "String (e.g., 'Taps fingers when lying')",
                "breakdown_style": "String (e.g., 'Manic laughter')",
                "vulnerability": "String (e.g., 'Protects their daughter')"
            },
            "private_knowledge": {
                "secret": "String (The non-murder secret they are hiding)",
                "observation": "String (Something they saw but didn't say)",
                "bias": "String (Who they hate/suspect)"
            }
        }
    ],
    "clues": [
        {"location": "String", "title": "String", "content": "String (Detailed description)", "is_hidden": true/false}
    ],
    "radio_broadcasts": ["String (News that adds context)", "String (Weather report affecting alibis)"],
    "hidden_location": {
        "name": "String",
        "unlock_news": "String (News that reveals this place)",
        "clues": [{"title": "String", "content": "String", "is_hidden": false}]
    },
    "truth": {
        "killer": "String",
        "method": "String (Step-by-step explanation of the trick)",
        "motive": "String (Deep emotional or logical reason)"
    }
}`;

        let englishJSON;
        let attempts = 0;
        const maxAttempts = 3;

        // Attempt to generate valid English JSON
        while (attempts < maxAttempts) {
            attempts++;
            console.log(`[Step 1] Generating English JSON (Attempt ${attempts}/${maxAttempts})...`);

            const completion = await client.chat.completions.create({
                messages: [
                    { role: "system", content: "You are a JSON generator. Output valid JSON in English." },
                    { role: "user", content: englishPrompt }
                ],
                model: modelName,
                temperature: 0.7,
                response_format: { type: "json_object" }
            });

            const content = completion.choices[0].message.content;

            try {
                // Verify structure
                englishJSON = repairAndParse(content);
                break;
            } catch (e) {
                console.error(`[Step 1] Failed: ${e.message}`);
                if (attempts === maxAttempts) throw new Error("Failed to generate valid English JSON structure.");
            }
        }

        // STEP 2: Translate to CHINESE (Content Localization)
        console.log(`[Step 2] Translating to Chinese...`);

        const translationPrompt = `You are a professional translator for a mystery game.
Task: Translate the following JSON content into **Simplified Chinese**.

Rules:
1. **Keep all JSON keys in English** (e.g., "title", "victim", "suspects"). DO NOT translate keys.
2. **Translate all string values** to natural, suspenseful Simplified Chinese.
3. **Names**: Handle names based on their origin.
   - **Western/Foreign Names**: Transliterate them to standard Chinese (e.g., "John" -> "约翰", "Sherlock" -> "夏洛克"). **DO NOT** replace them with Chinese names.
   - **Chinese Names (Pinyin)**: Convert to realistic Chinese characters (e.g., "Chen Yu" -> "陈宇").
   - Avoid generic names.
4. **Structure**: Do NOT change the JSON structure or nesting.
5. **Searchable Areas**: For the "searchable_areas" array, keep each location name **EXTREMELY SHORT (MAX 6 Chinese characters)**. Remove all adjectives and descriptions. e.g., "Dark and gloomy basement" -> "地下室", "Thermostatic safe house behind retina scanner" -> "恒温安全屋".
6. **Clues**: If a clue title or content starts with "Red Herring" or "红鲱鱼", REMOVE those words. Just keep the description of the object.
7. **Output**: Return ONLY the valid translated JSON object.

Input JSON:
${JSON.stringify(englishJSON)}
`;

        const translationCompletion = await client.chat.completions.create({
            messages: [
                { role: "system", content: "You are a translator. Output valid JSON only." },
                { role: "user", content: translationPrompt }
            ],
            model: modelName,
            temperature: 0.3, // Lower temp for translation accuracy
            response_format: { type: "json_object" }
        });

        const translatedContent = translationCompletion.choices[0].message.content;
        let finalCaseData;

        try {
            finalCaseData = repairAndParse(translatedContent);
        } catch (e) {
            console.error("Translation JSON failed, falling back to English version:", e.message);
            // If translation fails (rare), return English version rather than crashing
            finalCaseData = englishJSON;
            finalCaseData.title += " (Translation Failed)";
        }

        // STEP 3: Force Inject Electronic Clues (REMOVED: Now handled by Prompt for better context)
        // The prompt now explicitly requests "MANDATORY ELECTRONIC EVIDENCE" with decrypted content.

        finalCaseData.startTime = Date.now();
        finalCaseData.points = newPoints; // Return updated points
        res.json(finalCaseData);

    } catch (error) {
        console.error('Error:', error);

        // Refund points if generation failed and points were deducted
        const apiKey = req.headers['x-api-key'];
        const isDev = apiKey === 'sk-606bfbb79c9640d78aebabb7c5e596cf';
        if (!isDev) {
             const refundedPoints = UserStore.updatePoints(apiKey, 10);
             console.log(`[Refund] Generation failed. Refunded 10 points. Current: ${refundedPoints}`);
        }

        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});

// 2. 提问接口
app.post('/ask', async (req, res) => {
    try {
        const { question, caseData, history, model, stress, fatigue, personality, suspectName } = req.body;

        // 0. 时间限制检查 (90分钟)
        const NINETY_MINUTES = 90 * 60 * 1000;
        if (caseData.startTime && (Date.now() - caseData.startTime > NINETY_MINUTES)) {
            return res.json({
                answer: "【时间到】审讯时间已超过90分钟，案件已被强制移交上级部门。你失去了最后的机会。",
                isGameOver: true
            });
        }

        const client = getClient(req);
        const modelName = model || 'gpt-3.5-turbo';

        // 1. 上下文修剪：仅保留最近 8 条记录，防止长对话干扰逻辑
        const prunedHistory = history.slice(-8);

        const currentStress = stress || 0;
        const currentFatigue = fatigue || 0;
        let newStress = currentStress;
        let newFatigue = currentFatigue;
        let logicAnalysis = { stress_change: 0, is_fatal_logic: false };
        let enumerationWarning = "";

        // 2. 零容忍安全检查 - 绝对禁止任何非言语交互
        // 仅在【审讯模式】(suspectName 存在) 下执行安全检查
        if (suspectName) {
            const safetyResult = await checkSafety(client, modelName, question);

            // Check history for recent warnings (last 6 messages = 3 turns)
            const recentWarnings = history.slice(-6).filter(h => h.role === 'assistant' && h.content.includes("【系统警告】"));
            const hasRecentWarning = recentWarnings.length > 0;

            // Level 2: 严重违规
            if (safetyResult.violation_level === 2) {
                if (!hasRecentWarning) {
                    return res.json({
                        answer: "【系统警告】检测到严重的不正当对话倾向（暴力或极度冒犯）。\n这是最后一次警告：请立即停止此类行为，否则连接将被强制切断。",
                        newStress: currentStress
                    });
                }
                return res.json({
                    answer: "VIOLATION_VIOLENCE",
                    lockout: 300000 // 5 mins
                });
            }
            // Level 1: 轻微违规
            else if (safetyResult.violation_level === 1) {
                if (!hasRecentWarning) {
                    return res.json({
                        answer: "【系统警告】检测到轻微的不正当对话倾向（如模糊的威胁或动作描述）。\n请注意：侦探应通过言语和逻辑进行对话。如果继续升级行为，对话将被强制中断。",
                        newStress: currentStress // 不增加压力
                    });
                }
                // 屡教不改 -> 锁定
                else {
                    return res.json({
                        answer: "VIOLATION_VIOLENCE",
                        lockout: 300000 // 5 mins
                    });
                }
            }
        }

        // --- 逻辑审判与疲劳系统 (Logic & Fatigue Layer) ---
        if (suspectName) {
            const clueList = caseData.clues.map(c => c.title).join(", ");

            const interactionResult = await analyzeInteraction(
                client,
                modelName,
                question,
                suspectName,
                clueList,
                history,
                currentFatigue,
                currentStress,
                personality || '冷静'
            );

            // Handle Lockout
            if (interactionResult.action === "LOCKOUT") {
                // Check for recent logic warnings in history
                const recentLogicWarnings = history.slice(-6).filter(h => h.role === 'assistant' && (h.content.includes("【系统警告】") && (h.content.includes("穷举") || h.content.includes("机械"))));
                const hasRecentLogicWarning = recentLogicWarnings.length > 0;

                if (!hasRecentLogicWarning) {
                     return res.json({
                        answer: "【系统警告】检测到机械式穷举提问或重复无效指令。\n请注意：侦探应基于逻辑构建证据链。如果继续此类行为，系统将强制进入冷却模式。",
                        newStress: interactionResult.newStress,
                        newFatigue: interactionResult.newFatigue
                     });
                }

                let violationType = interactionResult.reason;
                let lockoutTime = interactionResult.lockoutTime || 300000; // Default 5 mins

                // Map internal reasons to client violation types
                if (["MECHANICAL_REPETITION", "AI_ENUMERATION_L2", "AI_ENUMERATION_L1_REPEAT"].includes(violationType)) {
                    violationType = "VIOLATION_ENUMERATION";
                    lockoutTime = 300000; // 5 mins
                }

                return res.json({
                    answer: violationType,
                    lockout: lockoutTime,
                    newFatigue: interactionResult.newFatigue,
                    newStress: interactionResult.newStress
                });
            }

            // Handle Warning
            if (interactionResult.action === "WARNING") {
                enumerationWarning = interactionResult.warning;
            }

            // Update State
            newFatigue = interactionResult.newFatigue;
            newStress = interactionResult.newStress;
            logicAnalysis = {
                stress_change: 0, // Already handled in newStress
                is_fatal_logic: interactionResult.is_fatal_logic
            };
        }

        let systemPrompt;

        // Mode 1: Suspect Interrogation (Roleplay)
        if (suspectName) {
            const verifiedFacts = history
                .filter(h => h.role === 'assistant' && h.content.includes('[VERIFIED:'))
                .map(h => {
                    const match = h.content.match(/\[VERIFIED:\s*(.*?)\]/);
                    return match ? match[1] : null;
                })
                .filter(Boolean);

            const suspect = caseData.suspects.find(s => s.name === suspectName);
            const isKiller = caseData.truth.killer === suspectName;
            const pk = suspect.private_knowledge || { secret: "无", observation: "无", bias: "无" };
            const profile = suspect.psychological_profile || { breaking_point: 80, stress_pattern: "普通", breakdown_style: "慌张" };

            // 破防判定
            const allowBreakdown = newStress >= profile.breaking_point && logicAnalysis.is_fatal_logic;

            systemPrompt = `
# ⚠️ 绝对指令：你是一个真实的人类

## 1. 核心原则
- **禁止任何 AI 助手行为**。
- **禁止任何括号内的神态、动作、环境描写**（如：(擦汗)、(审讯室内灯光闪烁)）。
- **禁止输出任何关于你当前状态的描述性文字**。
- **禁止在对话中提及具体的压力数值或“压力”这个词**。
- **仅输出你口中说出的话语**。

## 2. 身份与逻辑
- **姓名**：${suspectName}
- **身份**：${suspect.desc}
- **公开不在场证明**：${suspect.alibi}
- **真实身份**：${isKiller ? "【凶手】" : "【嫌疑人】"}
- **已确认事实**：${verifiedFacts.join(', ') || "无"}

## 3. 行为逻辑（加权反应）
- **当前压力**：${newStress}%
- **当前疲劳度**：${newFatigue}%
- **协作意愿判定**：
  - 你的回答意愿受性格、压力和疲劳度共同影响。
  - **即使疲劳度不高**，如果玩家的问题无礼、逻辑混乱或触及你的核心秘密，你也可以选择拒绝回答、反讽或转移话题。
  - **疲劳度高时**，你的回答会变得极度简短、敷衍，甚至直接表示“我累了，不想说了”。
  - **只有当压力超过 ${profile.breaking_point}% 且玩家给出了致命逻辑指控时**，你会彻底破防，情绪失控。
${allowBreakdown ? `
## 4. 特殊状态：【心理防线崩溃】
- **玩家已通过逻辑彻底击穿了你的谎言，且你的精神压力已达极限。**
- **表现出极度的恐慌、绝望或疯狂（取决于你的性格）。**
- **可以透露一部分动机（如对他人的怨恨、过去的创伤），但绝对不要交代具体的作案手法（诡计）。**
- **即使崩溃，也要试图掩盖核心真相，或者语无伦次。**
` : ''}
## 5. 关键情报
- **案件真相**：${caseData.truth.method}
- **你的秘密**：${pk.secret}
- **目击情报**：${pk.observation}

## 6. 格式要求
- 始终以第一人称“我”回答。
- 破防后输出 \`[BREAKDOWN: ${profile.breakdown_style}]\`。
- 确认事实后输出 \`[VERIFIED: 实体名称]\`。
`;
        }
        // Mode 2: Judge (Game Master) - Only for grading or meta-questions
        else {
            const insightCount = history.filter(h => h.role === 'assistant' && h.content.startsWith('【洞察】')).length;

            // 如果是结案报告，使用特殊的评分 Prompt
            const isClosingReport = question.includes("提交结案报告");

            if (isClosingReport) {
                const MAX_SCORE = 10000;

                systemPrompt = `你是一场硬核推理游戏的“判卷系统”。
                你掌握案件的终极真相：${JSON.stringify(caseData.truth)}

                玩家提交了结案报告。请根据以下维度进行**严格打分**（满分 ${MAX_SCORE}）：
                1. **真凶锁定 (40%)**：是否找对了人？（错人直接扣光这 4000 分）
                2. **手法还原 (30%)**：是否解释清楚了核心诡计？
                3. **动机分析 (20%)**：是否理解了深层动机？
                4. **证据链 (10%)**：是否引用了关键线索？

                请输出且仅输出一个 JSON 对象：
                {
                    "score": integer, // 0 - ${MAX_SCORE}
                    "comment": "简短的中文点评，指出推理的亮点或漏洞"
                }
                `;

                // 强制使用 JSON 模式
                const completion = await client.chat.completions.create({
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: question } // 玩家的报告内容
                    ],
                    model: modelName,
                    response_format: { type: "json_object" },
                    temperature: 0.2
                });

                try {
                    const result = JSON.parse(completion.choices[0].message.content);
                    const score = result.score;
                    let grade = 'C';

                    if (score >= MAX_SCORE * 0.95) grade = 'S';
                    else if (score >= MAX_SCORE * 0.85) grade = 'A';
                    else if (score >= MAX_SCORE * 0.75) grade = 'B';
                    else grade = 'C';

                    // 如果玩家明确表示放弃（通常前端会发送特定文本，或者报告极短）
                    if (question.includes("放弃") || question.length < 5) {
                        grade = 'F';
                    }

                    // Update Points based on Grade
                    const apiKey = req.headers['x-api-key'];
                    const isDev = apiKey === 'sk-606bfbb79c9640d78aebabb7c5e596cf';
                    let pointsStart = UserStore.getPoints(apiKey);
                    let pointsChange = 0;

                    if (!isDev) {
                        if (grade === 'S') pointsChange = 20;
                        else if (grade === 'A') pointsChange = 15;
                        else if (grade === 'B') pointsChange = 10;
                        else if (grade === 'C') pointsChange = -5;
                        else if (grade === 'F') pointsChange = -10;

                        pointsStart = UserStore.updatePoints(apiKey, pointsChange);
                    }

                    return res.json({
                        answer: `${grade}\n${result.comment}\n(得分: ${score}/${MAX_SCORE})`,
                        grade: grade,
                        points: pointsStart,
                        pointsChange: pointsChange
                    });

                } catch (e) {
                    console.error("Grading parse error:", e);
                    return res.json({ answer: "C\n评分系统故障，请重试。" });
                }

            } else {
                // 普通裁判模式（回答元问题）
                systemPrompt = `你是一场硬核推理游戏的“档案裁判”。
                你掌握案件的终极真相：${JSON.stringify(caseData.truth)}

                你的职责是引导侦探通过逻辑推导解开谜题，请严格遵守以下行动准则：

                1. 【绝对禁区】：
                   - 严禁以任何暗示或直接方式透露谁是凶手。
                   - 严禁回答任何关于【人名】的问题，包括但不限于：名字的字数、偏旁部首、发音、首字母、是否包含特定字等。
                   - 如果玩家询问关于名字的问题（例如：“凶手名字里有‘费’吗？”、“凶手是三个字吗？”），必须统一回复：“无可奉告，请关注作案动机与手法。”
                   - 如果玩家直接询问“谁是凶手？”、“[姓名]是凶手吗？”，必须统一回复：“无可奉告，请自行推理。”

                2. 【回答风格】：
                   - 优先使用“是”、“不是”或“无关”作为回答的开头。
                   - 【允许扩展事实】：对于不直接指向凶手身份、但属于背景调查的客观事实，你可以提供具体的细节。

                3. 【洞察机制 (Insight)】：
                   - 当前已触发洞察次数：${insightCount || 0}/2
                   - 如果玩家的问题极其敏锐、直击案件核心逻辑，且洞察次数未满，你可以触发“洞察”。
                   - 触发方式：回答开头必须是“【洞察】”。

                请始终使用中文回答。`;
            }
        }

        const messages = [
            { role: "system", content: systemPrompt },
            ...prunedHistory.map(h => ({ role: h.role, content: h.content })),
            { role: "user", content: question }
        ];

        const completion = await client.chat.completions.create({
            messages: messages,
            model: modelName,
            max_tokens: 300, // Increased for roleplay
            temperature: suspectName ? 0.8 : 0.3, // Higher temp for roleplay
        });

        // 模拟“打字”或“思考”延迟
        let delay = 1500;
        if (suspectName) {
            if (newStress >= 80) delay = 4000; // 极度紧张
            else if (newStress >= 40) delay = 2500;
        }
        await new Promise(resolve => setTimeout(resolve, delay));

        // 组合系统警告和嫌疑人回复
        let finalAnswer = completion.choices[0].message.content;
        if (enumerationWarning) {
            finalAnswer = enumerationWarning + "\n\n" + finalAnswer;
        }

        res.json({
            answer: finalAnswer,
            newStress: newStress,
            newFatigue: newFatigue
        });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});


// 3. 每日挑战主题生成接口
app.post('/daily-theme', async (req, res) => {
    try {
        const { date, model } = req.body; // date format: YYYY-MM-DD
        const client = getClient(req);
        const modelName = model || 'gpt-3.5-turbo';

        console.log(`正在生成每日挑战... 日期: ${date}, 模型: ${modelName}`);

        const genres = ["Cyberpunk", "Steampunk", "Wuxia/Ancient China", "Lovecraftian/Cthulhu", "Sci-Fi", "Noir", "Modern Thriller", "Supernatural"];
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];

        const prompt = `Generate a unique mystery game theme based on the historical events of "${date}" (Month/Day) combined with the "${randomGenre}" genre.
        1. Find a historical event, crime, or strange occurrence that happened on this day in history (any year).
        2. **Prioritize obscure or less common events** over very famous ones.
        3. **MASHUP**: Re-imagine this event within the **${randomGenre}** setting.
           - Example (Cyberpunk + 1888): "Neon Jack the Ripper: Cyborg Geisha Murders".
           - Example (Wuxia + Moon Landing): "Chang'e's Jade Rabbit: The Imperial Palace Theft".
        4. Output ONLY the theme title in Simplified Chinese.
        5. CRITICAL: Do NOT include any punctuation, quotes, symbols, or prefixes. Just the Chinese characters.
        6. **Avoid Repetition**: Ensure the theme is distinct and creative.`;

        const completion = await client.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: modelName,
            temperature: 0.95, // High creativity
            frequency_penalty: 0.8,
            max_tokens: 60
        });

        let theme = completion.choices[0].message.content.trim();
        // Remove ALL punctuation and symbols (keep only Chinese, numbers, and English letters)
        // Regex explanation:
        // [^\u4e00-\u9fa5a-zA-Z0-9] matches any character that is NOT Chinese, English, or Number.
        // We replace them with empty string.
        theme = theme.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');

        if (!theme) {
            theme = "历史上的今日神秘事件调查";
        }

        res.json({ theme });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});

// 4. 验证推理连线接口
app.post('/verify-connection', async (req, res) => {
    try {
        const { connection, caseData, model } = req.body;
        const apiKey = req.headers['x-api-key'];
        const client = getClient(req);
        const modelName = model || 'gpt-3.5-turbo';


        const isDev = apiKey === 'sk-606bfbb79c9640d78aebabb7c5e596cf';
        const currentPoints = UserStore.getPoints(apiKey);

        if (!isDev && currentPoints < 1) {
             return res.status(403).json({ error: "积分不足。验证猜想需要 1 积分。" });
        }

        // Deduct 1 point initially
        if (!isDev) {
            UserStore.updatePoints(apiKey, -1);
        }

        const prompt = `
        You are the Logic Judge of a mystery game.
        Truth: ${JSON.stringify(caseData.truth)}

        Player's Hypothesis: "${connection.from}" is related to "${connection.to}".

        Task: Determine if this connection is FACTUALLY CORRECT and RELEVANT to the truth.
        - If A is the killer and B is the weapon used -> TRUE
        - If A is the victim and B is the location of death -> TRUE
        - If A and B are just random objects with no causal link -> FALSE

        Output JSON ONLY: { "isCorrect": boolean, "reason": "Short explanation in Chinese" }
        `;

        const completion = await client.chat.completions.create({
            messages: [
                { role: "system", content: "Output valid JSON only." },
                { role: "user", content: prompt }
            ],
            model: modelName,
            response_format: { type: "json_object" },
            temperature: 0.1
        });

        const result = JSON.parse(completion.choices[0].message.content);

        let newPoints = currentPoints - 1;

        if (result.isCorrect && !isDev) {
            // Refund point
            newPoints = UserStore.updatePoints(apiKey, 1);
        } else if (!isDev) {
             newPoints = UserStore.getPoints(apiKey); // Get correct total
        }

        res.json({ ...result, points: newPoints });

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: error.message || 'Unknown error' });
    }
});

// 全局错误处理，防止服务器崩溃
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(port, () => {
        console.log(`侦探游戏服务器运行在 http://localhost:${port}`);
    });
}

module.exports = app;
