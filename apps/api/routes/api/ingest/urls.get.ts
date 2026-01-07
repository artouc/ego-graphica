/**
 * ego Graphica - URL一覧取得API
 * GET /api/ingest/urls?bucket={bucket}
 */

import { defineEventHandler, getQuery, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { success, validationError } from "~/utils/response"
import { ERROR } from "@egographica/shared"

interface UrlItem {
    id: string
    url: string
    title: string
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
        .doc("from-url")
        .collection("items")
        .orderBy("created", "desc")
        .limit(50)
        .get()

    const urls: UrlItem[] = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
            id: doc.id,
            url: data.url || "",
            title: data.title || data.url || "Unknown",
            created: data.created?.toDate() || new Date()
        }
    })

    return success(event, { urls })
})
