/**
 * ego Graphica - 作品一覧取得API
 * GET /api/works?bucket=xxx
 */

import { defineEventHandler, getQuery, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { success, validationError } from "~/utils/response"
import { ERROR } from "@egographica/shared"

export default defineEventHandler(async (event: H3Event) => {
    const query = getQuery(event)
    const bucket = query.bucket as string

    if (!bucket) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const db = getFirestoreInstance()

    const snapshot = await db
        .collection(bucket)
        .doc("works")
        .collection("items")
        .orderBy("created", "desc")
        .get()

    const works = snapshot.docs.map(doc => {
        const data = doc.data()
        return {
            id: data.id,
            url: data.url,
            filetype: data.filetype,
            title: data.title,
            date: data.date?.toDate?.()?.toISOString() || null,
            worktype: data.worktype,
            client: data.client,
            status: data.status,
            description: data.description,
            story: data.story,
            analysis: data.analysis,
            created: data.created?.toDate?.()?.toISOString() || null
        }
    })

    return success(event, { works })
})
