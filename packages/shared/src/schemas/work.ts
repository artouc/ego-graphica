/**
 * ego Graphica - 作品スキーマ
 */

import { z } from "zod"
import { FileType, SalesStatus, WorkType } from "../types/enums"

/** 作品作成スキーマ */
export const workCreateSchema = z.object({
    url: z.string().url("有効なURLを入力してください"),
    filetype: z.enum([FileType.PNG, FileType.JPG, FileType.WAV, FileType.MP4]),
    title: z.string().min(1, "タイトルを入力してください"),
    date: z.coerce.date(),
    worktype: z.enum([WorkType.CLIENT, WorkType.PERSONAL]),
    client: z.string().optional(),
    status: z.enum([
        SalesStatus.SOLD,
        SalesStatus.RESERVED,
        SalesStatus.AVAILABLE,
        SalesStatus.UNAVAILABLE
    ]),
    description: z.string().optional(),
    story: z.string().optional()
})

/** 作品更新スキーマ */
export const workUpdateSchema = z.object({
    title: z.string().min(1, "タイトルを入力してください").optional(),
    date: z.coerce.date().optional(),
    worktype: z.enum([WorkType.CLIENT, WorkType.PERSONAL]).optional(),
    client: z.string().optional(),
    status: z.enum([
        SalesStatus.SOLD,
        SalesStatus.RESERVED,
        SalesStatus.AVAILABLE,
        SalesStatus.UNAVAILABLE
    ]).optional(),
    description: z.string().optional(),
    story: z.string().optional()
})

export type WorkCreateInput = z.infer<typeof workCreateSchema>
export type WorkUpdateInput = z.infer<typeof workUpdateSchema>
