/**
 * ego Graphica - Anthropic Claude
 */

import { createAnthropic } from "@ai-sdk/anthropic"
import Anthropic from "@anthropic-ai/sdk"

let anthropic_client: ReturnType<typeof createAnthropic> | null = null
let anthropic_sdk_client: Anthropic | null = null

/** Anthropic クライアントを取得（AI SDK用） */
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

/** Anthropic SDKクライアントを取得（直接API呼び出し用） */
export function getAnthropicSDKClient(): Anthropic {
    if (anthropic_sdk_client) {
        return anthropic_sdk_client
    }

    const config = useRuntimeConfig()

    anthropic_sdk_client = new Anthropic({
        apiKey: config.anthropicApiKey
    })

    return anthropic_sdk_client
}

/** Claude Opus 4.5 モデルを取得 */
export function getClaudeOpus() {
    const anthropic = getAnthropicClient()
    return anthropic("claude-opus-4-5")
}

/** Claude Sonnet 4 モデルを取得 */
export function getClaudeSonnet() {
    const anthropic = getAnthropicClient()
    return anthropic("claude-sonnet-4-5")
}

/** Claude Haiku 3.5 モデルを取得（高速・低コスト） */
export function getClaudeHaiku() {
    const anthropic = getAnthropicClient()
    return anthropic("claude-3-5-haiku-latest")
}
