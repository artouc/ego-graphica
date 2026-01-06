/**
 * ego Graphica - Upstash Redis クライアント
 */

import { Redis } from "@upstash/redis"

let redis_client: Redis | null = null

/** Redis クライアントを取得 */
export function getRedisClient(): Redis {
    if (redis_client) {
        return redis_client
    }

    const config = useRuntimeConfig()

    redis_client = new Redis({
        url: config.upstashRedisRestUrl,
        token: config.upstashRedisRestToken
    })

    return redis_client
}

/** キー命名規則 */
export const REDIS_KEYS = {
    /** CAGコンテキスト: cag:context:{bucket} */
    cagContext: (bucket: string) => `cag:context:${bucket}`,
    /** セッション履歴: session:{session_id} */
    session: (session_id: string) => `session:${session_id}`,
    /** ベクター検索結果: vector:{bucket}:{query_hash} */
    vector: (bucket: string, query_hash: string) => `vector:${bucket}:${query_hash}`,
    /** Embedding: embedding:{text_hash} */
    embedding: (text_hash: string) => `embedding:${text_hash}`
} as const

/** TTL設定（秒） */
export const REDIS_TTL = {
    /** CAGコンテキスト: 1時間 */
    CAG_CONTEXT: 60 * 60,
    /** セッション履歴: 30分 */
    SESSION: 30 * 60,
    /** ベクター検索結果: 5分 */
    VECTOR: 5 * 60,
    /** Embedding: 24時間 */
    EMBEDDING: 24 * 60 * 60
} as const
