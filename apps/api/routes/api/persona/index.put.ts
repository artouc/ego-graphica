/**
 * ego Graphica - ペルソナ保存API
 * PUT /api/persona
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { getFirestoreInstance } from "~/utils/firebase"
import { success, validationError } from "~/utils/response"
import { ERROR } from "@egographica/shared"
import type { Persona, SampleResponse } from "@egographica/shared"

interface RequestBody {
    bucket: string
    character?: string
    motif: string
    tone: string
    philosophy: string
    influences: string[]
    samples: SampleResponse[]
    avoidances: string[]
}

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.motif || !body.tone || !body.philosophy) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    const db = getFirestoreInstance()

    const persona: Persona = {
        character: body.character || undefined,
        motif: body.motif,
        tone: body.tone as Persona["tone"],
        philosophy: body.philosophy,
        influences: body.influences || [],
        samples: body.samples || [],
        avoidances: body.avoidances || []
    }

    await db.collection(body.bucket).doc("persona").set(persona)

    return success(event, { persona })
})
