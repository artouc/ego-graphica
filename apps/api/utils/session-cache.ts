/**
 * ego Graphica - Session History Cache
 * セッション履歴のインメモリキャッシュ
 */

interface SessionMessage {
    role: string
    content: string
}

interface CachedSession {
    messages: SessionMessage[]
    cached_at: Date
}

/** セッションごとのキャッシュ */
const session_cache = new Map<string, CachedSession>()

/** キャッシュの有効期限（ミリ秒） */
const SESSION_CACHE_TTL = 60 * 1000 // 1分

/**
 * キャッシュされたセッション履歴を取得
 */
export function getCachedSessionHistory(session_id: string): SessionMessage[] | null {
    const cached = session_cache.get(session_id)
    if (!cached) return null

    // TTLチェック
    const age = Date.now() - cached.cached_at.getTime()
    if (age > SESSION_CACHE_TTL) {
        session_cache.delete(session_id)
        return null
    }

    return cached.messages
}

/**
 * セッション履歴をキャッシュに設定
 */
export function setSessionCache(
    session_id: string,
    messages: SessionMessage[]
): void {
    session_cache.set(session_id, {
        messages: [...messages], // コピーを保存
        cached_at: new Date()
    })
}

/**
 * セッションキャッシュにメッセージを追加
 */
export function appendToSessionCache(
    session_id: string,
    message: SessionMessage
): void {
    const cached = session_cache.get(session_id)
    if (cached) {
        cached.messages.push(message)
        cached.cached_at = new Date()
    }
}

/**
 * セッションキャッシュを無効化
 */
export function invalidateSessionCache(session_id: string): void {
    if (session_cache.has(session_id)) {
        session_cache.delete(session_id)
    }
}

/**
 * 全セッションキャッシュをクリア
 */
export function clearAllSessionCache(): void {
    session_cache.clear()
}

/**
 * セッションキャッシュの統計情報を取得
 */
export function getSessionCacheStats(): { sessions: number; total_messages: number } {
    let total_messages = 0
    for (const cached of session_cache.values()) {
        total_messages += cached.messages.length
    }
    return {
        sessions: session_cache.size,
        total_messages
    }
}
