/**
 * ego Graphica - 認証関連型定義
 */

/** 登録リクエスト */
export interface RegisterRequest {
    /** メールアドレス */
    email: string
    /** パスワード */
    password: string
    /** アーティスト名 */
    name: string
    /** バケット名（一意識別子） */
    bucket: string
}

/** 登録レスポンス */
export interface RegisterResponse {
    /** ユーザーID */
    uid: string
    /** カスタムトークン */
    token: string
    /** バケット名 */
    bucket: string
}

/** ログインリクエスト */
export interface LoginRequest {
    /** メールアドレス */
    email: string
    /** パスワード */
    password: string
}

/** ログインレスポンス */
export interface LoginResponse {
    /** ユーザーID */
    uid: string
    /** カスタムトークン */
    token: string
    /** バケット名 */
    bucket: string
}

/** トークン検証レスポンス */
export interface VerifyResponse {
    /** ユーザーID */
    uid: string
    /** メールアドレス */
    email: string
    /** バケット名 */
    bucket: string
}

/** 認証済みユーザー情報 */
export interface AuthUser {
    uid: string
    email: string
    bucket: string
}
