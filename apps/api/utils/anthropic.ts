/**
 * ego Graphica - Anthropic Claude
 */

import { createAnthropic } from "@ai-sdk/anthropic"

let anthropic_client: ReturnType<typeof createAnthropic> | null = null

/** Anthropic クライアントを取得 */
export function getAnthropicClient(): ReturnType<typeof createAnthropic> {
    if (anthropic_client) {
        return anthropic_client
    }

    const config = useRuntimeConfig()

    anthropic_client = createAnthropic({
        apiKey: config.anthropicApiKey
    })

    return anthropic_client
}

/** Claude Opus 4.5 モデルを取得 */
export function getClaudeOpus() {
    const anthropic = getAnthropicClient()
    return anthropic("claude-opus-4-5")
}

/** Claude Sonnet 4.5 モデルを取得 */
export function getClaudeSonnet() {
    const anthropic = getAnthropicClient()
    return anthropic("claude-sonnet-4-5")
}
