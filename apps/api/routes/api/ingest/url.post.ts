/**
 * ego Graphica - URLスクレイピングAPI
 * POST /api/ingest/url
 *
 * Readabilityを使用してWebページの本文を高精度で抽出
 * - 広告、メニュー、サイドバー、フッター等を自動除去
 * - 記事本文のみを抽出
 *
 * Storage構造:
 * - /{bucket}/data/{url_id}/url.txt - スクレイピング結果テキスト
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { Readability } from "@mozilla/readability"
import { parseHTML } from "linkedom"
import { getFirestoreInstance, getStorageInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { upsertVectors } from "~/utils/pinecone"
import { chunkText } from "~/utils/chunking"
import { invalidateCache } from "~/utils/cag"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR, SourceType } from "@egographica/shared"
import type { VectorMetadata, VectorUpsert } from "@egographica/shared"

interface RequestBody {
    bucket: string
    url: string
}

/**
 * Readabilityを使用してHTMLから本文を抽出
 * - ナビゲーション、広告、サイドバー、フッターを自動除去
 * - 記事の本文とタイトルのみを返す
 */
function extractTextFromHtml(html: string, url: string): { title: string; content: string } {
    const { document } = parseHTML(html)

    // Readabilityでパース
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reader = new Readability(document as any, {
        charThreshold: 50
    })
    const article = reader.parse()

    if (article && article.textContent) {
        return {
            title: article.title || "",
            content: article.textContent
                .replace(/\s+/g, " ")
                .trim()
        }
    }

    // Readabilityで抽出できない場合はフォールバック
    console.log(LOG.DATA.READABILITY_FALLBACK)

    const title_match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = title_match ? title_match[1].trim() : ""

    const content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
        .replace(/<aside[^>]*>[\s\S]*?<\/aside>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ")
        .trim()

    return { title, content }
}

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.url) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    try {
        new URL(body.url)
    } catch {
        validationError(ERROR.VALIDATION.INVALID_URL)
    }

    console.log(LOG.DATA.URL_SCRAPING, { url: body.url })

    let html: string
    try {
        const response = await fetch(body.url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; egoGraphica/1.0)"
            }
        })

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        html = await response.text()
    } catch (e) {
        console.error("Scraping failed:", e)
        serverError(ERROR.SERVICE.SCRAPING_FAILED)
    }

    const { title, content } = extractTextFromHtml(html, body.url)

    if (!content || content.length < 50) {
        serverError(ERROR.SERVICE.SCRAPING_FAILED)
    }

    console.log(LOG.DATA.URL_SCRAPED, { title, length: content.length })

    const db = getFirestoreInstance()
    const storage = getStorageInstance()
    const storage_bucket = storage.bucket()

    // Firestoreドキュメントを先に作成してIDを取得
    const doc_ref = db.collection(body.bucket).doc("from-url").collection("items").doc()
    const url_id = doc_ref.id

    // テキストをFirebase Storageに保存（UTF-8 BOM付き）
    const full_text = `${title}\n\n${content}`
    const bom = Buffer.from([0xEF, 0xBB, 0xBF])
    const text_buffer = Buffer.concat([bom, Buffer.from(full_text, "utf-8")])

    let text_url: string | undefined
    try {
        const file_ref = storage_bucket.file(`${body.bucket}/data/${url_id}/url.txt`)
        await file_ref.save(text_buffer, {
            metadata: { contentType: "text/plain; charset=utf-8" }
        })
        await file_ref.makePublic()
        text_url = `https://storage.googleapis.com/${storage_bucket.name}/${body.bucket}/data/${url_id}/url.txt`
        console.log("URL text saved to Storage:", text_url)
    } catch (e) {
        console.error("Storage upload failed:", e)
    }

    // Firestoreにメタデータを保存
    await doc_ref.set({
        id: url_id,
        url: body.url,
        title: title || body.url,
        content: content.slice(0, 50000),
        text_url: text_url || null,
        scraped: FieldValue.serverTimestamp(),
        created: FieldValue.serverTimestamp()
    })

    // テキストをチャンク分割してEmbeddingを生成、Pineconeに保存
    try {
        const chunks = chunkText(full_text, { chunk_size: 1000, overlap: 200 })
        const total_chunks = chunks.length

        console.log(`Chunking URL text: ${full_text.length} chars -> ${total_chunks} chunks`)

        const vectors: VectorUpsert[] = []

        for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.text)

            const metadata: VectorMetadata = {
                bucket: body.bucket,
                sourcetype: SourceType.URL,
                source: url_id,
                title: title || body.url,
                text: chunk.text,
                chunk_index: chunk.index,
                total_chunks,
                created: new Date().toISOString()
            }

            vectors.push({
                id: `url_${url_id}_chunk_${chunk.index}`,
                values: embedding,
                metadata
            })
        }

        if (vectors.length > 0) {
            await upsertVectors(body.bucket, vectors)
            console.log(`Upserted ${vectors.length} URL vectors to Pinecone`)
        }
    } catch (e) {
        console.error("Embedding/Pinecone failed:", e)
    }

    // CAGキャッシュを無効化
    invalidateCache(body.bucket)

    return success(event, {
        id: url_id,
        url: body.url,
        title: title || body.url,
        content: content.slice(0, 500)
    }, 201)
})
