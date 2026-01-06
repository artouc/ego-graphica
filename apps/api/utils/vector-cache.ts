/**
 * ego Graphica - Vector Search Cache
 * ベクター検索結果のRedisキャッシュ
 */

import crypto from "crypto"
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from "./redis"

interface VectorSearchResult {
    id: string
    score: number
    metadata: Record<string, unknown>
}

interface CachedVectorResults {
    results: VectorSearchResult[]
    cached_at: number
}

/**
 * エンベディングベクターのハッシュを生成
 * 最初の10個の値でハッシュを生成（近似マッチング用）
 */
function hashEmbedding(embedding: number[]): string {
    const signature = embedding.slice(0, 10).map(v => Math.round(v * 1000)).join(",")
    return crypto.createHash("md5").update(signature).digest("hex").slice(0, 16)
}

/**
 * キャッシュされたベクター検索結果を取得
 */
export async function getCachedVectorResults(
    bucket: string,
    embedding: number[]
): Promise<VectorSearchResult[] | null> {
    try {
        const redis = getRedisClient()
        const query_hash = hashEmbedding(embedding)
        const key = REDIS_KEYS.vector(bucket, query_hash)
        const cached = await redis.get<CachedVectorResults>(key)

        if (!cached) return null

        return cached.results
    } catch (e) {
        console.error("Vector cache get failed:", e)
        return null
    }
}

/**
 * ベクター検索結果をキャッシュに設定
 */
export async function setVectorCache(
    bucket: string,
    embedding: number[],
    results: VectorSearchResult[]
): Promise<void> {
    try {
        const redis = getRedisClient()
        const query_hash = hashEmbedding(embedding)
        const key = REDIS_KEYS.vector(bucket, query_hash)

        const data: CachedVectorResults = {
            results: [...results],
            cached_at: Date.now()
        }

        await redis.set(key, data, { ex: REDIS_TTL.VECTOR })
    } catch (e) {
        console.error("Vector cache set failed:", e)
    }
}

/**
 * バケットのベクターキャッシュを無効化
 */
export async function invalidateVectorCache(bucket: string): Promise<void> {
    try {
        const redis = getRedisClient()
        const keys = await redis.keys(`vector:${bucket}:*`)
        if (keys.length > 0) {
            await redis.del(...keys)
        }
        console.log(`Vector cache invalidated for bucket: ${bucket}`)
    } catch (e) {
        console.error("Vector cache invalidate failed:", e)
    }
}

/**
 * 全ベクターキャッシュをクリア
 */
export async function clearAllVectorCache(): Promise<void> {
    try {
        const redis = getRedisClient()
        const keys = await redis.keys("vector:*")
        if (keys.length > 0) {
            await redis.del(...keys)
        }
        console.log("Vector cache cleared")
    } catch (e) {
        console.error("Vector cache clear failed:", e)
    }
}
