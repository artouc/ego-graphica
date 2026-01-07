/**
 * ego Graphica - アセット一覧取得API
 * GET /api/assets?bucket={bucket}
 */

import { defineEventHandler, getQuery, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { success, validationError } from "~/utils/response"
import { ERROR } from "@egographica/shared"
import type { ImageAnalysis } from "@egographica/shared"

interface AssetItem {
    id: string
    url: string
    filename: string
    mimetype: string
    source: "uploaded" | "pdf-extracted"
    source_file_id?: string
    source_filename?: string
    page_number?: number
    analysis: ImageAnalysis
    created: Date
}

export default defineEventHandler(async (event: H3Event) => {
    const query = getQuery(event)
    const bucket = query.bucket as string

    if (!bucket) {
        return validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const db = getFirestoreInstance()

    const snapshot = await db
        .collection(bucket)
        .doc("assets")
        .collection("items")
        .orderBy("created", "desc")
        .limit(100)
        .get()

    const assets: AssetItem[] = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
            id: doc.id,
            url: data.url || "",
            filename: data.filename || "Unknown",
            mimetype: data.mimetype || "image/png",
            source: data.source || "uploaded",
            source_file_id: data.source_file_id,
            source_filename: data.source_filename,
            page_number: data.page_number,
            analysis: data.analysis || {},
            created: data.created?.toDate() || new Date()
        }
    })

    return success(event, { assets })
})
