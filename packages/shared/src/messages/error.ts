/**
 * ego Graphica - エラーメッセージ定義
 */

export const ERROR = {
    // 認証エラー
    AUTH: {
        INVALID_CREDENTIALS: "メールアドレスまたはパスワードが正しくありません",
        EMAIL_ALREADY_EXISTS: "このメールアドレスは既に登録されています",
        BUCKET_ALREADY_EXISTS: "このバケット名は既に使用されています",
        INVALID_TOKEN: "認証トークンが無効です",
        TOKEN_EXPIRED: "認証トークンの有効期限が切れています",
        UNAUTHORIZED: "認証が必要です",
        FORBIDDEN: "この操作を行う権限がありません"
    },

    // バリデーションエラー
    VALIDATION: {
        REQUIRED_FIELD: "必須項目が入力されていません",
        INVALID_EMAIL: "有効なメールアドレスを入力してください",
        INVALID_PASSWORD: "パスワードは8文字以上で入力してください",
        INVALID_BUCKET: "バケット名は3〜32文字の英数字とハイフンのみ使用できます",
        INVALID_URL: "有効なURLを入力してください",
        INVALID_FILE_TYPE: "サポートされていないファイル形式です",
        FILE_TOO_LARGE: "ファイルサイズが大きすぎます"
    },

    // データ操作エラー
    DATA: {
        NOT_FOUND: "データが見つかりません",
        ALREADY_EXISTS: "データは既に存在します",
        CREATE_FAILED: "データの作成に失敗しました",
        UPDATE_FAILED: "データの更新に失敗しました",
        DELETE_FAILED: "データの削除に失敗しました"
    },

    // 外部サービスエラー
    SERVICE: {
        FIREBASE_ERROR: "Firebaseサービスでエラーが発生しました",
        PINECONE_ERROR: "Pineconeサービスでエラーが発生しました",
        OPENAI_ERROR: "OpenAIサービスでエラーが発生しました",
        ANTHROPIC_ERROR: "Anthropicサービスでエラーが発生しました",
        XAI_ERROR: "xAIサービスでエラーが発生しました",
        AI_PROVIDER_ERROR: "AIプロバイダーでエラーが発生しました",
        SCRAPING_FAILED: "URLのスクレイピングに失敗しました"
    },

    // システムエラー
    SYSTEM: {
        INTERNAL_ERROR: "内部エラーが発生しました",
        SERVICE_UNAVAILABLE: "サービスが一時的に利用できません",
        RATE_LIMIT_EXCEEDED: "リクエスト数が制限を超えました"
    }
} as const

/** エラーコード型 */
export type ErrorCode =
    | keyof typeof ERROR.AUTH
    | keyof typeof ERROR.VALIDATION
    | keyof typeof ERROR.DATA
    | keyof typeof ERROR.SERVICE
    | keyof typeof ERROR.SYSTEM
