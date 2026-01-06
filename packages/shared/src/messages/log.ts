/**
 * ego Graphica - ログメッセージ定義
 */

export const LOG = {
    // サーバー起動
    SERVER: {
        STARTING: "サーバーを起動しています...",
        STARTED: "サーバーが起動しました",
        STOPPING: "サーバーを停止しています...",
        STOPPED: "サーバーが停止しました"
    },

    // Firebase
    FIREBASE: {
        INITIALIZING: "Firebase Adminを初期化しています...",
        INITIALIZED: "Firebase Adminが初期化されました",
        FIRESTORE_CONNECTED: "Firestoreに接続しました",
        STORAGE_CONNECTED: "Firebase Storageに接続しました"
    },

    // Pinecone
    PINECONE: {
        INITIALIZING: "Pineconeを初期化しています...",
        INITIALIZED: "Pineconeが初期化されました",
        INDEX_CONNECTED: "Pineconeインデックスに接続しました"
    },

    // 認証
    AUTH: {
        USER_REGISTERED: "ユーザーが登録されました",
        USER_LOGGED_IN: "ユーザーがログインしました",
        TOKEN_VERIFIED: "トークンが検証されました"
    },

    // データ処理
    DATA: {
        FILE_UPLOADING: "ファイルをアップロードしています...",
        FILE_UPLOADED: "ファイルがアップロードされました",
        FILE_PROCESSING: "ファイルを処理しています...",
        FILE_PROCESSED: "ファイルの処理が完了しました",
        URL_SCRAPING: "URLをスクレイピングしています...",
        URL_SCRAPED: "URLのスクレイピングが完了しました",
        READABILITY_FALLBACK: "Readabilityで本文抽出できないためフォールバック処理を実行",
        EMBEDDING_GENERATING: "Embeddingを生成しています...",
        EMBEDDING_GENERATED: "Embeddingの生成が完了しました",
        VECTOR_UPSERTING: "ベクトルをUpsertしています...",
        VECTOR_UPSERTED: "ベクトルのUpsertが完了しました"
    },

    // AI処理
    AI: {
        VISION_ANALYZING: "画像を解析しています...",
        VISION_ANALYZED: "画像の解析が完了しました",
        PDF_ANALYZING: "PDFを解析しています...",
        PDF_ANALYZED: "PDFの解析が完了しました",
        AUDIO_TRANSCRIBING: "音声を文字起こししています...",
        AUDIO_TRANSCRIBED: "音声の文字起こしが完了しました",
        CHAT_GENERATING: "応答を生成しています...",
        CHAT_GENERATED: "応答の生成が完了しました",
        STYLE_ANALYZING: "文体を分析しています...",
        STYLE_ANALYZED: "文体の分析が完了しました",
        STYLE_SAMPLES_EXTRACTING: "サンプル文を抽出しています...",
        STYLE_SAMPLES_EXTRACTED: "サンプル文の抽出が完了しました"
    },

    // 作品
    WORK: {
        CREATING: "作品を登録しています...",
        CREATED: "作品が登録されました",
        UPDATING: "作品を更新しています...",
        UPDATED: "作品が更新されました",
        DELETING: "作品を削除しています...",
        DELETED: "作品が削除されました"
    }
} as const
