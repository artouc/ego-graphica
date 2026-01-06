/**
 * ego Graphica - 作品登録API
 * POST /api/works
 */

import { defineEventHandler, readMultipartFormData, H3Event } from "h3"
import { FieldValue, Timestamp } from "firebase-admin/firestore"
import { getFirestoreInstance, getStorageInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { upsertVectors } from "~/utils/pinecone"
import { analyzeImage, bufferToBase64 } from "~/utils/ai"
import { invalidateCache, InvalidationType } from "~/utils/cag"
import { invalidateVectorCache } from "~/utils/vector-cache"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR, SourceType } from "@egographica/shared"
import type { VectorMetadata, ImageAnalysis } from "@egographica/shared"

const ALLOWED_TYPES = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "audio/wav": "wav",
    "video/mp4": "mp4"
} as const

export default defineEventHandler(async (event: H3Event) => {
    const formData = await readMultipartFormData(event)

    if (!formData) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const getField = (name: string): string => {
        const field = formData.find(f => f.name === name)
        return field ? field.data.toString() : ""
    }

    const bucket = getField("bucket")
    const title = getField("title")
    const date = getField("date")
    const worktype = getField("worktype") || "personal"
    const client = getField("client")
    const status = getField("status") || "available"
    const description = getField("description")
    const story = getField("story")
    const file_field = formData.find(f => f.name === "file")

    if (!bucket || !title || !file_field) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const file_data = file_field.data
    const filename = file_field.filename || "unknown"
    const content_type = file_field.type || "application/octet-stream"

    const file_ext = ALLOWED_TYPES[content_type as keyof typeof ALLOWED_TYPES]
    if (!file_ext) {
        validationError(ERROR.VALIDATION.INVALID_FILE_TYPE)
    }

    console.log(LOG.WORK.CREATING, { bucket, title })

    const db = getFirestoreInstance()
    const storage = getStorageInstance()

    let storage_url: string
    try {
        const storage_bucket = storage.bucket()
        const storage_path = `${bucket}/raw/${Date.now()}_${filename}`
        const file_ref = storage_bucket.file(storage_path)

        await file_ref.save(file_data, {
            metadata: { contentType: content_type }
        })

        await file_ref.makePublic()
        storage_url = `https://storage.googleapis.com/${storage_bucket.name}/${storage_path}`
    } catch (e) {
        console.error("Storage upload failed:", e)
        serverError(ERROR.SERVICE.FIREBASE_ERROR)
    }

    let analysis: ImageAnalysis | undefined
    if (file_ext === "jpg" || file_ext === "png") {
        try {
            const base64 = bufferToBase64(file_data, content_type)
            analysis = await analyzeImage(base64, content_type)
        } catch (e) {
            console.error("Image analysis failed:", e)
        }
    }

    const doc_ref = db.collection(bucket).doc("works").collection("items").doc()
    const work_id = doc_ref.id

    const work_date = date ? Timestamp.fromDate(new Date(date)) : Timestamp.now()

    const work_data = {
        id: work_id,
        url: storage_url,
        filetype: file_ext,
        title,
        date: work_date,
        worktype,
        client: worktype === "client" ? client : null,
        status,
        description: description || null,
        story: story || null,
        analysis: analysis || null,
        created: FieldValue.serverTimestamp(),
        updated: FieldValue.serverTimestamp()
    }

    await doc_ref.set(work_data)

    console.log(LOG.WORK.CREATED, { work_id })

    try {
        const text_parts = [title]
        if (description) text_parts.push(description)
        if (story) text_parts.push(story)
        if (analysis) text_parts.push(analysis.searchable)

        const text_for_embedding = text_parts.join("\n").slice(0, 8000)
        const embedding = await generateEmbedding(text_for_embedding)

        const metadata: VectorMetadata = {
            bucket,
            sourcetype: SourceType.WORK,
            source: work_id,
            title,
            text: text_for_embedding.slice(0, 1000),
            colors: analysis?.colors,
            style: analysis?.style,
            mood: analysis?.mood,
            created: new Date().toISOString()
        }

        await upsertVectors(bucket, [
            {
                id: `work_${work_id}`,
                values: embedding,
                metadata
            }
        ])
    } catch (e) {
        console.error("Embedding/Pinecone failed:", e)
    }

    // キャッシュを無効化（RAGサマリーとベクター検索）
    await Promise.all([
        invalidateCache(bucket, InvalidationType.RAG_SUMMARY),
        invalidateVectorCache(bucket)
    ])

    return success(event, {
        id: work_id,
        url: storage_url,
        title,
        analysis
    }, 201)
})
