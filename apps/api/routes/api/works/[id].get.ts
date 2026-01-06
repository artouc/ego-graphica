/**
 * ego Graphica - 作品詳細取得API
 * GET /api/works/:id?bucket=xxx
 */

import { defineEventHandler, getQuery, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { success, validationError, notFound } from "~/utils/response"
import { ERROR } from "@egographica/shared"

export default defineEventHandler(async (event: H3Event) => {
    const id = event.context.params?.id
    const query = getQuery(event)
    const bucket = query.bucket as string

    if (!bucket || !id) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const db = getFirestoreInstance()

    const doc = await db
        .collection(bucket)
        .doc("works")
        .collection("items")
        .doc(id)
        .get()

    if (!doc.exists) {
        notFound(ERROR.DATA.NOT_FOUND)
    }

    const data = doc.data()!

    return success(event, {
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
        created: data.created?.toDate?.()?.toISOString() || null,
        updated: data.updated?.toDate?.()?.toISOString() || null
    })
})
