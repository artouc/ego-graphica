/**
 * ego Graphica - Cache Augmented Generation (CAG)
 * ペルソナ・RAGサマリー・口調分析をRedisにキャッシュ
 */

import type { Persona, WritingStyle } from "@egographica/shared"
import { getRedisClient, REDIS_KEYS, REDIS_TTL } from "./redis"
import { analyzeWritingStyle, extractStyleSamples, collectTextContent } from "./style-analyzer"

interface CachedContext {
    persona: Persona | null
    rag_summary: string
    writing_style: WritingStyle | null
    style_samples: string[]
    cached_at: number
}

/**
 * キャッシュ無効化の種類
 */
export enum InvalidationType {
    PERSONA_ONLY = "persona",
    RAG_SUMMARY = "rag_summary",
    FULL = "full"
}

/**
 * キャッシュを取得（Redis）
 */
export async function getCache(bucket: string): Promise<CachedContext | null> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.cagContext(bucket)
        const cached = await redis.get<CachedContext>(key)

        if (!cached) return null

        return cached
    } catch (e) {
        console.error("CAG cache get failed:", e)
        return null
    }
}

/**
 * キャッシュを設定（Redis）
 */
export async function setCache(
    bucket: string,
    persona: Persona | null,
    rag_summary: string,
    writing_style: WritingStyle | null = null,
    style_samples: string[] = []
): Promise<void> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.cagContext(bucket)

        const data: CachedContext = {
            persona,
            rag_summary,
            writing_style,
            style_samples,
            cached_at: Date.now()
        }

        await redis.set(key, data, { ex: REDIS_TTL.CAG_CONTEXT })
        console.log(`CAG cache set for bucket: ${bucket}`)
    } catch (e) {
        console.error("CAG cache set failed:", e)
    }
}

/**
 * キャッシュを無効化（選択的無効化対応）
 * @param bucket バケット名
 * @param type 無効化の種類（デフォルト: FULL）
 */
export async function invalidateCache(
    bucket: string,
    type: InvalidationType = InvalidationType.FULL
): Promise<void> {
    try {
        const redis = getRedisClient()
        const key = REDIS_KEYS.cagContext(bucket)

        // ペルソナ変更時もフル無効化（Chat APIがpersona=nullを使わないように）
        if (type === InvalidationType.FULL || type === InvalidationType.PERSONA_ONLY) {
            await redis.del(key)
            console.log(`CAG cache invalidated (${type}) for bucket: ${bucket}`)
            return
        }

        // RAGサマリーのみの無効化: 既存のデータを取得して更新
        const cached = await redis.get<CachedContext>(key)
        if (!cached) return

        if (type === InvalidationType.RAG_SUMMARY) {
            cached.rag_summary = ""
            await redis.set(key, cached, { ex: REDIS_TTL.CAG_CONTEXT })
            console.log(`CAG RAG summary cache invalidated for bucket: ${bucket}`)
        }
    } catch (e) {
        console.error("CAG cache invalidate failed:", e)
    }
}

/**
 * 全キャッシュをクリア（パターンマッチで削除）
 */
export async function clearAllCache(): Promise<void> {
    try {
        const redis = getRedisClient()
        // Upstash では SCAN を使ってパターンマッチ削除
        const keys = await redis.keys("cag:context:*")
        if (keys.length > 0) {
            await redis.del(...keys)
        }
        console.log("CAG cache cleared")
    } catch (e) {
        console.error("CAG cache clear failed:", e)
    }
}

/**
 * RAGサマリーを構築（作品・ファイル・URLの情報をまとめる）
 * Firestoreクエリを並列実行して高速化
 */
export async function buildRagSummary(
    db: FirebaseFirestore.Firestore,
    bucket: string
): Promise<string> {
    const summary_parts: string[] = []

    // 3つのコレクションを並列で取得
    const [works_result, files_result, urls_result] = await Promise.allSettled([
        db.collection(bucket)
            .doc("works")
            .collection("items")
            .orderBy("created", "desc")
            .limit(50)
            .get(),
        db.collection(bucket)
            .doc("files")
            .collection("items")
            .orderBy("created", "desc")
            .limit(20)
            .get(),
        db.collection(bucket)
            .doc("urls")
            .collection("items")
            .orderBy("created", "desc")
            .limit(20)
            .get()
    ])

    // 作品情報を処理
    if (works_result.status === "fulfilled" && !works_result.value.empty) {
        summary_parts.push("## 作品一覧")
        for (const doc of works_result.value.docs) {
            const work = doc.data()
            let work_info = `- ${work.title}`
            if (work.description) work_info += `: ${work.description}`
            if (work.status === "sold") work_info += "（売約済み）"
            if (work.analysis?.searchable) work_info += `\n  ${work.analysis.searchable.slice(0, 200)}`
            summary_parts.push(work_info)
        }
    } else if (works_result.status === "rejected") {
        console.error("Failed to fetch works for RAG summary:", works_result.reason)
    }

    // ファイル情報を処理
    if (files_result.status === "fulfilled" && !files_result.value.empty) {
        summary_parts.push("\n## 参考資料")
        for (const doc of files_result.value.docs) {
            const file = doc.data()
            summary_parts.push(`- ${file.filename}`)
        }
    } else if (files_result.status === "rejected") {
        console.error("Failed to fetch files for RAG summary:", files_result.reason)
    }

    // URL情報を処理
    if (urls_result.status === "fulfilled" && !urls_result.value.empty) {
        summary_parts.push("\n## 参考リンク")
        for (const doc of urls_result.value.docs) {
            const url_data = doc.data()
            summary_parts.push(`- ${url_data.title || url_data.url}`)
        }
    } else if (urls_result.status === "rejected") {
        console.error("Failed to fetch URLs for RAG summary:", urls_result.reason)
    }

    return summary_parts.join("\n")
}

/**
 * 口調分析を構築（テキストコンテンツから文体を分析）
 */
export async function buildStyleAnalysis(
    db: FirebaseFirestore.Firestore,
    bucket: string
): Promise<{ writing_style: WritingStyle | null; style_samples: string[] }> {
    console.log("Building style analysis for bucket:", bucket)

    try {
        // テキストコンテンツを収集
        const texts = await collectTextContent(db, bucket)

        if (texts.length === 0) {
            console.log("No text content found for style analysis")
            return { writing_style: null, style_samples: [] }
        }

        console.log(`Found ${texts.length} text sources for analysis`)

        // 並列で分析とサンプル抽出を実行
        const [writing_style, style_samples] = await Promise.all([
            analyzeWritingStyle(texts),
            Promise.resolve(extractStyleSamples(texts))
        ])

        return { writing_style, style_samples }
    } catch (e) {
        console.error("Style analysis build failed:", e)
        return { writing_style: null, style_samples: [] }
    }
}
