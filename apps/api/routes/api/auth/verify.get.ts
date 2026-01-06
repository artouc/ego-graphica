/**
 * ego Graphica - トークン検証API
 * GET /api/auth/verify
 */

import { defineEventHandler, getHeader, H3Event } from "h3"
import { getAuthInstance, getFirestoreInstance } from "~/utils/firebase"
import { success, unauthorized, serverError } from "~/utils/response"
import {
    ERROR,
    LOG,
    type VerifyResponse
} from "@egographica/shared"

export default defineEventHandler(async (event: H3Event) => {
    const authorization = getHeader(event, "authorization")

    if (!authorization || !authorization.startsWith("Bearer ")) {
        unauthorized(ERROR.AUTH.UNAUTHORIZED)
    }

    const token = authorization.slice(7)

    const auth = getAuthInstance()
    const db = getFirestoreInstance()

    let uid: string
    let email: string

    try {
        const decoded = await auth.verifyIdToken(token)
        uid = decoded.uid
        email = decoded.email || ""
        console.log(LOG.AUTH.TOKEN_VERIFIED, { uid })
    } catch {
        unauthorized(ERROR.AUTH.INVALID_TOKEN)
    }

    const user_doc = await db.collection("users").doc(uid).get()
    if (!user_doc.exists) {
        serverError(ERROR.DATA.NOT_FOUND)
    }

    const user_data = user_doc.data()
    const bucket = user_data?.bucket

    if (!bucket) {
        serverError(ERROR.DATA.NOT_FOUND)
    }

    const response: VerifyResponse = {
        uid,
        email,
        bucket
    }

    return success(event, response)
})
