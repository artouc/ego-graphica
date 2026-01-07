/**
 * ego Graphica - ファイル一覧取得API
 * GET /api/ingest/files?bucket={bucket}
 */

import { defineEventHandler, getQuery, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { success, validationError } from "~/utils/response"
import { ERROR } from "@egographica/shared"

interface FileItem {
    id: string
    filename: string
    filetype: string
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
        .doc("files")
        .collection("items")
        .orderBy("created", "desc")
        .limit(50)
        .get()

    const files: FileItem[] = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
            id: doc.id,
            filename: data.filename || "Unknown",
            filetype: data.filetype || "file",
            created: data.created?.toDate() || new Date()
        }
    })

    return success(event, { files })
})
