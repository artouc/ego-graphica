/**
 * ego Graphica - Session History Cache
 * セッション履歴のRedisキャッシュ
 */

import { getRedisClient, REDIS_KEYS, REDIS_TTL } from "./redis"

interface SessionMessage {
    role: string
    content: string
}

interface CachedSession {
    messages: SessionMessage[]
    cached_at: number
}

/**
 * キャッシュされたセッション履歴を取得
 */
export async function getCachedSessionHistory(
    session_id: string
): Promise<SessionMessage[] | null> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.session(session_id)
        const cached = await redis.get<CachedSession>(key)

        if (!cached) return null

        return cached.messages
    } catch (e) {
        console.error("Session cache get failed:", e)
        return null
    }
}

/**
 * セッション履歴をキャッシュに設定
 */
export async function setSessionCache(
    session_id: string,
    messages: SessionMessage[]
): Promise<void> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.session(session_id)

        const data: CachedSession = {
            messages: [...messages],
            cached_at: Date.now()
        }

        await redis.set(key, data, { ex: REDIS_TTL.SESSION })
    } catch (e) {
        console.error("Session cache set failed:", e)
    }
}

/**
 * セッションキャッシュにメッセージを追加
 */
export async function appendToSessionCache(
    session_id: string,
    message: SessionMessage
): Promise<void> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.session(session_id)
        const cached = await redis.get<CachedSession>(key)

        if (cached) {
            cached.messages.push(message)
            cached.cached_at = Date.now()
            await redis.set(key, cached, { ex: REDIS_TTL.SESSION })
        }
    } catch (e) {
        console.error("Session cache append failed:", e)
    }
}

/**
 * セッションキャッシュを無効化
 */
export async function invalidateSessionCache(session_id: string): Promise<void> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.session(session_id)
        await redis.del(key)
    } catch (e) {
        console.error("Session cache invalidate failed:", e)
    }
}

/**
 * 全セッションキャッシュをクリア
 */
export async function clearAllSessionCache(): Promise<void> {
    try {
        const redis = getRedisClient()
        const keys = await redis.keys("session:*")
        if (keys.length > 0) {
            await redis.del(...keys)
        }
        console.log("Session cache cleared")
    } catch (e) {
        console.error("Session cache clear failed:", e)
    }
}
