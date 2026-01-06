/**
 * ego Graphica - Embedding Cache
 * OpenAI Embeddingの結果をRedisにキャッシュ
 */

import crypto from "crypto"
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from "./redis"

interface CachedEmbedding {
    embedding: number[]
    cached_at: number
}

/**
 * テキストのハッシュを生成
 */
function hashText(text: string): string {
    return crypto.createHash("sha256").update(text).digest("hex").slice(0, 32)
}

/**
 * キャッシュされたEmbeddingを取得
 */
export async function getCachedEmbedding(text: string): Promise<number[] | null> {
    try {
        const redis = getRedisClient()
        const text_hash = hashText(text)
        const key = REDIS_KEYS.embedding(text_hash)
        const cached = await redis.get<CachedEmbedding>(key)

        if (!cached) return null

        console.log("Embedding cache HIT")
        return cached.embedding
    } catch (e) {
        console.error("Embedding cache get failed:", e)
        return null
    }
}

/**
 * Embeddingをキャッシュに設定
 */
export async function setCachedEmbedding(
    text: string,
    embedding: number[]
): Promise<void> {
    try {
        const redis = getRedisClient()
        const text_hash = hashText(text)
        const key = REDIS_KEYS.embedding(text_hash)

        const data: CachedEmbedding = {
            embedding,
            cached_at: Date.now()
        }

        await redis.set(key, data, { ex: REDIS_TTL.EMBEDDING })
        console.log("Embedding cache SET")
    } catch (e) {
        console.error("Embedding cache set failed:", e)
    }
}

/**
 * 全Embeddingキャッシュをクリア
 */
export async function clearAllEmbeddingCache(): Promise<void> {
    try {
        const redis = getRedisClient()
        const keys = await redis.keys("embedding:*")
        if (keys.length > 0) {
            await redis.del(...keys)
        }
        console.log("Embedding cache cleared")
    } catch (e) {
        console.error("Embedding cache clear failed:", e)
    }
}
