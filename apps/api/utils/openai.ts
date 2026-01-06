/**
 * ego Graphica - OpenAI Embedding
 */

import { createOpenAI } from "@ai-sdk/openai"
import { embed } from "ai"
import { LOG } from "@egographica/shared"

let openai_client: ReturnType<typeof createOpenAI> | null = null

/** OpenAI クライアントを取得 */
export function getOpenAIClient(): ReturnType<typeof createOpenAI> {
    if (openai_client) {
        return openai_client
    }

    const config = useRuntimeConfig()

    openai_client = createOpenAI({
        apiKey: config.openaiApiKey
    })

    return openai_client
}

/** テキストをEmbeddingに変換 */
export async function generateEmbedding(text: string): Promise<number[]> {
    console.log(LOG.DATA.EMBEDDING_GENERATING)

    const openai = getOpenAIClient()

    const { embedding } = await embed({
        model: openai.embedding("text-embedding-3-large"),
        value: text
    })

    console.log(LOG.DATA.EMBEDDING_GENERATED)

    return embedding
}
