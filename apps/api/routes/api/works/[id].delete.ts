/**
 * ego Graphica - 作品削除API
 * DELETE /api/works/:id?bucket=xxx
 */

import { defineEventHandler, getQuery, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { deleteVectors } from "~/utils/pinecone"
import { success, validationError, notFound } from "~/utils/response"
import { LOG, ERROR } from "@egographica/shared"

export default defineEventHandler(async (event: H3Event) => {
    const id = event.context.params?.id
    const query = getQuery(event)
    const bucket = query.bucket as string

    if (!bucket || !id) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    console.log(LOG.WORK.DELETING, { bucket, id })

    const db = getFirestoreInstance()

    const doc_ref = db
        .collection(bucket)
        .doc("works")
        .collection("items")
        .doc(id)

    const doc = await doc_ref.get()

    if (!doc.exists) {
        notFound(ERROR.DATA.NOT_FOUND)
    }

    await doc_ref.delete()

    try {
        await deleteVectors(bucket, [`work_${id}`])
    } catch (e) {
        console.error("Pinecone delete failed:", e)
    }

    console.log(LOG.WORK.DELETED, { id })

    return success(event, { deleted: true })
})
