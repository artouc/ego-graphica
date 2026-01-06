/**
 * ego Graphica - 作品編集API
 * PUT /api/works/:id
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { getFirestoreInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { upsertVectors } from "~/utils/pinecone"
import { invalidateCache, InvalidationType } from "~/utils/cag"
import { invalidateVectorCache } from "~/utils/vector-cache"
import { success, validationError, notFound } from "~/utils/response"
import { LOG, ERROR, SourceType } from "@egographica/shared"
import type { VectorMetadata } from "@egographica/shared"

interface RequestBody {
    bucket: string
    title?: string
    date?: string
    worktype?: string
    client?: string
    status?: string
    description?: string
    story?: string
}

export default defineEventHandler(async (event: H3Event) => {
    const id = event.context.params?.id
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !id) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    console.log(LOG.WORK.UPDATING, { bucket: body.bucket, id })

    const db = getFirestoreInstance()

    const doc_ref = db
        .collection(body.bucket)
        .doc("works")
        .collection("items")
        .doc(id)

    const doc = await doc_ref.get()

    if (!doc.exists) {
        notFound(ERROR.DATA.NOT_FOUND)
    }

    const existing_data = doc.data()!

    // 更新データを構築（undefinedは除外）
    const update_data: Record<string, unknown> = {
        updated: FieldValue.serverTimestamp()
    }

    if (body.title !== undefined) {
        update_data.title = body.title
    }
    if (body.date !== undefined) {
        update_data.date = Timestamp.fromDate(new Date(body.date))
    }
    if (body.worktype !== undefined) {
        update_data.worktype = body.worktype
        // worktypeがclient以外の場合、clientをnullに
        if (body.worktype !== "client") {
            update_data.client = null
        }
    }
    if (body.client !== undefined && (body.worktype === "client" || existing_data.worktype === "client")) {
        update_data.client = body.client || null
    }
    if (body.status !== undefined) {
        update_data.status = body.status
    }
    if (body.description !== undefined) {
        update_data.description = body.description || null
    }
    if (body.story !== undefined) {
        update_data.story = body.story || null
    }

    await doc_ref.update(update_data)

    console.log(LOG.WORK.UPDATED, { id })

    // テキスト関連のフィールドが変更された場合、Pineconeも更新
    if (body.title !== undefined || body.description !== undefined || body.story !== undefined) {
        try {
            const updated_doc = await doc_ref.get()
            const updated_data = updated_doc.data()!

            const text_parts = [updated_data.title]
            if (updated_data.description) text_parts.push(updated_data.description)
            if (updated_data.story) text_parts.push(updated_data.story)
            if (updated_data.analysis?.searchable) text_parts.push(updated_data.analysis.searchable)

            const text_for_embedding = text_parts.join("\n").slice(0, 8000)
            const embedding = await generateEmbedding(text_for_embedding)

            const metadata: VectorMetadata = {
                bucket: body.bucket,
                sourcetype: SourceType.WORK,
                source: id,
                title: updated_data.title,
                text: text_for_embedding.slice(0, 1000),
                colors: updated_data.analysis?.colors,
                style: updated_data.analysis?.style,
                mood: updated_data.analysis?.mood,
                created: new Date().toISOString()
            }

            await upsertVectors(body.bucket, [
                {
                    id: `work_${id}`,
                    values: embedding,
                    metadata
                }
            ])

            console.log("Work embedding updated in Pinecone")
        } catch (e) {
            console.error("Embedding/Pinecone update failed:", e)
        }
    }

    // キャッシュを無効化（RAGサマリーとベクター検索）
    await Promise.all([
        invalidateCache(body.bucket, InvalidationType.RAG_SUMMARY),
        invalidateVectorCache(body.bucket)
    ])

    // 更新後のデータを取得して返す
    const final_doc = await doc_ref.get()
    const final_data = final_doc.data()!

    return success(event, {
        id,
        title: final_data.title,
        date: final_data.date?.toDate?.()?.toISOString() || null,
        worktype: final_data.worktype,
        client: final_data.client,
        status: final_data.status,
        description: final_data.description,
        story: final_data.story
    })
})
