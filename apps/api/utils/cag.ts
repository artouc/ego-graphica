/**
 * ego Graphica - Cache Augmented Generation (CAG)
 * ペルソナとRAGサマリーをインメモリにキャッシュ
 */

import type { Persona } from "@egographica/shared"

interface CachedContext {
    persona: Persona | null
    rag_summary: string
    cached_at: Date
}

/** バケットごとのキャッシュ */
const cache = new Map<string, CachedContext>()

/** キャッシュの有効期限（ミリ秒） */
const CACHE_TTL = 60 * 60 * 1000 // 1時間

/**
 * キャッシュを取得
 */
export function getCache(bucket: string): CachedContext | null {
    const cached = cache.get(bucket)
    if (!cached) return null

    // TTLチェック
    const now = new Date()
    if (now.getTime() - cached.cached_at.getTime() > CACHE_TTL) {
        cache.delete(bucket)
        return null
    }

    return cached
}

/**
 * キャッシュを設定
 */
export function setCache(bucket: string, persona: Persona | null, rag_summary: string): void {
    cache.set(bucket, {
        persona,
        rag_summary,
        cached_at: new Date()
    })
    console.log(`CAG cache set for bucket: ${bucket}`)
}

/**
 * キャッシュを無効化
 */
export function invalidateCache(bucket: string): void {
    if (cache.has(bucket)) {
        cache.delete(bucket)
        console.log(`CAG cache invalidated for bucket: ${bucket}`)
    }
}

/**
 * 全キャッシュをクリア
 */
export function clearAllCache(): void {
    cache.clear()
    console.log("CAG cache cleared")
}

/**
 * キャッシュ統計を取得
 */
export function getCacheStats(): { buckets: string[]; count: number } {
    return {
        buckets: Array.from(cache.keys()),
        count: cache.size
    }
}

/**
 * RAGサマリーを構築（作品・ファイル・URLの情報をまとめる）
 */
export async function buildRagSummary(
    db: FirebaseFirestore.Firestore,
    bucket: string
): Promise<string> {
    const summary_parts: string[] = []

    // 作品情報を取得
    try {
        const works_snapshot = await db
            .collection(bucket)
            .doc("works")
            .collection("items")
            .orderBy("created", "desc")
            .limit(50)
            .get()

        if (!works_snapshot.empty) {
            summary_parts.push("## 作品一覧")
            for (const doc of works_snapshot.docs) {
                const work = doc.data()
                let work_info = `- ${work.title}`
                if (work.description) work_info += `: ${work.description}`
                if (work.status === "sold") work_info += "（売約済み）"
                if (work.analysis?.searchable) work_info += `\n  ${work.analysis.searchable.slice(0, 200)}`
                summary_parts.push(work_info)
            }
        }
    } catch (e) {
        console.error("Failed to fetch works for RAG summary:", e)
    }

    // ファイル情報を取得
    try {
        const files_snapshot = await db
            .collection(bucket)
            .doc("files")
            .collection("items")
            .orderBy("created", "desc")
            .limit(20)
            .get()

        if (!files_snapshot.empty) {
            summary_parts.push("\n## 参考資料")
            for (const doc of files_snapshot.docs) {
                const file = doc.data()
                summary_parts.push(`- ${file.filename}`)
            }
        }
    } catch (e) {
        console.error("Failed to fetch files for RAG summary:", e)
    }

    // URL情報を取得
    try {
        const urls_snapshot = await db
            .collection(bucket)
            .doc("urls")
            .collection("items")
            .orderBy("created", "desc")
            .limit(20)
            .get()

        if (!urls_snapshot.empty) {
            summary_parts.push("\n## 参考リンク")
            for (const doc of urls_snapshot.docs) {
                const url_data = doc.data()
                summary_parts.push(`- ${url_data.title || url_data.url}`)
            }
        }
    } catch (e) {
        console.error("Failed to fetch URLs for RAG summary:", e)
    }

    return summary_parts.join("\n")
}
