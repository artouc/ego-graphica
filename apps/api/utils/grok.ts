/**
 * ego Graphica - xAI Grok
 */

import { createXai } from "@ai-sdk/xai"

let xai_client: ReturnType<typeof createXai> | null = null

/** xAI クライアントを取得 */
export function getXaiClient(): ReturnType<typeof createXai> {
    if (xai_client) {
        return xai_client
    }

    const config = useRuntimeConfig()

    xai_client = createXai({
        apiKey: config.xaiApiKey
    })

    return xai_client
}

/** Grok 4.1 Fast Reasoning モデルを取得 */
export function getGrok() {
    const xai = getXaiClient()
    return xai("grok-4-1-fast-reasoning-latest")
}
