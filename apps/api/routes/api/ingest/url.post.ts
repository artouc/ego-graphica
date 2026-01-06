/**
 * ego Graphica - URLスクレイピングAPI
 * POST /api/ingest/url
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestoreInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { upsertVectors } from "~/utils/pinecone"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR, SourceType } from "@egographica/shared"
import type { VectorMetadata } from "@egographica/shared"

interface RequestBody {
    bucket: string
    url: string
}

/** HTMLからテキストを抽出 */
function extractTextFromHtml(html: string): { title: string; content: string } {
    const title_match = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = title_match ? title_match[1].trim() : ""

    let content = html
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

    const { title, content } = extractTextFromHtml(html)

    if (!content || content.length < 50) {
        serverError(ERROR.SERVICE.SCRAPING_FAILED)
    }

    console.log(LOG.DATA.URL_SCRAPED, { title, length: content.length })

    const db = getFirestoreInstance()
    const doc_ref = db.collection(body.bucket).doc("from-url").collection("items").doc()
    const url_id = doc_ref.id

    await doc_ref.set({
        id: url_id,
        url: body.url,
        title: title || body.url,
        content: content.slice(0, 50000),
        scraped: FieldValue.serverTimestamp(),
        created: FieldValue.serverTimestamp()
    })

    try {
        const text_for_embedding = `${title}\n\n${content}`.slice(0, 8000)
        const embedding = await generateEmbedding(text_for_embedding)

        const metadata: VectorMetadata = {
            bucket: body.bucket,
            sourcetype: SourceType.URL,
            source: url_id,
            title: title || body.url,
            text: content.slice(0, 1000),
            created: new Date().toISOString()
        }

        await upsertVectors(body.bucket, [
            {
                id: `url_${url_id}`,
                values: embedding,
                metadata
            }
        ])
    } catch (e) {
        console.error("Embedding/Pinecone failed:", e)
    }

    return success(event, {
        id: url_id,
        url: body.url,
        title: title || body.url,
        content: content.slice(0, 500)
    }, 201)
})
