# ego Graphica - ドキュメント間の乖離分析

> `user/BLUEPRINT.md`、`llm/REFACTOR.md`、`llm/BLUEPRINT.md` の3ファイルを比較

---

## 1. エージェントの役割定義

| ドキュメント | 定義 |
|-------------|------|
| user | 「顧客と会話するエージェント」 |
| REFACTOR | 「顧客と会話するエージェント」 |
| BLUEPRINT | 「営業を行う自律型AIエージェント」「顧客対応を自動化」 |

**乖離**: BLUEPRINTは「営業」機能を強調（見積もり生成、スケジュール確認等）

---

## 2. Firestoreコレクション構造

### user / REFACTOR（一致）
```
/{アーティストバケット名}/
├── profile
├── persona
├── works/{workId}
├── from-url/{urlId}
├── session/{sessionId}/messages/{messageId}
└── hearing/{hearingId}/messages/{messageId}
```

### BLUEPRINT（異なる）
```
artists/{artistId}
works/{workId}
articles/{articleId}
podcasts/{podcastId}
conversations/{conversationId}/messages/{messageId}
quotes/{quoteId}
```

**乖離**:
- コレクション名が異なる（`session` vs `conversations`、`from-url` vs `articles`）
- BLUEPRINTはバケット名によるネスト構造を採用していない
- BLUEPRINTには `quotes` コレクションが追加
- BLUEPRINTには `podcasts` コレクションが追加（user/REFACTORでは音声はファイルとして処理）

---

## 3. 音声文字起こしモデル

| ドキュメント | モデル |
|-------------|--------|
| user | `gpt-4o-transcribe` |
| REFACTOR | `gpt-4o-transcribe` |
| BLUEPRINT | `whisper-1` |

**乖離**: BLUEPRINTは旧モデル（whisper-1）を記載

---

## 4. Embedding次元数

| ドキュメント | 次元数 | モデル |
|-------------|--------|--------|
| user | 記載なし | 記載なし |
| REFACTOR | 3072 | `text-embedding-3-large` |
| BLUEPRINT | 1536 / 3072（混在） | `text-embedding-3-small` / `text-embedding-3-large`（混在） |

**乖離**: BLUEPRINTは一部で1536次元（text-embedding-3-small）の記載あり

---

## 5. Pinecone Index名

| ドキュメント | Index名 |
|-------------|---------|
| REFACTOR | `egographica` |
| BLUEPRINT | `ego-graphica`（ハイフン入り） |

**乖離**: 命名規則の不一致

---

## 6. Tool Calling定義

### user
- 「Function Calling等」のみ記載

### REFACTOR
- `showWorks`: 作品をグリッド表示
- `searchWorks`: セマンティック検索
- `visualSearch`: 色・スタイル・雰囲気で検索

### BLUEPRINT
- `showPortfolio`: ポートフォリオ表示
- `checkAvailability`: スケジュール確認
- `generateQuote`: 見積もり生成
- `showContactForm`: 問い合わせフォーム表示
- `searchWorks`: セマンティック検索

**乖離**:
- 命名が異なる（`showWorks` vs `showPortfolio`）
- BLUEPRINTには営業系ツール（見積もり、スケジュール、問い合わせ）が追加
- REFACTORにはBLUEPRINTにない `visualSearch` がある

---

## 7. API設計

### user
- 記載なし

### REFACTOR
| エンドポイント | 用途 |
|---------------|------|
| `/auth/register` | アーティスト登録 |
| `/auth/login` | ログイン |
| `/auth/verify` | トークン検証 |
| `/persona` | ペルソナ取得/更新 |
| `/chat` | エージェント会話 |
| `/hearing` | ヒアリング会話 |

### BLUEPRINT
| エンドポイント | 用途 |
|---------------|------|
| `/auth/login` | ログイン |
| `/auth/register` | 登録 |
| `/auth/verify` | トークン検証 |
| `/auth/refresh` | トークン更新 |
| `/artist/persona` | ペルソナ更新 |
| `/artist/[id]` | アーティスト取得 |

**乖離**:
- BLUEPRINTには `/auth/refresh` が追加
- ペルソナのパスが異なる（`/persona` vs `/artist/persona`）
- エンドポイント構造が異なる

---

## 8. 画面構成

### user / REFACTOR（一致）
1. アーティスト登録画面 `/register`
2. 情報提供画面（ファイル） `/dashboard/upload`
3. URL提供画面 `/dashboard/url`
4. データベース提供画面（作品管理） `/dashboard/works`
5. エージェント会話画面 `/agent/{bucket}`
6. ヒアリング画面 `/dashboard/hearing`
7. ペルソナ設定画面 `/dashboard/persona`（REFACTORで追加）

### BLUEPRINT
- `/artist/[id]/chat.vue`
- `/dashboard/works.vue`
- `/dashboard/persona.vue`
- 記事・ポッドキャスト管理画面の記載あり

**乖離**:
- パス構造が異なる（`/agent/{bucket}` vs `/artist/[id]/chat`）
- BLUEPRINTには記事・ポッドキャスト管理が独立

---

## 9. 追加機能の範囲

### user
- RAG, CAG, Function Calling（言及のみ）

### REFACTOR
- ペルソナ設定
- CAG（Context Augmented Generation）
- Tool Calling（showWorks, searchWorks, visualSearch）
- マルチモーダルRAG

### BLUEPRINT
上記に加えて:
- 見積もり生成・管理
- スケジュール/空き状況確認
- 問い合わせフォーム
- 価格表（PriceTable）
- 繁忙期管理（BusyPeriod）
- 会話フェーズ判定
- ハイブリッド検索
- クエリ拡張

**乖離**: BLUEPRINTには営業・ビジネス機能が多数含まれる（user要件外）

---

## 10. データモデル

### user / REFACTOR（一致）
- Profile
- Persona
- Work
- FromUrl
- Session / SessionMessage
- Hearing / HearingMessage
- ImageAnalysis（REFACTOR追加）

### BLUEPRINT
上記に加えて:
- Artist（Profile, Persona, Settingsを統合）
- AgentSettings
- PriceTable
- BusyPeriod
- Article
- Podcast
- Conversation / Message
- Quote / QuoteItem
- WorkCategory
- WorkImage

**乖離**: BLUEPRINTは営業機能に必要な型が多数追加

---

## 11. UIライブラリ

| ドキュメント | ライブラリ |
|-------------|-----------|
| user | 記載なし |
| REFACTOR | shadcn-vue |
| BLUEPRINT | CSS（シンプルに開始） |

**乖離**: UIライブラリの選定が異なる

---

## 12. 認証フロー

### user / REFACTOR
- 詳細記載なし

### BLUEPRINT
1. クライアント → API（ログインリクエスト）
2. API → Firebase Admin（検証/作成）
3. カスタムトークン発行
4. 以降Bearerトークン認証

**乖離**: BLUEPRINTのみ詳細な認証フローが定義

---

## 13. Pinecone Vector ID形式

### REFACTOR
```
work_{workId}
url_{urlId}
file_{fileId}
```

### BLUEPRINT
```
work_{workId}
article_{articleId}
podcast_{podcastId}
```

**乖離**: `url_` vs `article_`、`file_` vs `podcast_`

---

## 14. ディレクトリ構成

### REFACTOR
```
apps/api/utils/
├── ai/
├── db/
├── cag/        # CAG専用
├── rag/
├── scraper/
└── tools/
```

### BLUEPRINT
```
apps/api/utils/
├── ai/
├── db/
├── rag/
└── tools/
```
（`server/utils/` として記載される箇所も混在）

**乖離**:
- REFACTORには `cag/` ディレクトリがある
- REFACTORには `scraper/` ディレクトリがある
- BLUEPRINTはパス記載が `server/utils/` と `apps/api/utils/` で混在

---

## 15. 環境変数

### REFACTOR / BLUEPRINT（一致）
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- PINECONE_API_KEY
- PINECONE_INDEX
- FIREBASE_PROJECT_ID
- FIREBASE_CLIENT_EMAIL
- FIREBASE_PRIVATE_KEY
- NUXT_PUBLIC_API_URL
- WEB_URL

### BLUEPRINTのみ
- NUXT_PUBLIC_FIREBASE_API_KEY
- NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN
- NUXT_PUBLIC_FIREBASE_PROJECT_ID
- NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET

**乖離**: BLUEPRINTにはクライアント側Firebase設定が含まれる（firebase-adminのみ使用のREFACTORと矛盾）

---

## まとめ

### 優先度: 高（実装に直接影響）

| 項目 | 推奨対応 |
|------|----------|
| Firestoreコレクション構造 | user/REFACTOR を採用 |
| 音声文字起こしモデル | `gpt-4o-transcribe` を採用 |
| Embedding次元数 | 3072次元に統一 |
| Pinecone Index名 | `egographica` に統一 |
| Tool Calling定義 | REFACTOR を基準、必要に応じて拡張 |

### 優先度: 中（設計判断が必要）

| 項目 | 検討事項 |
|------|----------|
| 営業機能（見積もり等） | 採用するかユーザー確認が必要 |
| 記事・ポッドキャスト管理 | 採用するかユーザー確認が必要 |
| 認証フロー詳細 | BLUEPRINTの詳細設計を参考に |

### 優先度: 低（後から変更可能）

| 項目 | 備考 |
|------|------|
| UIライブラリ | shadcn-vue で進める |
| ディレクトリ構成 | REFACTORに従う |
