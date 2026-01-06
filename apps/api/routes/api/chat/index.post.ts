/**
 * ego Graphica - エージェント会話API
 * POST /api/chat
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestoreInstance } from "~/utils/firebase"
import { generateEmbedding, getOpenAISDKClient } from "~/utils/openai"
import { queryVectors } from "~/utils/pinecone"
import { getAnthropicSDKClient } from "~/utils/anthropic"
import { getCache, setCache, buildRagSummary } from "~/utils/cag"
import { getCachedSessionHistory, setSessionCache, appendToSessionCache } from "~/utils/session-cache"
import { getCachedVectorResults, setVectorCache } from "~/utils/vector-cache"
import { estimateTokens, truncateToTokenLimit, getContextTokenBudget } from "~/utils/token-counter"
import { runClaudeConversation, runOpenAIConversation } from "~/utils/chat-tools"
import type { ConversationMessage } from "~/utils/chat-tools"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR, AIProvider } from "@egographica/shared"
import type { Persona } from "@egographica/shared"

interface RequestBody {
    bucket: string
    message: string
    session_id?: string
}

/** オブジェクトからundefined値を再帰的に除去（Firestore互換） */
function stripUndefined<T>(obj: T): T {
    if (obj === null || obj === undefined) {
        return obj
    }
    if (Array.isArray(obj)) {
        return obj.map(item => stripUndefined(item)) as T
    }
    if (typeof obj === "object") {
        const result: Record<string, unknown> = {}
        for (const [key, value] of Object.entries(obj)) {
            if (value !== undefined) {
                result[key] = stripUndefined(value)
            }
        }
        return result as T
    }
    return obj
}

/**
 * リアルタイムRAG検索をスキップすべきかどうかを判定
 * 明らかに不要な場合（挨拶のみ）のみスキップ
 */
function shouldSkipRealtimeRag(message: string): boolean {
    // 非常に短いメッセージ（挨拶など）はスキップ
    if (message.length < 10) {
        const greetings = ["こんにちは", "こんばんは", "おはよう", "ありがとう", "はい", "いいえ"]
        return greetings.some(g => message.includes(g))
    }
    return false
}

/** ペルソナからシステムプロンプトを生成（CAG） */
function buildSystemPrompt(persona: Persona | null, context: string): string {
    let prompt = `あなたはアーティストの代わりに顧客対応を行うAIエージェント「ego Graphica」です。`

    if (persona) {
        prompt += `\n\n## キャラクター設定`
        if (persona.character) {
            prompt += `\nあなたの名前は「${persona.character}」です。`
        }
        if (persona.motif) {
            prompt += `\nモチーフ: ${persona.motif}`
        }
        if (persona.philosophy) {
            prompt += `\n創作哲学: ${persona.philosophy}`
        }

        if (persona.influences && persona.influences.length > 0) {
            prompt += `\n影響を受けた作家・文化: ${persona.influences.join("、")}`
        }

        // 文体スタイル（参考程度）
        if (persona.writing_style) {
            const style = persona.writing_style
            prompt += `\n\n## 文体の参考（自然に取り入れる程度で）`
            prompt += `\n${style.description}`
            // 詳細な文末・句読点ルールは省略（重みを下げる）
        }

        // サンプル文（参考程度）
        if (persona.style_samples && persona.style_samples.length > 0) {
            prompt += `\n\n## 文章例（参考程度）`
            prompt += `\n「${persona.style_samples[0]}」` // 1つだけ表示
        }

        if (persona.avoidances && persona.avoidances.length > 0) {
            prompt += `\n\n## 避けるべきトピック\n${persona.avoidances.join("、")}についての話題は避けてください。`
        }

        if (persona.samples && persona.samples.length > 0) {
            prompt += `\n\n## 応答例`
            for (const sample of persona.samples) {
                prompt += `\n\n状況: ${sample.situation}`
                prompt += `\n顧客: ${sample.message}`
                prompt += `\n応答: ${sample.response}`
            }
        }
    }

    if (context) {
        prompt += `\n\n## 参考情報（RAG）\n以下の情報を参考にして回答してください:\n\n${context}`
    }

    prompt += `\n\n## 応答方法（必須）
**重要**: 必ず sendMessage ツールを使って応答してください。直接テキストを返さないでください。

sendMessage ツールの使い方:
- message: 顧客に送るメッセージ（1-2文の短文）
- have_more_to_say: まだ伝えたいことがあれば true、十分なら false
- next_topic: 次に話す内容（なければ「なし」）

## 応答スタイル
- **超短文**: 1文、長くても2文まで
- **自然な会話**: 「〜ですね」「〜かな」のような口語的な終わり方
- **分割**: 長くなりそうなら複数回 sendMessage を呼ぶ

## 注意事項
- 顧客に対して丁寧に、でもアーティストらしい個性を持って対応
- 作品について聞かれた場合は参考情報を元に具体的に説明
- わからないことは正直に「確認します」と伝える`

    return prompt
}

export default defineEventHandler(async (event: H3Event) => {
    const total_start = Date.now()
    const timings: Record<string, number> = {}
    const cache_hits: Record<string, boolean> = {
        cag: false,
        session: false,
        vector: false,
        embedding: false
    }

    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.message) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    console.log(LOG.AI.CHAT_GENERATING, { bucket: body.bucket })

    const db = getFirestoreInstance()

    // CAG: キャッシュからペルソナとRAGサマリーを取得（Redis）
    const cag_start = Date.now()
    let persona: Persona | null = null
    let rag_summary = ""
    const cached = await getCache(body.bucket)

    if (cached) {
        console.log("CAG: Using cached context (Redis)")
        cache_hits.cag = true
        persona = cached.persona
        rag_summary = cached.rag_summary
    } else {
        console.log("CAG: Building and caching context")
        // ペルソナを取得
        try {
            const persona_doc = await db.collection(body.bucket).doc("persona").get()
            if (persona_doc.exists) {
                persona = persona_doc.data() as Persona
            }
        } catch (e) {
            console.error("Failed to load persona:", e)
        }

        // RAGサマリーを構築
        rag_summary = await buildRagSummary(db, body.bucket)

        // キャッシュに保存（Redis）
        await setCache(body.bucket, persona, rag_summary)
    }
    timings.cag = Date.now() - cag_start

    // リアルタイムRAG: 基本的に常に実行（挨拶のみスキップ）
    const rag_start = Date.now()
    let realtime_context = ""
    if (shouldSkipRealtimeRag(body.message)) {
        console.log("Realtime RAG: Skipped (greeting/short message)")
        timings.embedding = 0
        timings.vector_search = 0
    } else {
        console.log("Realtime RAG: Searching...")
        try {
            const embed_start = Date.now()
            const query_embedding = await generateEmbedding(body.message)
            timings.embedding = Date.now() - embed_start
            // 20ms未満ならキャッシュヒットと判定（API呼び出しは100-300ms）
            cache_hits.embedding = timings.embedding < 20

            // ベクター検索キャッシュをチェック（Redis）
            const vector_start = Date.now()
            let results = await getCachedVectorResults(body.bucket, query_embedding)
            if (results) {
                console.log("Vector cache HIT (Redis)")
                cache_hits.vector = true
            } else {
                console.log("Vector cache MISS - querying Pinecone")
                results = await queryVectors(body.bucket, query_embedding, 5)
                await setVectorCache(body.bucket, query_embedding, results)
            }
            timings.vector_search = Date.now() - vector_start

            if (results.length > 0) {
                realtime_context = results
                    .map((r, i) => `[${i + 1}] ${r.metadata.title}\n${r.metadata.text}`)
                    .join("\n\n")
            }
        } catch (e) {
            console.error("RAG search failed:", e)
        }
    }
    timings.rag_total = Date.now() - rag_start

    // CAGサマリー + リアルタイムRAGを結合
    let context = ""
    if (rag_summary) {
        context += `### 知識ベース（CAG）\n${rag_summary}\n\n`
    }
    if (realtime_context) {
        context += `### 関連情報（RAG）\n${realtime_context}`
    }

    const system_prompt = buildSystemPrompt(persona, context)

    let session_id = body.session_id
    if (!session_id) {
        const session_ref = db.collection(body.bucket).doc("sessions").collection("items").doc()
        session_id = session_ref.id
        await session_ref.set({
            id: session_id,
            started: FieldValue.serverTimestamp(),
            updated: FieldValue.serverTimestamp(),
            messages: 0
        })
    }

    const messages_ref = db
        .collection(body.bucket)
        .doc("sessions")
        .collection("items")
        .doc(session_id)
        .collection("messages")

    // 過去の会話履歴を取得（Redisキャッシュ優先）
    const history_start = Date.now()
    let conversation_history: ConversationMessage[] = []
    const cached_history = await getCachedSessionHistory(session_id)

    if (cached_history) {
        console.log("Session cache HIT (Redis)")
        cache_hits.session = true
        conversation_history = cached_history as ConversationMessage[]
    } else {
        console.log("Session cache MISS - loading from Firestore")
        const history_snapshot = await messages_ref.orderBy("created", "asc").limit(20).get()
        for (const doc of history_snapshot.docs) {
            const data = doc.data()
            if (data.role && data.content) {
                conversation_history.push({
                    role: data.role as "user" | "assistant",
                    content: data.content
                })
            }
        }
        // セッションキャッシュに保存（Redis）
        await setSessionCache(session_id, conversation_history)
    }
    timings.history = Date.now() - history_start

    // 現在のユーザーメッセージを追加
    conversation_history.push({ role: "user", content: body.message })

    // トークン制限を適用（Claude固定）
    const system_prompt_tokens = estimateTokens(system_prompt)
    const token_budget = getContextTokenBudget("claude")
    const available_tokens = token_budget - system_prompt_tokens - 4000 // レスポンス用に予約

    console.log("Token budget:", {
        total_budget: token_budget,
        system_prompt_tokens: system_prompt_tokens,
        system_prompt_chars: system_prompt.length,
        history_messages: conversation_history.length,
        available_for_history: available_tokens
    })

    // トークン制限を超える場合は古いメッセージを切り詰め
    const trimmed_history = truncateToTokenLimit(conversation_history, token_budget, system_prompt_tokens + 4000)
    if (trimmed_history.length < conversation_history.length) {
        console.log(`History truncated: ${conversation_history.length} -> ${trimmed_history.length} messages`)
    }
    conversation_history = trimmed_history

    await messages_ref.add({
        role: "user",
        content: body.message,
        created: FieldValue.serverTimestamp()
    })

    // プロバイダーを決定（デフォルト: Claude）
    const provider = persona?.provider || AIProvider.CLAUDE
    console.log("Using AI provider:", provider)

    try {
        const ai_start = Date.now()
        let response_messages: string[] = []

        console.log(`Calling ${provider} API...`, { history_count: conversation_history.length })

        if (provider === AIProvider.GPT4O_MINI) {
            // GPT-4o-mini を使用
            const openai = getOpenAISDKClient()
            const result = await runOpenAIConversation(openai, system_prompt, conversation_history)
            response_messages = result.messages
        } else {
            // Claude を使用（デフォルト）
            const anthropic = getAnthropicSDKClient()
            const result = await runClaudeConversation(anthropic, system_prompt, conversation_history)
            response_messages = result.messages
        }

        timings.ai_call = Date.now() - ai_start

        console.log(`${provider} API response received`)
        console.log("Response:", {
            messages_count: response_messages.length,
            messages_preview: response_messages.map(m => m.slice(0, 100))
        })

        // 各メッセージをFirestoreに保存
        for (const msg of response_messages) {
            await messages_ref.add({
                role: "assistant",
                content: msg,
                created: FieldValue.serverTimestamp()
            })
            await appendToSessionCache(session_id, { role: "assistant", content: msg })
        }

        await db
            .collection(body.bucket)
            .doc("sessions")
            .collection("items")
            .doc(session_id)
            .update({
                updated: FieldValue.serverTimestamp(),
                messages: FieldValue.increment(1 + response_messages.length) // user + assistant messages
            })

        timings.total = Date.now() - total_start

        // パフォーマンスレポート
        console.log("⏱️ PERFORMANCE REPORT:", {
            cag_ms: timings.cag,
            embedding_ms: timings.embedding,
            vector_search_ms: timings.vector_search,
            rag_total_ms: timings.rag_total,
            history_ms: timings.history,
            ai_call_ms: timings.ai_call,
            total_ms: timings.total,
            response_count: response_messages.length,
            bottleneck: Object.entries(timings)
                .filter(([k]) => k !== "total")
                .sort(([, a], [, b]) => b - a)[0]
        })

        console.log(LOG.AI.CHAT_GENERATED)

        return success(event, {
            session_id,
            messages: response_messages, // 複数メッセージを配列で返す
            _debug: {
                provider,
                timings,
                cache_hits,
                rag: realtime_context || "(スキップ)",
                cag: {
                    persona: persona ? {
                        character: persona.character,
                        philosophy: persona.philosophy,
                        writing_style: persona.writing_style?.description
                    } : null,
                    rag_summary: rag_summary || "(なし)"
                },
                context_injection: context || "(なし)"
            }
        })
    } catch (e) {
        console.error("Chat generation failed:", e)
        serverError(ERROR.SERVICE.AI_PROVIDER_ERROR)
    }
})
