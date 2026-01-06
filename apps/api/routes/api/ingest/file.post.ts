/**
 * ego Graphica - ファイルアップロードAPI
 * POST /api/ingest/file
 *
 * Storage構造:
 * - /{bucket}/data/raw/{filename} - 生データ
 * - /{bucket}/data/{file_id}/pdf.txt - PDFテキスト
 * - /{bucket}/data/{file_id}/pdf-1.png - PDFページ画像
 * - /{bucket}/data/{file_id}/audio.txt - 音声文字起こし
 * - /{bucket}/data/{file_id}/image.json - 画像解析結果
 */

import { defineEventHandler, readMultipartFormData, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestoreInstance, getStorageInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { upsertVectors } from "~/utils/pinecone"
import { analyzeImage, extractPdfContent, transcribeAudio, bufferToBase64 } from "~/utils/ai"
import { chunkText } from "~/utils/chunking"
import { analyzeWritingStyle, extractStyleSamples, mergeWritingStyles, mergeStyleSamples } from "~/utils/style-analyzer"
import { invalidateCache, InvalidationType } from "~/utils/cag"
import { invalidateVectorCache } from "~/utils/vector-cache"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR, SourceType } from "@egographica/shared"
import type { VectorMetadata, VectorUpsert, Persona } from "@egographica/shared"

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

/** ファイルをStorageにアップロード */
async function uploadToStorage(
    storage_bucket: ReturnType<ReturnType<typeof getStorageInstance>["bucket"]>,
    path: string,
    data: Buffer,
    content_type: string
): Promise<string> {
    const file_ref = storage_bucket.file(path)
    await file_ref.save(data, { metadata: { contentType: content_type } })
    await file_ref.makePublic()
    return `https://storage.googleapis.com/${storage_bucket.name}/${path}`
}

export default defineEventHandler(async (event: H3Event) => {
    const formData = await readMultipartFormData(event)

    if (!formData) {
        return validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const bucket_field = formData.find(f => f.name === "bucket")
    const file_field = formData.find(f => f.name === "file")

    if (!bucket_field || !file_field) {
        return validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const bucket = bucket_field.data.toString()
    const file_data = file_field.data
    const filename = file_field.filename || "unknown"
    const content_type = file_field.type || "application/octet-stream"

    const file_ext = ALLOWED_TYPES[content_type as keyof typeof ALLOWED_TYPES]
    if (!file_ext) {
        return validationError(ERROR.VALIDATION.INVALID_FILE_TYPE)
    }

    console.log(LOG.DATA.FILE_UPLOADING, { bucket, filename })

    const db = getFirestoreInstance()
    const storage = getStorageInstance()
    const storage_bucket = storage.bucket()

    // Firestoreドキュメントを先に作成してIDを取得
    const doc_ref = db.collection(bucket).doc("files").collection("items").doc()
    const file_id = doc_ref.id

    // 生データをアップロード
    let raw_url: string
    try {
        raw_url = await uploadToStorage(
            storage_bucket,
            `${bucket}/data/raw/${filename}`,
            file_data,
            content_type
        )
        console.log(LOG.DATA.FILE_UPLOADED, { raw_url })
    } catch (e) {
        console.error("Storage upload failed:", e)
        return serverError(ERROR.SERVICE.FIREBASE_ERROR)
    }

    console.log(LOG.DATA.FILE_PROCESSING)

    let extracted_text = ""
    let title = filename
    const data_urls: Record<string, string> = { raw: raw_url }

    try {
        if (file_ext === "pdf") {
            // PDF: テキストと埋め込み画像を抽出
            const { text, images } = await extractPdfContent(file_data)
            extracted_text = text

            // テキストをtxtファイルとしてアップロード（UTF-8 BOM付き）
            const bom = Buffer.from([0xEF, 0xBB, 0xBF])
            const text_buffer = Buffer.concat([bom, Buffer.from(text, "utf-8")])
            const text_url = await uploadToStorage(
                storage_bucket,
                `${bucket}/data/${file_id}/pdf.txt`,
                text_buffer,
                "text/plain; charset=utf-8"
            )
            data_urls.text = text_url

            // 埋め込み画像をPNGとしてアップロード
            for (let i = 0; i < images.length; i++) {
                const image_url = await uploadToStorage(
                    storage_bucket,
                    `${bucket}/data/${file_id}/pdf-${i + 1}.png`,
                    images[i],
                    "image/png"
                )
                data_urls[`image_${i + 1}`] = image_url
            }

        } else if (file_ext === "jpg" || file_ext === "png") {
            // 画像: Claude Visionで解析
            const base64 = bufferToBase64(file_data, content_type)
            const analysis = await analyzeImage(base64, content_type)
            extracted_text = analysis.searchable
            title = analysis.subject || filename

            // 解析結果をJSONとしてアップロード
            const json_url = await uploadToStorage(
                storage_bucket,
                `${bucket}/data/${file_id}/image.json`,
                Buffer.from(JSON.stringify(analysis, null, 2), "utf-8"),
                "application/json"
            )
            data_urls.analysis = json_url

        } else if (file_ext === "mp3" || file_ext === "m4a" || file_ext === "wav") {
            // 音声: Whisperで文字起こし
            extracted_text = await transcribeAudio(file_data, filename)

            // 文字起こし結果をtxtとしてアップロード（UTF-8 BOM付き）
            const bom = Buffer.from([0xEF, 0xBB, 0xBF])
            const text_buffer = Buffer.concat([bom, Buffer.from(extracted_text, "utf-8")])
            const text_url = await uploadToStorage(
                storage_bucket,
                `${bucket}/data/${file_id}/audio.txt`,
                text_buffer,
                "text/plain; charset=utf-8"
            )
            data_urls.text = text_url

        } else if (file_ext === "mp4") {
            extracted_text = `動画ファイル: ${filename}`
        }

        console.log(LOG.DATA.FILE_PROCESSED)
    } catch (e) {
        console.error("File processing failed:", e)
        extracted_text = `ファイル: ${filename}`
    }

    // Firestoreにメタデータを保存
    await doc_ref.set({
        id: file_id,
        filename,
        filetype: file_ext,
        urls: data_urls,
        preview: extracted_text.slice(0, 1000),
        created: FieldValue.serverTimestamp()
    })

    // テキストをチャンク分割してEmbeddingを生成、Pineconeに保存
    try {
        const chunks = chunkText(extracted_text, { chunk_size: 1000, overlap: 200 })
        const total_chunks = chunks.length

        console.log(`Chunking text: ${extracted_text.length} chars -> ${total_chunks} chunks`)

        const vectors: VectorUpsert[] = []

        for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.text)

            const metadata: VectorMetadata = {
                bucket,
                sourcetype: SourceType.FILE,
                source: file_id,
                title,
                text: chunk.text,
                chunk_index: chunk.index,
                total_chunks,
                created: new Date().toISOString()
            }

            vectors.push({
                id: `file_${file_id}_chunk_${chunk.index}`,
                values: embedding,
                metadata
            })
        }

        if (vectors.length > 0) {
            await upsertVectors(bucket, vectors)
            console.log(`Upserted ${vectors.length} vectors to Pinecone`)
        }
    } catch (e) {
        console.error("Embedding/Pinecone failed:", e)
    }

    // 文体分析（PDF/音声など十分なテキストがある場合）
    if (extracted_text.length > 500 && (file_ext === "pdf" || file_ext === "mp3" || file_ext === "m4a" || file_ext === "wav")) {
        try {
            console.log("Starting writing style analysis...")

            // 文体分析とサンプル抽出を並行実行
            const [new_style, new_samples] = await Promise.all([
                analyzeWritingStyle(extracted_text),
                extractStyleSamples(extracted_text)
            ])

            // 既存のペルソナを取得
            const persona_ref = db.collection(bucket).doc("persona")
            const persona_doc = await persona_ref.get()

            if (persona_doc.exists) {
                const existing_persona = persona_doc.data() as Persona

                // 既存の文体情報とマージ
                const merged_style = mergeWritingStyles(existing_persona.writing_style, new_style)
                const merged_samples = mergeStyleSamples(existing_persona.style_samples, new_samples)

                // ペルソナを更新
                await persona_ref.update({
                    writing_style: merged_style,
                    style_samples: merged_samples
                })

                console.log("Writing style merged with existing persona")
            } else {
                // ペルソナが存在しない場合は新規作成（最小限のフィールド）
                await persona_ref.set({
                    writing_style: new_style,
                    style_samples: new_samples
                }, { merge: true })

                console.log("Writing style saved to new persona")
            }
        } catch (e) {
            console.error("Writing style analysis failed:", e)
            // 文体分析の失敗はファイルアップロード全体を失敗させない
        }
    }

    // キャッシュを無効化（RAGサマリーとベクター検索）
    await Promise.all([
        invalidateCache(bucket, InvalidationType.RAG_SUMMARY),
        invalidateVectorCache(bucket)
    ])

    return success(event, {
        id: file_id,
        filename,
        urls: data_urls,
        preview: extracted_text.slice(0, 500)
    }, 201)
})
