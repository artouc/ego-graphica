# BLUEPRINT 乖離分析

> `user/BLUEPRINT.md`（要件定義）と `llm/BLUEPRINT.md`（技術設計）の差分を整理

---

## 1. 命名規則の乖離

| 項目 | user/BLUEPRINT.md | llm/BLUEPRINT.md |
|------|-------------------|------------------|
| アーティスト識別子 | `${アーティストバケット名}` | `artistId` |
| エージェント呼称 | 「ego Graphicaエージェント」 | 「AI営業エージェント」「AIアシスタント」 |

**対応必要**: 命名を統一する

---

## 2. データ構造の乖離

### Firestoreコレクション

| user/BLUEPRINT.md | llm/BLUEPRINT.md | 状態 |
|-------------------|------------------|------|
| `${bucket}/` (ルートコレクション) | `artists/{artistId}` | **構造が異なる** |
| `${bucket}/works` | `works/{workId}` | **階層が異なる** |
| `${bucket}/from-url` | なし | **未実装** |
| `${bucket}/session` | `conversations/{conversationId}` | 名称異なる |
| `${bucket}/hearing` | なし | **未実装** |
| なし | `articles/{articleId}` | 追加機能 |
| なし | `podcasts/{podcastId}` | 追加機能 |
| なし | `quotes/{quoteId}` | 追加機能 |

### Firebase Storage

| user/BLUEPRINT.md | llm/BLUEPRINT.md | 状態 |
|-------------------|------------------|------|
| `/${bucket}/raw/` (フラット構造) | `artists/{artistId}/works/` | **パス構造が異なる** |

### Pinecone

| user/BLUEPRINT.md | llm/BLUEPRINT.md | 状態 |
|-------------------|------------------|------|
| Namespace: `${bucket}` | Namespace: `{artistId}` | 名称のみ異なる（実質同じ） |

---

## 3. 機能の乖離

### 未実装機能（user/BLUEPRINT.mdにあり、llm/BLUEPRINT.mdにない）

| 機能 | 説明 | 優先度 |
|------|------|--------|
| **URL提供画面** | URLスクレイピング → `from-url`コレクション | 高 |
| **ヒアリング画面** | アーティストフィードバック収集 → `hearing`コレクション | 高 |
| **PDF解析** | Claude Visual PDFsによるPDF内容抽出 | 中 |
| **販売状況管理** | 売却済/売約済/販売中/非売品 | 中 |
| **クライアント情報** | クライアントワーク/自主制作、クライアント名 | 中 |
| **制作ストーリー** | 作品ごとの制作背景 | 低 |

### 追加機能（llm/BLUEPRINT.mdにあり、user/BLUEPRINT.mdにない）

| 機能 | 説明 | 必要性 |
|------|------|--------|
| **ペルソナ設定** | tone, personality, artisticPhilosophy等 | 要確認 |
| **Tool Calling** | showPortfolio, generateQuote, checkAvailability等 | 要確認 |
| **見積もり機能** | 価格表、概算見積もり生成 | 要確認 |
| **記事(articles)** | ブログ・記事管理 | 要確認 |
| **ポッドキャスト分離** | 音声を独立コレクションで管理 | 要確認 |
| **マルチモーダルRAG** | 画像からの視覚的類似検索 | 要確認 |

---

## 4. 作品データモデルの乖離

### user/BLUEPRINT.md（要件）

```
- 作品データ（.png, .jpg, .wav, .mp4）
- タイトル
- 作成年月日
- クライアントワーク or 自主制作
- クライアント名
- 販売状況（売却済、売約済、販売中、非売品）
- 説明（自由記述）
- 制作ストーリー（自由記述）
```

### llm/BLUEPRINT.md（設計）

```
- images (WorkImage[])
- title, titleEn
- year
- category (WorkCategory)
- tags, styles
- description, descriptionEn
- medium（油彩、デジタル等）
- dimensions (width, height, unit)
- isForSale, price
- isCommissionable（類似作品依頼可否）
- isPublic, isFeatured
```

### 差分

| フィールド | user | llm | 対応 |
|-----------|------|-----|------|
| 作成年月日 | あり | `year`のみ | **月日が欠落** |
| クライアントワーク/自主制作 | あり | なし | **未実装** |
| クライアント名 | あり | なし | **未実装** |
| 販売状況（4種） | あり | `isForSale`（2種） | **粒度不足** |
| 制作ストーリー | あり | なし | **未実装** |
| .wav, .mp4対応 | あり | 画像のみ | **未実装** |
| medium | なし | あり | 追加 |
| dimensions | なし | あり | 追加 |
| isCommissionable | なし | あり | 追加 |
| 英語対応 | なし | あり | 追加 |

---

## 5. ファイル対応形式の乖離

### user/BLUEPRINT.md

| 形式 | 処理方法 |
|------|----------|
| `.pdf` | Claude Visual PDFs |
| `.mp3`, `.m4a`, `.wav` | gpt-4o-transcribe |
| `.jpg`, `.png` | Claude Vision |

### llm/BLUEPRINT.md

| 形式 | 処理方法 |
|------|----------|
| `.pdf` | **未対応** |
| `.mp3`, `.m4a`, `.wav` | whisper-1 |
| `.jpg`, `.png`, `.gif`, `.webp` | Claude Vision |
| `.mp4` | **未対応** |

### 差分

| 形式 | 状態 |
|------|------|
| PDF | **未実装** |
| MP4（動画） | **未実装** |
| 音声モデル | `gpt-4o-transcribe` → `whisper-1` に変更 |

---

## 6. 画面構成の乖離

### user/BLUEPRINT.md（6画面）

1. アーティスト登録画面
2. 情報提供画面（ファイルアップロード）
3. URL提供画面
4. データベース提供画面（作品管理）
5. エージェント会話画面
6. ヒアリング画面

### llm/BLUEPRINT.md（想定画面）

1. ダッシュボード（index.vue）
2. 作品管理（dashboard/works.vue）
3. ペルソナ設定（dashboard/persona.vue）
4. アーティストページ（artist/[id]/index.vue）
5. チャット画面（artist/[id]/chat.vue）

### 差分

| 画面 | 状態 |
|------|------|
| アーティスト登録画面 | **未設計** |
| 情報提供画面 | 作品アップロードのみ（PDF/URL未対応） |
| URL提供画面 | **未設計** |
| ヒアリング画面 | **未設計** |
| ペルソナ設定画面 | **追加**（要件になし） |

---

## 7. 対応優先度

### 高優先度（要件との乖離が大きい）

1. **URL提供画面の実装** - スクレイピング機能追加
2. **ヒアリング画面の実装** - フィードバック収集機能追加
3. **作品データモデル修正** - クライアント情報、販売状況、制作ストーリー追加
4. **PDF解析機能** - Claude Visual PDFs対応

### 中優先度

5. **アーティスト登録画面** - バケット自動生成フロー
6. **販売状況の4分類化** - 売却済/売約済/販売中/非売品
7. **動画対応** - .mp4ファイルの処理

### 低優先度（追加機能の要否確認）

8. ペルソナ設定機能の要否
9. Tool Calling（見積もり、スケジュール）の要否
10. 記事・ポッドキャスト分離の要否

---

## 8. 推奨アクション

1. **要件確認**: user/BLUEPRINT.mdの機能が全て必要か確認
2. **データモデル統一**: コレクション構造を要件に合わせて再設計
3. **優先度決定**: 未実装機能の実装順序を決定
4. **追加機能判断**: llm/BLUEPRINT.mdの追加機能を採用するか判断
