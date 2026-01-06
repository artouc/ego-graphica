/**
 * ego Graphica - ペルソナスキーマ
 */

import { z } from "zod"

/** 理想的な応答例スキーマ */
export const sampleResponseSchema = z.object({
    situation: z.string().min(1, "状況説明を入力してください"),
    message: z.string().min(1, "顧客の発言例を入力してください"),
    response: z.string().min(1, "理想的な応答を入力してください")
})

/** ペルソナスキーマ */
export const personaSchema = z.object({
    character: z.string().optional(),
    motif: z.string().min(1, "モチーフを入力してください"),
    philosophy: z.string().optional(),
    influences: z.array(z.string()).min(1, "少なくとも1つの影響を受けた作家・文化を入力してください"),
    samples: z.array(sampleResponseSchema).min(1, "少なくとも1つの応答例を入力してください"),
    avoidances: z.array(z.string())
})

export type PersonaInput = z.infer<typeof personaSchema>
