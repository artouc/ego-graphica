/**
 * ego Graphica - Vector Search Cache
 * ベクター検索結果のインメモリキャッシュ
 */

import crypto from "crypto"

interface VectorSearchResult {
    id: string
    score: number
    metadata: Record<string, unknown>
}

interface CachedVectorResults {
    results: VectorSearchResult[]
    cached_at: Date
}

/** ベクター検索結果のキャッシュ */
const vector_cache = new Map<string, CachedVectorResults>()

/** キャッシュの有効期限（ミリ秒） */
const VECTOR_CACHE_TTL = 5 * 60 * 1000 // 5分

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
export function getCachedVectorResults(
    bucket: string,
    embedding: number[]
): VectorSearchResult[] | null {
    const key = `${bucket}:${hashEmbedding(embedding)}`
    const cached = vector_cache.get(key)

    if (!cached) return null

    // TTLチェック
    const age = Date.now() - cached.cached_at.getTime()
    if (age > VECTOR_CACHE_TTL) {
        vector_cache.delete(key)
        return null
    }

    return cached.results
}

/**
 * ベクター検索結果をキャッシュに設定
 */
export function setVectorCache(
    bucket: string,
    embedding: number[],
    results: VectorSearchResult[]
): void {
    const key = `${bucket}:${hashEmbedding(embedding)}`
    vector_cache.set(key, {
        results: [...results], // コピーを保存
        cached_at: new Date()
    })
}

/**
 * バケットのベクターキャッシュを無効化
 */
export function invalidateVectorCache(bucket: string): void {
    for (const key of vector_cache.keys()) {
        if (key.startsWith(`${bucket}:`)) {
            vector_cache.delete(key)
        }
    }
}

/**
 * 全ベクターキャッシュをクリア
 */
export function clearAllVectorCache(): void {
    vector_cache.clear()
}

/**
 * ベクターキャッシュの統計情報を取得
 */
export function getVectorCacheStats(): { entries: number; buckets: string[] } {
    const buckets = new Set<string>()
    for (const key of vector_cache.keys()) {
        const bucket = key.split(":")[0]
        buckets.add(bucket)
    }
    return {
        entries: vector_cache.size,
        buckets: Array.from(buckets)
    }
}
