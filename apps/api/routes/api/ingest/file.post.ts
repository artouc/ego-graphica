/**
 * ego Graphica - ファイルアップロードAPI
 * POST /api/ingest/file
 */

import { defineEventHandler, readMultipartFormData, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestoreInstance, getStorageInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { upsertVectors } from "~/utils/pinecone"
import { analyzeImage, analyzePdf, transcribeAudio, bufferToBase64 } from "~/utils/ai"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR, SourceType } from "@egographica/shared"
import type { VectorMetadata } from "@egographica/shared"

const ALLOWED_TYPES = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/wav": "wav",
    "audio/wave": "wav",
    "video/mp4": "mp4"
} as const

export default defineEventHandler(async (event: H3Event) => {
    const formData = await readMultipartFormData(event)

    if (!formData) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const bucket_field = formData.find(f => f.name === "bucket")
    const file_field = formData.find(f => f.name === "file")

    if (!bucket_field || !file_field) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const bucket = bucket_field.data.toString()
    const file_data = file_field.data
    const filename = file_field.filename || "unknown"
    const content_type = file_field.type || "application/octet-stream"

    const file_ext = ALLOWED_TYPES[content_type as keyof typeof ALLOWED_TYPES]
    if (!file_ext) {
        validationError(ERROR.VALIDATION.INVALID_FILE_TYPE)
    }

    console.log(LOG.DATA.FILE_UPLOADING, { bucket, filename })

    const db = getFirestoreInstance()
    const storage = getStorageInstance()

    let storage_url: string
    try {
        const storage_bucket = storage.bucket()
        const storage_path = `${bucket}/raw/${filename}`
        const file_ref = storage_bucket.file(storage_path)

        await file_ref.save(file_data, {
            metadata: { contentType: content_type }
        })

        await file_ref.makePublic()
        storage_url = `https://storage.googleapis.com/${storage_bucket.name}/${storage_path}`

        console.log(LOG.DATA.FILE_UPLOADED, { storage_url })
    } catch (e) {
        console.error("Storage upload failed:", e)
        serverError(ERROR.SERVICE.FIREBASE_ERROR)
    }

    console.log(LOG.DATA.FILE_PROCESSING)

    let extracted_text = ""
    let title = filename

    try {
        if (file_ext === "pdf") {
            const base64 = file_data.toString("base64")
            extracted_text = await analyzePdf(base64)
        } else if (file_ext === "jpg" || file_ext === "png") {
            const base64 = bufferToBase64(file_data, content_type)
            const analysis = await analyzeImage(base64, content_type)
            extracted_text = analysis.searchable
            title = analysis.subject || filename
        } else if (file_ext === "mp3" || file_ext === "m4a" || file_ext === "wav") {
            extracted_text = await transcribeAudio(file_data, filename)
        } else if (file_ext === "mp4") {
            extracted_text = `動画ファイル: ${filename}`
        }

        console.log(LOG.DATA.FILE_PROCESSED)
    } catch (e) {
        console.error("File processing failed:", e)
        extracted_text = `ファイル: ${filename}`
    }

    const doc_ref = db.collection(bucket).doc("files").collection("items").doc()
    const file_id = doc_ref.id

    await doc_ref.set({
        id: file_id,
        filename,
        url: storage_url,
        filetype: file_ext,
        content: extracted_text.slice(0, 10000),
        created: FieldValue.serverTimestamp()
    })

    try {
        const embedding = await generateEmbedding(extracted_text.slice(0, 8000))

        const metadata: VectorMetadata = {
            bucket,
            sourcetype: SourceType.FILE,
            source: file_id,
            title,
            text: extracted_text.slice(0, 1000),
            created: new Date().toISOString()
        }

        await upsertVectors(bucket, [
            {
                id: `file_${file_id}`,
                values: embedding,
                metadata
            }
        ])
    } catch (e) {
        console.error("Embedding/Pinecone failed:", e)
    }

    return success(event, {
        id: file_id,
        filename,
        url: storage_url,
        content: extracted_text.slice(0, 500)
    }, 201)
})
