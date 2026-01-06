/**
 * ego Graphica - アーティスト登録API
 * POST /api/auth/register
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getAuthInstance, getFirestoreInstance, getStorageInstance } from "~/utils/firebase"
import { initializePinecone } from "~/utils/pinecone"
import { success, validationError, serverError } from "~/utils/response"
import {
    ERROR,
    LOG,
    registerRequestSchema,
    type RegisterResponse
} from "@egographica/shared"

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody(event)

    const parsed = registerRequestSchema.safeParse(body)
    if (!parsed.success) {
        const errors = parsed.error.flatten().fieldErrors
        validationError(ERROR.VALIDATION.REQUIRED_FIELD, errors)
    }

    const { email, password, name, bucket } = parsed.data

    const db = getFirestoreInstance()
    const auth = getAuthInstance()

    const bucket_doc = await db.collection(bucket).doc("profile").get()
    if (bucket_doc.exists) {
        validationError(ERROR.AUTH.BUCKET_ALREADY_EXISTS)
    }

    let uid: string

    try {
        const existing_user = await auth.getUserByEmail(email).catch(() => null)
        if (existing_user) {
            validationError(ERROR.AUTH.EMAIL_ALREADY_EXISTS)
        }

        const user_record = await auth.createUser({
            email,
            password,
            displayName: name
        })
        uid = user_record.uid

        console.log(LOG.AUTH.USER_REGISTERED, { uid, email })
    } catch (e) {
        console.error("Failed to create user:", e)
        serverError(ERROR.SERVICE.FIREBASE_ERROR)
    }

    try {
        await db.collection("users").doc(uid).set({
            email,
            bucket,
            created: FieldValue.serverTimestamp()
        })

        await db.collection(bucket).doc("profile").set({
            name,
            bucket,
            created: FieldValue.serverTimestamp(),
            updated: FieldValue.serverTimestamp()
        })

        console.log(LOG.FIREBASE.FIRESTORE_CONNECTED, { bucket })
    } catch (e) {
        console.error("Failed to create Firestore documents:", e)
        await auth.deleteUser(uid)
        serverError(ERROR.DATA.CREATE_FAILED)
    }

    try {
        const storage = getStorageInstance()
        const storage_bucket = storage.bucket()
        const placeholder_path = `${bucket}/raw/.placeholder`
        await storage_bucket.file(placeholder_path).save("")

        console.log(LOG.FIREBASE.STORAGE_CONNECTED, { bucket })
    } catch (e) {
        console.error("Failed to initialize Storage:", e)
    }

    try {
        initializePinecone()
        console.log(LOG.PINECONE.INITIALIZED, { namespace: bucket })
    } catch (e) {
        console.error("Failed to initialize Pinecone:", e)
    }

    let token: string
    try {
        token = await auth.createCustomToken(uid, { bucket })
    } catch (e) {
        console.error("Failed to create custom token:", e)
        serverError(ERROR.SERVICE.FIREBASE_ERROR)
    }

    const response: RegisterResponse = {
        uid,
        token,
        bucket
    }

    return success(event, response, 201)
})
