/**
 * ego Graphica - API共通型定義
 */

/** APIエラーレスポンス */
export interface ApiError {
    /** エラーコード */
    code: string
    /** エラーメッセージ */
    message: string
    /** 詳細情報 */
    details?: Record<string, unknown>
}

/** APIレスポンスラッパー */
export interface ApiResponse<T> {
    /** 成功時のデータ */
    data?: T
    /** エラー情報 */
    error?: ApiError
}

/** ページネーション情報 */
export interface Pagination {
    /** 総件数 */
    total: number
    /** ページサイズ */
    limit: number
    /** オフセット */
    offset: number
    /** 次ページ有無 */
    hasMore: boolean
}

/** ページネーション付きレスポンス */
export interface PaginatedResponse<T> {
    items: T[]
    pagination: Pagination
}
