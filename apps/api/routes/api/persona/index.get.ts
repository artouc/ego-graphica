/**
 * ego Graphica - ペルソナ取得API
 * GET /api/persona?bucket=xxx
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

    const doc = await db.collection(bucket).doc("persona").get()

    if (!doc.exists) {
        return success(event, { persona: null })
    }

    return success(event, { persona: doc.data() })
})
