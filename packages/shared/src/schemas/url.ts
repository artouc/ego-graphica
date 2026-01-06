/**
 * ego Graphica - URLスキーマ
 */

import { z } from "zod"

/** URL入力スキーマ */
export const urlInputSchema = z.object({
    url: z.string().url("有効なURLを入力してください")
})

export type UrlInput = z.infer<typeof urlInputSchema>
