const JSON5 = require('json5');

/**
 * Robust JSON parser for LLM output.
 * Handles:
 * - Markdown code blocks
 * - Chinese punctuation used as delimiters (context-aware)
 */
function repairAndParse(rawInput) {
    if (!rawInput) {
        throw new Error("Input is empty");
    }

    let jsonStr = rawInput.trim();

    // 1. Strip Markdown code blocks (```json ... ```)
    jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');

    // 2. Extract JSON object if wrapped in other text
    const firstOpen = jsonStr.indexOf('{');
    const lastClose = jsonStr.lastIndexOf('}');
    if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        jsonStr = jsonStr.substring(firstOpen, lastClose + 1);
    }

    // 3. Context-Aware Punctuation Repair
    // Only replace Chinese punctuation that acts as a delimiter
    // This avoids breaking strings that legitimately contain Chinese punctuation
    jsonStr = jsonStr
        // Replace Chinese colon after a quote (key-value separator)
        // e.g., "key"： -> "key":
        .replace(/(["'])\s*：/g, '$1:')
        // Replace Chinese comma after a quote (array/object separator)
        // e.g., "value"， -> "value",
        .replace(/(["'])\s*，/g, '$1,')
        // Replace Chinese quote before a colon (key end)
        // e.g., “key”: -> "key":
        .replace(/”\s*:/g, '":')
        .replace(/’\s*:/g, "':");

    return JSON5.parse(jsonStr);
}

module.exports = { repairAndParse };
