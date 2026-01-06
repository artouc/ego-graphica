/**
 * ego Graphica - 認証スキーマ
 */

import { z } from "zod"

/** バケット名のバリデーション（3〜32文字、英数字とハイフンのみ） */
export const bucketSchema = z
    .string()
    .min(3, "バケット名は3文字以上で入力してください")
    .max(32, "バケット名は32文字以下で入力してください")
    .regex(/^[a-z0-9-]+$/, "バケット名は英小文字、数字、ハイフンのみ使用できます")

/** メールアドレスのバリデーション */
export const emailSchema = z
    .string()
    .email("有効なメールアドレスを入力してください")

/** パスワードのバリデーション */
export const passwordSchema = z
    .string()
    .min(8, "パスワードは8文字以上で入力してください")

/** アーティスト名のバリデーション */
export const nameSchema = z
    .string()
    .min(1, "アーティスト名を入力してください")
    .max(100, "アーティスト名は100文字以下で入力してください")

/** 登録リクエストスキーマ */
export const registerRequestSchema = z.object({
    email: emailSchema,
    password: passwordSchema,
    name: nameSchema,
    bucket: bucketSchema
})

/** ログインリクエストスキーマ */
export const loginRequestSchema = z.object({
    email: emailSchema,
    password: passwordSchema
})

export type RegisterRequestInput = z.infer<typeof registerRequestSchema>
export type LoginRequestInput = z.infer<typeof loginRequestSchema>
