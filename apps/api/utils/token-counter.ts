/**
 * ego Graphica - Token Counter
 * トークン数の概算とメッセージ切り詰め
 */

interface ConversationMessage {
    role: string
    content: string
}

/**
 * トークン数を概算
 * 日本語: 約1.5文字/トークン、英語: 約4文字/トークン
 * （正確ではないが高速な概算）
 */
export function estimateTokens(text: string): number {
    // 日本語文字（ひらがな、カタカナ、漢字）をカウント
    const japanese_chars = (text.match(/[\u3000-\u9fff\u30a0-\u30ff\u3040-\u309f]/g) || []).length
    const other_chars = text.length - japanese_chars

    // 日本語は1.5文字/トークン、その他は4文字/トークン
    return Math.ceil(japanese_chars / 1.5 + other_chars / 4)
}

/**
 * メッセージ配列のトークン数を概算
 */
export function estimateMessagesTokens(messages: ConversationMessage[]): number {
    let total = 0
    for (const msg of messages) {
        // role + content + オーバーヘッド（約4トークン）
        total += estimateTokens(msg.content) + 4
    }
    return total
}

/**
 * トークン制限内に収まるようメッセージを切り詰め
 * 新しいメッセージを優先し、古いメッセージから削除
 */
export function truncateToTokenLimit(
    messages: ConversationMessage[],
    max_tokens: number,
    reserve_tokens: number = 4000 // レスポンス用に予約
): ConversationMessage[] {
    const available = max_tokens - reserve_tokens
    let total = 0
    const result: ConversationMessage[] = []

    // 新しいメッセージから優先（逆順でチェック）
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        const tokens = estimateTokens(msg.content) + 4

        if (total + tokens > available) {
            break
        }

        total += tokens
        result.unshift(msg)
    }

    return result
}

/**
 * プロバイダー別のコンテキストウィンドウサイズを取得
 */
export function getContextTokenBudget(provider: string): number {
    const budgets: Record<string, number> = {
        "claude": 200000,
        "grok": 131072,
        "openai": 128000
    }
    return budgets[provider.toLowerCase()] || 100000
}

/**
 * システムプロンプトを含めた利用可能トークン数を計算
 */
export function getAvailableTokensForHistory(
    provider: string,
    system_prompt_tokens: number,
    reserve_for_response: number = 4000
): number {
    const budget = getContextTokenBudget(provider)
    return budget - system_prompt_tokens - reserve_for_response
}
