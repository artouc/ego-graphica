/**
 * ego Graphica - 認証ミドルウェア
 */

import { defineEventHandler, getHeader, H3Event } from "h3"
import { getAuthInstance, getFirestoreInstance } from "~/utils/firebase"
import { unauthorized } from "~/utils/response"
import { ERROR, type AuthUser } from "@egographica/shared"

declare module "h3" {
    interface H3EventContext {
        auth?: AuthUser
    }
}

/** 認証が必要なパスかどうか判定 */
function requiresAuth(path: string): boolean {
    const public_paths = [
        "/api/auth/register",
        "/api/auth/login",
        "/api/health"
    ]
    return path.startsWith("/api/") && !public_paths.includes(path)
}

/** 認証ミドルウェア */
export default defineEventHandler(async (event: H3Event) => {
    const path = event.path

    if (!requiresAuth(path)) {
        return
    }

    const authorization = getHeader(event, "authorization")
    const api_key = getHeader(event, "x-api-key")
    const master_api_key = process.env.MASTER_API_KEY

    console.log("DEBUG:", { api_key, master_api_key, envKeys: Object.keys(process.env).filter(k => k.includes("MASTER")) })

    // マスターAPIキーによる認証
    if (api_key && master_api_key && api_key === master_api_key) {
        event.context.auth = {
            uid: "master",
            email: "master@egographica.local",
            bucket: getHeader(event, "x-bucket") || ""
        }
        return
    }

    if (!authorization || !authorization.startsWith("Bearer ")) {
        unauthorized(ERROR.AUTH.UNAUTHORIZED)
    }

    const token = authorization!.slice(7)

    try {
        const auth = getAuthInstance()
        const decoded = await auth.verifyIdToken(token)

        const db = getFirestoreInstance()
        const user_doc = await db.collection("users").doc(decoded.uid).get()

        if (!user_doc.exists) {
            unauthorized(ERROR.AUTH.INVALID_TOKEN)
        }

        const user_data = user_doc.data()

        event.context.auth = {
            uid: decoded.uid,
            email: decoded.email || "",
            bucket: user_data?.bucket || ""
        }
    } catch {
        unauthorized(ERROR.AUTH.INVALID_TOKEN)
    }
})
