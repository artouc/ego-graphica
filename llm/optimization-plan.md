# CAG & Tool Calling 最適化計画

## 概要
ego GraphicaのChat API（特にCAGとTool Calling）のパフォーマンス最適化

---

## 発見された問題点

### CAG (Cache Augmented Generation)

| 問題 | 重要度 | 影響 |
|------|--------|------|
| キャッシュウォーミングがない | 高 | 初回リクエストが2-3秒遅延 |
| 過度に保守的な無効化 | 高 | 小さな変更で全キャッシュクリア |
| buildRagSummaryが逐次実行 | 中 | 3つのFirestoreクエリが直列 |
| ベクター検索結果キャッシュなし | 中 | 同じクエリで毎回Pinecone呼び出し |
| LRUキャッシュ未実装 | 低 | メモリ自動解放なし |
| エラーハンドリングがサイレント | 中 | 失敗を検知できない |

### Tool Calling

| 問題 | 重要度 | 影響 |
|------|--------|------|
| generateQuoteがスタブ実装 | 高 | 機能として動作しない |
| ツール実行の並列化なし | 中 | 独立したツールも直列実行 |
| リトライロジックなし | 中 | 一時的な障害で失敗 |
| 型安全性の問題 | 低 | `as`キャストで実行時エラーリスク |
| ストリーミング未対応 | 中 | 全レスポンス待機が必要 |

### Chat API 全体

| 問題 | 重要度 | 影響 |
|------|--------|------|
| Embedding毎回生成 | 高 | CAGキャッシュヒットでもAPI呼び出し |
| セッション履歴キャッシュなし | 高 | 毎リクエストでFirestore読み込み |
| トークンカウントなし | 高 | オーバーフローでランタイムエラー |
| 並列実行の機会逸失 | 中 | 200-300ms無駄な待機 |
| ハードコード制限値 | 低 | 柔軟性なし (20, 5, 50) |

---

## 最適化計画

### Phase 1: Quick Wins（即効性高い）

#### 1.1 buildRagSummaryの並列化
**ファイル**: `apps/api/utils/cag.ts`

```typescript
// 現在: 逐次実行
const works = await db.collection(bucket).doc("works")...
const files = await db.collection(bucket).doc("files")...
const urls = await db.collection(bucket).doc("urls")...

// 改善: Promise.all で並列化
const [works_snapshot, files_snapshot, urls_snapshot] = await Promise.all([
    db.collection(bucket).doc("works").collection("items")
        .orderBy("created", "desc").limit(50).get(),
    db.collection(bucket).doc("files").collection("items")
        .orderBy("created", "desc").limit(20).get(),
    db.collection(bucket).doc("urls").collection("items")
        .orderBy("created", "desc").limit(20).get()
])
```

#### 1.2 選択的キャッシュ無効化
**ファイル**: `apps/api/utils/cag.ts`

```typescript
export enum InvalidationType {
    PERSONA_ONLY = "persona",
    RAG_SUMMARY = "rag_summary",
    FULL = "full"
}

export function invalidateCache(
    bucket: string,
    type: InvalidationType = InvalidationType.FULL
): void {
    const cached = cache.get(bucket)
    if (!cached) return

    switch (type) {
        case InvalidationType.PERSONA_ONLY:
            cached.persona = null
            break
        case InvalidationType.RAG_SUMMARY:
            cached.rag_summary = ""
            break
        case InvalidationType.FULL:
            cache.delete(bucket)
    }
}
```

#### 1.3 Embedding生成の条件分岐
**ファイル**: `apps/api/routes/api/chat/index.post.ts`

```typescript
// キーワード検出によるリアルタイムRAG必要性判定
function shouldUseRealtimeRag(message: string): boolean {
    const search_keywords = ["探して", "検索", "見つけて", "作品", "ポートフォリオ", "過去の"]
    return search_keywords.some(kw => message.includes(kw))
}

let realtime_context = ""
if (!cached || shouldUseRealtimeRag(body.message)) {
    const query_embedding = await generateEmbedding(body.message)
    const results = await queryVectors(body.bucket, query_embedding, 5)
    realtime_context = results.map((r, i) =>
        `[${i + 1}] ${r.metadata.title}\n${r.metadata.text}`
    ).join("\n\n")
}
```

### Phase 2: キャッシュ強化

#### 2.1 セッション履歴のインメモリキャッシュ
**ファイル**: `apps/api/utils/session-cache.ts`（新規）

```typescript
interface CachedSession {
    messages: Array<{ role: string; content: string }>
    cached_at: Date
}

const session_cache = new Map<string, CachedSession>()
const SESSION_CACHE_TTL = 60 * 1000 // 1分

export function getCachedSessionHistory(session_id: string): CachedSession | null {
    const cached = session_cache.get(session_id)
    if (!cached) return null

    const age = Date.now() - cached.cached_at.getTime()
    if (age > SESSION_CACHE_TTL) {
        session_cache.delete(session_id)
        return null
    }
    return cached
}

export function updateSessionCache(
    session_id: string,
    messages: Array<{ role: string; content: string }>
): void {
    session_cache.set(session_id, {
        messages,
        cached_at: new Date()
    })
}

export function appendToSessionCache(
    session_id: string,
    message: { role: string; content: string }
): void {
    const cached = session_cache.get(session_id)
    if (cached) {
        cached.messages.push(message)
        cached.cached_at = new Date()
    }
}

export function invalidateSessionCache(session_id: string): void {
    session_cache.delete(session_id)
}
```

#### 2.2 ベクター検索結果キャッシュ
**ファイル**: `apps/api/utils/vector-cache.ts`（新規）

```typescript
import crypto from "crypto"

interface CachedVectorResults {
    results: Array<{
        id: string
        score: number
        metadata: Record<string, unknown>
    }>
    cached_at: Date
}

const vector_cache = new Map<string, CachedVectorResults>()
const VECTOR_CACHE_TTL = 5 * 60 * 1000 // 5分

function hashEmbedding(embedding: number[]): string {
    // 最初の10個の値でハッシュ生成（近似マッチング用）
    const signature = embedding.slice(0, 10).map(v => Math.round(v * 1000)).join(",")
    return crypto.createHash("md5").update(signature).digest("hex").slice(0, 16)
}

export function getCachedVectorResults(
    bucket: string,
    embedding: number[]
): CachedVectorResults | null {
    const key = `${bucket}:${hashEmbedding(embedding)}`
    const cached = vector_cache.get(key)

    if (!cached) return null

    const age = Date.now() - cached.cached_at.getTime()
    if (age > VECTOR_CACHE_TTL) {
        vector_cache.delete(key)
        return null
    }
    return cached
}

export function setVectorCache(
    bucket: string,
    embedding: number[],
    results: CachedVectorResults["results"]
): void {
    const key = `${bucket}:${hashEmbedding(embedding)}`
    vector_cache.set(key, {
        results,
        cached_at: new Date()
    })
}

export function invalidateVectorCache(bucket: string): void {
    for (const key of vector_cache.keys()) {
        if (key.startsWith(`${bucket}:`)) {
            vector_cache.delete(key)
        }
    }
}
```

### Phase 3: Tool Calling改善

#### 3.1 generateQuote実装
**ファイル**: `apps/api/routes/api/chat/index.post.ts`

```typescript
generateQuote: tool({
    description: "見積もりを生成",
    parameters: z.object({
        project_type: z.string().describe("プロジェクトの種類"),
        description: z.string().describe("詳細な説明"),
        urgent: z.boolean().optional().describe("緊急かどうか")
    }),
    execute: async ({ project_type, description, urgent }) => {
        // 基本価格テーブル
        const base_prices: Record<string, { min: number; max: number }> = {
            "イラスト": { min: 30000, max: 100000 },
            "ロゴデザイン": { min: 50000, max: 200000 },
            "キャラクターデザイン": { min: 80000, max: 300000 },
            "その他": { min: 20000, max: 150000 }
        }

        const price_range = base_prices[project_type] || base_prices["その他"]
        const multiplier = urgent ? 1.5 : 1.0

        return {
            project_type,
            description,
            urgent: urgent || false,
            estimate_range: {
                min: Math.round(price_range.min * multiplier),
                max: Math.round(price_range.max * multiplier)
            },
            factors: [
                "複雑さ",
                "納期",
                "修正回数",
                "商用利用の有無"
            ],
            note: "正式なお見積もりは詳細をお聞きした上でご提示します",
            contact_required: true
        }
    }
})
```

### Phase 4: 安全性・監視

#### 4.1 トークンカウント
**ファイル**: `apps/api/utils/token-counter.ts`（新規）

```typescript
// Claude/GPT互換のトークン概算（正確ではないが高速）
// 日本語: 約1.5文字/トークン、英語: 約4文字/トークン

export function estimateTokens(text: string): number {
    const japanese_chars = (text.match(/[\u3000-\u9fff]/g) || []).length
    const other_chars = text.length - japanese_chars

    return Math.ceil(japanese_chars / 1.5 + other_chars / 4)
}

export function truncateToTokenLimit(
    messages: Array<{ role: string; content: string }>,
    max_tokens: number,
    reserve_tokens: number = 4000 // レスポンス用に予約
): Array<{ role: string; content: string }> {
    const available = max_tokens - reserve_tokens
    let total = 0
    const result: Array<{ role: string; content: string }> = []

    // 新しいメッセージから優先
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]
        const tokens = estimateTokens(msg.content)

        if (total + tokens > available) {
            break
        }

        total += tokens
        result.unshift(msg)
    }

    return result
}

export function getContextTokenBudget(provider: string): number {
    // プロバイダー別のコンテキストウィンドウ
    const budgets: Record<string, number> = {
        "claude": 200000,
        "grok": 131072
    }
    return budgets[provider] || 100000
}
```

---

## 実装優先順位

1. **Phase 1.1**: buildRagSummary並列化（即効性高、低リスク）
2. **Phase 1.2**: 選択的キャッシュ無効化（中程度の変更）
3. **Phase 2.1**: セッション履歴キャッシュ（高効果）
4. **Phase 1.3**: Embedding条件分岐（コスト削減）
5. **Phase 4.1**: トークンカウント（安全性）
6. **Phase 2.2**: ベクター検索キャッシュ（中程度の効果）
7. **Phase 3**: Tool Calling改善（機能拡張）

---

## 変更対象ファイル

| ファイル | 変更内容 |
|----------|----------|
| `apps/api/utils/cag.ts` | 並列化、選択的無効化 |
| `apps/api/routes/api/chat/index.post.ts` | Embedding条件分岐、トークン制限 |
| `apps/api/utils/session-cache.ts` | 新規作成 |
| `apps/api/utils/vector-cache.ts` | 新規作成 |
| `apps/api/utils/token-counter.ts` | 新規作成 |
| `apps/api/routes/api/persona/index.put.ts` | 選択的無効化対応 |
| `apps/api/routes/api/works/*.ts` | 選択的無効化対応 |
| `apps/api/routes/api/ingest/*.ts` | 選択的無効化対応 |

---

## 期待される改善効果

| 最適化 | 改善効果 |
|--------|----------|
| buildRagSummary並列化 | キャッシュミス時 200-300ms 短縮 |
| セッション履歴キャッシュ | 毎リクエスト 50-100ms 短縮 |
| Embedding条件分岐 | API呼び出しコスト 50% 削減可能 |
| ベクター検索キャッシュ | 重複クエリで 100ms 短縮 |
| 選択的無効化 | 不要なキャッシュリビルド回避 |
