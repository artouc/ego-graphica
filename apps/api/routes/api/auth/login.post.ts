/**
 * ego Graphica - ログインAPI
 * POST /api/auth/login
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { getAuthInstance, getFirestoreInstance } from "~/utils/firebase"
import { success, validationError, unauthorized, serverError } from "~/utils/response"
import {
    ERROR,
    LOG,
    loginRequestSchema,
    type LoginResponse
} from "@egographica/shared"

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody(event)

    const parsed = loginRequestSchema.safeParse(body)
    if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors
        validationError(ERROR.VALIDATION.REQUIRED_FIELD, errors)
    }

    const { email, password: _password } = parsed.data

    const auth = getAuthInstance()
    const db = getFirestoreInstance()

    let uid: string

    try {
        const user_record = await auth.getUserByEmail(email)
        uid = user_record.uid
    } catch {
        unauthorized(ERROR.AUTH.INVALID_CREDENTIALS)
    }

    const user_doc = await db.collection("users").doc(uid).get()
    if (!user_doc.exists) {
        unauthorized(ERROR.AUTH.INVALID_CREDENTIALS)
    }

    const user_data = user_doc.data()
    const bucket = user_data?.bucket

    if (!bucket) {
        serverError(ERROR.DATA.NOT_FOUND)
    }

    let token: string
    try {
        token = await auth.createCustomToken(uid, { bucket })
        console.log(LOG.AUTH.USER_LOGGED_IN, { uid, email })
    } catch (e) {
        console.error("Failed to create custom token:", e)
        serverError(ERROR.SERVICE.FIREBASE_ERROR)
    }

    const response: LoginResponse = {
        uid,
        token,
        bucket
    }

    return success(event, response)
})
