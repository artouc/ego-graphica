# 定義
1. 本プロジェクトの名前は「ego Graphica」であり、アーティストの代わりに営業を行う自律型AIエージェントを構築することが目的である。アーティストの作品、記事、ポッドキャスト音声等を学習し、アーティスト固有の思考パターンとペルソナを反映した顧客対応を実現する。
2. アーティストの代わりに営業・接客をするエージェントのことを「ego Graphicaエージェント」と呼ぶ。
3. スケーラビリティを考慮し複数のアーティストのデータを学習・保存・呼び出しできるデータモデル設計にする必要がある。
4. アーティストごとの一意識別子を「アーティストバケット名」と呼び、各種リソースの命名に使用する。

# 主要機能
- RAG: 作品・記事からの関連情報検索
- CAG: アーティストペルソナの文脈注入
- Tool Calling: 見積もり生成、スケジュール確認、ポートフォリオ表示
- Embedding: コンテンツのベクトル化・類似検索
- 音声文字起こし: ポッドキャスト等の音声コンテンツ処理
- Multimodal RAG: Claude Visionによる画像理解・視覚的類似検索

# 技術スタック

1. コア技術
- フレームワーク: Nuxt 4（SSR対応）
- バックエンド: Nitro Server（Vercel/Cloudflare対応）
- AI Chat UI: Vercel AI SDK（`@ai-sdk/vue`）
- UIライブラリ: shadcn-vue（レスポンシブ対応）
- バリデーション: Zod（ランタイムチェック）

2. LLM & AI
- メインLLM: Claude 4.5 Opus（`claude-opus-4-5`）
- PDF解析: Claude Visual PDFs（`claude-opus-4-5`）
- 画像解析: Claude Vision（`claude-opus-4-5`）
- 音声文字起こし: OpenAI（`gpt-4o-transcribe`）
- Embedding: OpenAI（`text-embedding-3-large`、3072次元）

3. データベース & ストレージ
- Vector DB: Pinecone（Serverless GCP、3072次元）
- メタデータDB: Firestore（firebase-admin経由）
- ファイル保存: Firebase Storage（firebase-admin経由）
- 認証: Firebase Auth（firebase-admin経由）
- クライアント側にFirebase SDKは使用しない。すべてのFirebase操作はAPIサーバー（firebase-admin）経由で行う。

4. インフラ & デプロイ
- ホスティング: Vercel（Nuxt/Nitroネイティブ対応）
- CDN: Vercel Edge Network

# データ構造

1. Firestoreコレクション
- `/{アーティストバケット名}/profile`: アーティスト基本情報
- `/{アーティストバケット名}/persona`: ペルソナ設定
- `/{アーティストバケット名}/works/{workId}`: 作品データ
- `/{アーティストバケット名}/from-url/{urlId}`: スクレイピングデータ
- `/{アーティストバケット名}/session/{sessionId}/messages/{messageId}`: エージェント会話履歴
- `/{アーティストバケット名}/hearing/{hearingId}/messages/{messageId}`: ヒアリング履歴

2. Firebase Storage
- `/{アーティストバケット名}/raw/`: 元ファイル（フラット構造、元ファイル名維持）

3. Pinecone
- Index名: `egographica`
- Namespace: `{アーティストバケット名}`
- Vector ID形式: `work_{workId}`, `url_{urlId}`, `file_{fileId}`

# UXフロー

1. アーティスト登録画面
- パス: `/register`
- アーティスト名とバケット名を入力するフォームを用意（バケット名は自動生成オプションあり）
- Firebase Storageに`/${アーティストバケット名}/`というフォルダが作成され、Pineconeに`${アーティストバケット名}`というNamespaceが作成され、Firestore Databaseに`/${アーティストバケット名}/profile`ドキュメントが作成される

2. 情報提供画面
- パス: `/dashboard/upload`
- `.pdf`、`.mp3`、`.m4a`、`.wav`、`.jpg`、`.png`をアップロードできるフォームを用意
- PDFデータの場合Claude Visual PDFsを用いて解析
- 画像データの場合Claude Visionを用いて解析
- 音声データの場合`gpt-4o-transcribe`を用いて解析
- 解析したデータはPineconeの`${アーティストバケット名}`Namespaceに格納
- 元データは元のファイル名を維持したままFirebase Storageの`/${アーティストバケット名}/raw/`内に階層構造を作らず格納

3. URL提供画面
- パス: `/dashboard/url`
- URLをインプットできるフォームを用意
- 内容をスクレイピングし本文を検出したのち、Firestore Databaseの`/${アーティストバケット名}/from-url/{urlId}`に格納
- Embedding生成後、Pineconeに保存
- スクレイピングに失敗した場合は失敗した旨のエラーをスロー

4. データベース提供画面
- パス: `/dashboard/works`
- 作品データ（`.png`、`.jpg`、`.wav`、`.mp4`に対応）・タイトル・作成年月日・クライアントワーク or 自主制作・クライアント名・販売状況（売却済、売約済、販売中、非売品）・説明（自由記述）・制作ストーリー（自由記述）をインプットできるフォームを用意
- 画像/動画の場合はClaude Visionで解析（マルチモーダルRAG）
- 内容をFirestore Databaseの`/${アーティストバケット名}/works/{workId}`に格納
- Embedding生成後、Pineconeに保存

5. エージェント会話画面
- パス: `/agent/{bucket}`
- RAG, CAG, Tool Calling等を用いたego Graphicaエージェントとの会話ができる画面を用意
- 会話履歴は全てFirestore Databaseの`/${アーティストバケット名}/session/{sessionId}/messages/{messageId}`に格納
- 過去のセッションを選択して会話の続きを行えるように

6. ヒアリング画面
- パス: `/dashboard/hearing`
- Claude 4.5 Opusと対話できる画面を用意
- アーティストが実際にego Graphicaエージェントと対話した際に発生した違和感等をヒアリングできるように
- 会話履歴は全てFirestore Databaseの`/${アーティストバケット名}/hearing/{hearingId}/messages/{messageId}`に格納
- 過去のセッションを選択して会話の続きを行えるように

7. ペルソナ設定画面
- パス: `/dashboard/persona`
- アーティスト固有の話し方・思考パターンを定義するフォームを用意
- 設定項目: キャラクター名、モチーフ、トーン（丁寧/フレンドリー/芸術的/プロフェッショナル/遊び心）、創作哲学、影響を受けた作家・文化、理想的な応答例、避けるべきトピック
- 内容をFirestore Databaseの`/${アーティストバケット名}/persona`に格納

# API設計

1. 認証
- `POST /auth/register`: アーティスト登録
- `POST /auth/login`: ログイン
- `GET /auth/verify`: トークン検証

2. ファイル・データ
- `POST /ingest/file`: ファイルアップロード（PDF/音声/画像）
- `POST /ingest/url`: URLスクレイピング
- `POST /ingest/work`: 作品登録
- `GET /works`: 作品一覧取得
- `PUT /works/{id}`: 作品更新
- `DELETE /works/{id}`: 作品削除

3. チャット
- `POST /chat`: エージェント会話（ストリーミング）
- `GET /sessions`: セッション一覧
- `GET /sessions/{id}`: セッション詳細・メッセージ取得

4. ヒアリング
- `POST /hearing`: ヒアリング会話
- `GET /hearings`: ヒアリング一覧
- `GET /hearings/{id}`: ヒアリング詳細・メッセージ取得

5. ペルソナ
- `GET /persona`: ペルソナ取得
- `PUT /persona`: ペルソナ更新

# 認証フロー
1. クライアント（Nuxt）からAPIサーバー（Nitro）にログインリクエスト（メール/パスワード）を送信
2. APIサーバーがFirebase Adminでユーザーを検証または作成
3. Firebase AdminがカスタムトークンをAPIサーバーに返却
4. APIサーバーがトークンをクライアントに返却
5. クライアントが以降のAPIリクエストでBearerトークンを付与
6. APIサーバーがFirebase Adminでトークンを検証
7. Firebase Adminがユーザー情報を返却
8. APIサーバーがレスポンスをクライアントに返却

# 追加機能

1. CAG（Context Augmented Generation）
- ペルソナ設定をシステムプロンプトに注入し、一貫したキャラクター性を持つ応答を生成する
- Firestore `/{bucket}/persona` からペルソナ設定を取得し、RAGで取得した関連コンテンツと統合してシステムプロンプトを動的に構築

2. Tool Calling
- `showPortfolio`: 作品ポートフォリオを表示（カテゴリ、スタイル、件数、代表作フィルタ）
- `checkAvailability`: スケジュール空き状況を確認（月、プロジェクトタイプ）
- `generateQuote`: 概算見積もりを生成（プロジェクトタイプ、説明、数量、急ぎ対応）
- `showContactForm`: 問い合わせフォームを表示（事前入力データ）
- `searchWorks`: キーワードや要望に合った作品を検索（RAGベース）

3. マルチモーダルRAG
- 画像をClaude Visionで解析し、視覚的特徴（色、構図、スタイル、雰囲気等）をテキスト化してEmbedding
- 「青い絵ある？」→ colorsでフィルタリング + セマンティック検索
- 画像添付「こんな感じで」→ 画像解析 → 類似作品検索

# 環境変数
- `ANTHROPIC_API_KEY`: Claude API認証
- `OPENAI_API_KEY`: Embedding & gpt-4o-transcribe認証
- `PINECONE_API_KEY`: Pinecone API認証
- `PINECONE_INDEX`: Pineconeインデックス名（`egographica`）
- `FIREBASE_PROJECT_ID`: FirebaseプロジェクトID
- `FIREBASE_CLIENT_EMAIL`: Firebase Adminサービスアカウント
- `FIREBASE_PRIVATE_KEY`: Firebase Admin秘密鍵
- `NUXT_PUBLIC_API_URL`: APIサーバーURL
- `WEB_URL`: WebアプリURL

# 実装優先度

Phase 1: 基盤構築
1. アーティスト登録画面・API
2. Firestore/Storage/Pinecone初期化処理
3. 認証フロー

Phase 2: データ取り込み
4. 情報提供画面（ファイルアップロード）
5. PDF解析（Claude Visual PDFs）
6. 音声文字起こし（gpt-4o-transcribe）
7. 画像解析（Claude Vision）
8. URL提供画面（スクレイピング）

Phase 3: 作品管理
9. データベース提供画面（作品CRUD）
10. 作品データモデル実装

Phase 4: エージェント
11. エージェント会話画面
12. RAG検索実装
13. ペルソナ設定画面・API
14. CAG実装
15. Tool Calling実装
16. マルチモーダルRAG

Phase 5: フィードバック
17. ヒアリング画面
