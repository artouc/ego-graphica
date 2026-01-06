/**
 * ego Graphica - ペルソナ保存API
 * PUT /api/persona
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { invalidateCache, InvalidationType } from "~/utils/cag"
import { success, validationError } from "~/utils/response"
import { ERROR, AIProvider } from "@egographica/shared"
import type { Persona, SampleResponse } from "@egographica/shared"

interface RequestBody {
    bucket: string
    character?: string
    motif: string
    philosophy?: string
    influences: string[]
    samples: SampleResponse[]
    avoidances: string[]
    provider?: string
}

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.motif) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const db = getFirestoreInstance()

    const persona: Partial<Persona> = {
        motif: body.motif,
        influences: body.influences || [],
        samples: body.samples || [],
        avoidances: body.avoidances || []
    }

    if (body.character) {
        persona.character = body.character
    }
    if (body.philosophy) {
        persona.philosophy = body.philosophy
    }
    if (body.provider && body.provider === AIProvider.CLAUDE) {
        persona.provider = body.provider
    }

    await db.collection(body.bucket).doc("persona").set(persona)

    // CAGキャッシュを無効化（ペルソナのみ）
    await invalidateCache(body.bucket, InvalidationType.PERSONA_ONLY)

    return success(event, { persona })
})
