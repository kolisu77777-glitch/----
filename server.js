const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const JSON5 = require('json5');
const OpenAI = require('openai');
const { checkSafety, analyzeInteraction } = require('./safety');
require('dotenv').config();

const app = express();
const port = 3000;

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

// 1. 生成案件接口
app.post('/generate', async (req, res) => {
    try {
        const { theme, model } = req.body;

        // 限制题材长度，防止刷分或注入过长 Prompt
        if (theme && theme.length > 50) {
            return res.status(400).json({ error: "题材长度不能超过50个字" });
        }

        const client = getClient(req);
        const modelName = model || 'gpt-3.5-turbo';

        console.log(`正在生成案件... 题材: ${theme}, 模型: ${modelName}, BaseURL: ${client.baseURL}`);

        const prompt = `You are a legendary mystery novelist like Agatha Christie or Keigo Higashino.
Your task is to generate a **hardcore, high-IQ mystery scenario** based on the theme: "${theme}".

### 1. THE TRICK (Core Requirement)
- **NO Simple Murders**: Do not generate simple stabbings or poisonings.
- **Ingenious Trick**: The killer MUST use a clever trick. Examples:
  - **Time Trick**: Tampering with clocks, delayed sounds, or ice melting.
  - **Physical Trick**: Using fishing lines, ice daggers, or locking mechanisms from outside.
  - **Psychological Trick**: Misleading witnesses, swapping identities, or "invisible man" logic.
- **The "Twist"**: The truth must be surprising but logically sound ("Unexpected but Reasonable").

### 2. THE CLUES (Show, Don't Tell)
- **Phenomenon ONLY**: Describe WHAT is seen, NOT what it means.
  - ❌ Bad: "A knife with the killer's fingerprints."
  - ✅ Good: "A fruit knife found under the sofa. The handle is sticky, and there is a faint smell of almonds."
- **Red Herrings**: Include 1-2 clues that look suspicious but are actually innocent (coincidences).
- **The "Fatal Error"**: The killer made ONE small, overlooked mistake that contradicts their alibi.

### 3. THE SUSPECTS (Complex Psychology)
- **Three Suspects**:
  - **Suspect A (The Killer)**: Smart, calm, has a perfect-looking alibi (based on the trick).
  - **Suspect B (The Scapegoat)**: Looks the most suspicious, has a clear motive, but is innocent.
  - **Suspect C (The Witness)**: Knows something but is hiding it for personal reasons (not murder).

### OUTPUT FORMAT:
You MUST output a single valid JSON object. No markdown.
Language: **Simplified Chinese (简体中文)**.

JSON Structure:
{
    "title": "A creative, mysterious title",
    "victim": "Name and identity",
    "time": "Time of death (approximate)",
    "cause": "Medical cause of death (e.g., 'Suffocation', 'Cardiac Arrest')",
    "scene": [
        "Visual detail 1 (Atmospheric)",
        "State of the body (e.g., 'Holding a button')",
        "Environmental anomaly (e.g., 'The window is open but it is raining')"
    ],
    "searchable_areas": [
        "书桌 (Desk)",
        "书架 (Bookshelf)",
        "垃圾桶 (Trash Can)",
        "窗台 (Window Sill)",
        "尸体口袋 (Victim's Pocket)"
    ],
    "suspects": [
        {
            "name": "Name (MUST be pure Chinese characters, e.g., '张三', NOT 'Zhang San' or '张三(Zhang San)')",
            "desc": "Personality and relationship to victim",
            "alibi": "Their claim (which might be a lie or a trick)",
            "psychological_profile": {
                "breaking_point": 90, // Killer should be high (85-95), Innocent low (60-80)
                "stress_pattern": "How they react to pressure (e.g., 'Becomes silent', 'Attacks accuser')",
                "breakdown_style": "What they do when caught (e.g., 'Manic laughter', 'Cold confession')",
                "vulnerability": "Their psychological weak point"
            },
            "private_knowledge": {
                "secret": "A personal secret (not necessarily the murder)",
                "observation": "Something suspicious they saw",
                "bias": "Why they hate/suspect someone else"
            }
        }
    ],
    "clues": [
        {"location": "Exact match from searchable_areas", "title": "Object Name", "content": "Objective description of appearance/state. NO conclusions.", "is_hidden": boolean}
    ],
    "truth": {
        "killer": "Name",
        "method": "Step-by-step explanation of the trick",
        "motive": "Deep, emotional, or twisted motive"
    }
}`;

        const completion = await client.chat.completions.create({
            messages: [
                { role: "system", content: "You are a JSON generator. You must output valid JSON. Ensure all newlines inside strings are escaped as \\n. Do not use raw control characters. Do not use Chinese punctuation like '《' or '》' outside of strings. Ensure all keys and string values are double-quoted." },
                { role: "user", content: prompt }
            ],
            model: modelName,
            temperature: 0.7,
        });

        const content = completion.choices[0].message.content;

        // 尝试提取 JSON (Smart Extraction)
        let jsonStr = content;
        const firstOpen = content.indexOf('{');
        const lastClose = content.lastIndexOf('}');

        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
            // 优先使用 lastIndexOf，因为它能处理 JSON 后有多余文本的情况
            // 且不会因为字符串内部的括号而导致计数错误
            jsonStr = content.substring(firstOpen, lastClose + 1);
        }

        // Pre-process to fix common JSON errors from LLMs
        // 1. Remove Markdown code blocks if present (redundant if extraction works, but safe)
        jsonStr = jsonStr.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/```$/, '');

        // 2. Aggressively fix Chinese punctuation that breaks JSON structure
        // Replace Chinese quotes with ESCAPED quotes to avoid breaking the JSON string structure
        jsonStr = jsonStr.replace(/[“”]/g, '\\"');

        // Do NOT replace book title marks 《》 as they are valid characters inside a string
        // and replacing them with " breaks the JSON structure if they are inside a string.
        // jsonStr = jsonStr.replace(/[《》]/g, '"');

        let caseData;
        try {
            caseData = JSON5.parse(jsonStr);
        } catch (parseError) {
            console.error("JSON Parse Failed. Raw Content:", content);
            console.error("Extracted JSON:", jsonStr);

            // Fallback: Try to fix common "trailing comma" issue or other minor syntax errors manually if needed
            // But JSON5 handles trailing commas.
            // Let's try one more heuristic: if the error is about '极' (unexpected char), maybe it's outside the JSON?
            // If we used lastIndexOf('}'), we should have excluded trailing text.
            // Unless the trailing text contains '}'...

            throw parseError;
        }

        caseData.startTime = Date.now(); // 注入案件开始时间戳
        res.json(caseData);

    } catch (error) {
        console.error('Error:', error);
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

            // Level 2: 严重违规 -> 直接锁定
            if (safetyResult.violation_level === 2) {
                return res.json({
                    answer: "VIOLATION_VIOLENCE",
                    lockout: 300000 // 5 mins
                });
            }
            // Level 1: 轻微违规 -> 警告或锁定
            else if (safetyResult.violation_level === 1) {
                const lastAssistantMsg = history.filter(h => h.role === 'assistant').pop()?.content || "";
                // 如果最近没有警告过，给一次机会
                if (!lastAssistantMsg.includes("不正当对话")) {
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

                    return res.json({
                        answer: `${grade}\n${result.comment}\n(得分: ${score}/${MAX_SCORE})`
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

        const prompt = `Generate a unique mystery game theme based on the historical events of "${date}" (Month/Day).
        1. Find a historical event, crime, or strange occurrence that happened on this day in history (any year).
        2. Create a fictionalized mystery theme inspired by it.
        3. Output ONLY the theme title in Simplified Chinese.
        Example Output: "1888年伦敦白教堂连环杀人案重演" or "1969年登月舱内的消失密室"`;

        const completion = await client.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: modelName,
            temperature: 0.7,
            max_tokens: 50
        });

        const theme = completion.choices[0].message.content.trim().replace(/^"|"$/g, '');
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
        const client = getClient(req);
        const modelName = model || 'gpt-3.5-turbo';

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
        res.json(result);

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

app.listen(port, () => {
    console.log(`侦探游戏服务器运行在 http://localhost:${port}`);
});
