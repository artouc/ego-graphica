/**
 * ego Graphica - APIレスポンスユーティリティ
 */

import { H3Event, createError, setResponseStatus } from "h3"
import type { ApiError, ApiResponse } from "@egographica/shared"

/** 成功レスポンスを返す */
export function success<T>(event: H3Event, data: T, status: number = 200): ApiResponse<T> {
    setResponseStatus(event, status)
    return { data }
}

/** エラーレスポンスを返す */
export function error(
    code: string,
    message: string,
    status: number = 400,
    details?: Record<string, unknown>
): never {
    throw createError({
        statusCode: status,
        data: {
            code,
            message,
            details
        } as ApiError
    })
}

/** 認証エラー */
export function unauthorized(message: string): never {
    error("UNAUTHORIZED", message, 401)
}

/** 権限エラー */
export function forbidden(message: string): never {
    error("FORBIDDEN", message, 403)
}

/** NotFoundエラー */
export function notFound(message: string): never {
    error("NOT_FOUND", message, 404)
}

/** バリデーションエラー */
export function validationError(message: string, details?: Record<string, unknown>): never {
    error("VALIDATION_ERROR", message, 400, details)
}

/** サーバーエラー */
export function serverError(message: string): never {
    error("INTERNAL_ERROR", message, 500)
}
