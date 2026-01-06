/**
 * ego Graphica - エージェント会話API（ストリーミング対応）
 * POST /api/chat/stream
 *
 * SSE (Server-Sent Events) でリアルタイムにレスポンスを返す
 */

import { defineEventHandler, readBody, H3Event, createEventStream } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestoreInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { queryVectors } from "~/utils/pinecone"
import { getAnthropicSDKClient } from "~/utils/anthropic"
import { getCache, setCache, buildRagSummary } from "~/utils/cag"
import { getCachedSessionHistory, setSessionCache, appendToSessionCache } from "~/utils/session-cache"
import { getCachedVectorResults, setVectorCache } from "~/utils/vector-cache"
import { estimateTokens, truncateToTokenLimit, getContextTokenBudget } from "~/utils/token-counter"
import { runClaudeConversationStream } from "~/utils/chat-tools"
import type { ConversationMessage, StreamCallbacks } from "~/utils/chat-tools"
import { LOG, AIProvider } from "@egographica/shared"
import type { Persona } from "@egographica/shared"

interface RequestBody {
    bucket: string
    message: string
    session_id?: string
}

/**
 * リアルタイムRAG検索をスキップすべきかどうかを判定
 */
function shouldSkipRealtimeRag(message: string): boolean {
    if (message.length < 10) {
        const greetings = ["こんにちは", "こんばんは", "おはよう", "ありがとう", "はい", "いいえ"]
        return greetings.some(g => message.includes(g))
    }
    return false
}

/** ペルソナからシステムプロンプトを生成（ストリーミング用） */
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

        if (persona.writing_style) {
            const style = persona.writing_style
            prompt += `\n\n## 文体の参考（自然に取り入れる程度で）`
            prompt += `\n${style.description}`
        }

        if (persona.style_samples && persona.style_samples.length > 0) {
            prompt += `\n\n## 文章例（参考程度）`
            prompt += `\n「${persona.style_samples[0]}」`
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

    prompt += `\n\n## 応答ルール（厳守）
1. 顧客への返答を1-2文で書く
2. 返答を書き終えたら、shouldContinue ツールを呼び出す（テキストで説明しない）

shouldContinue ツールのパラメータ:
- have_more_to_say: 続けて話したいなら true、終わりなら false
- next_topic: 次の話題（なければ「なし」）

## 禁止事項
- ツールについてテキストで説明しない
- 「shouldContinue」という単語を顧客に見せない
- 長文を書かない（1-2文まで）

## 応答スタイル
- 自然な会話調（「〜ですね」「〜かな」）
- アーティストらしい個性を持って対応
- わからないことは「確認します」と伝える`

    return prompt
}

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.message) {
        return { error: "bucket and message are required" }
    }

    console.log(LOG.AI.CHAT_GENERATING, { bucket: body.bucket, streaming: true })

    const db = getFirestoreInstance()

    // CAG: キャッシュからペルソナとRAGサマリーを取得
    let persona: Persona | null = null
    let rag_summary = ""
    const cached = await getCache(body.bucket)

    if (cached) {
        console.log("CAG: Using cached context (Redis)")
        persona = cached.persona
        rag_summary = cached.rag_summary
    } else {
        console.log("CAG: Building and caching context")
        try {
            const persona_doc = await db.collection(body.bucket).doc("persona").get()
            if (persona_doc.exists) {
                persona = persona_doc.data() as Persona
            }
        } catch (e) {
            console.error("Failed to load persona:", e)
        }

        rag_summary = await buildRagSummary(db, body.bucket)
        await setCache(body.bucket, persona, rag_summary)
    }

    // リアルタイムRAG
    let realtime_context = ""
    if (!shouldSkipRealtimeRag(body.message)) {
        console.log("Realtime RAG: Searching...")
        try {
            const query_embedding = await generateEmbedding(body.message)

            let results = await getCachedVectorResults(body.bucket, query_embedding)
            if (!results) {
                results = await queryVectors(body.bucket, query_embedding, 5)
                await setVectorCache(body.bucket, query_embedding, results)
            }

            if (results.length > 0) {
                realtime_context = results
                    .map((r, i) => `[${i + 1}] ${r.metadata.title}\n${r.metadata.text}`)
                    .join("\n\n")
            }
        } catch (e) {
            console.error("RAG search failed:", e)
        }
    }

    // コンテキストを結合
    let context = ""
    if (rag_summary) {
        context += `### 知識ベース（CAG）\n${rag_summary}\n\n`
    }
    if (realtime_context) {
        context += `### 関連情報（RAG）\n${realtime_context}`
    }

    const system_prompt = buildSystemPrompt(persona, context)

    // セッション管理
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

    // 会話履歴を取得
    let conversation_history: ConversationMessage[] = []
    const cached_history = await getCachedSessionHistory(session_id)

    if (cached_history) {
        conversation_history = cached_history as ConversationMessage[]
    } else {
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
        await setSessionCache(session_id, conversation_history)
    }

    // 現在のユーザーメッセージを追加
    conversation_history.push({ role: "user", content: body.message })

    // トークン制限を適用
    const system_prompt_tokens = estimateTokens(system_prompt)
    const token_budget = getContextTokenBudget("claude")
    const trimmed_history = truncateToTokenLimit(conversation_history, token_budget, system_prompt_tokens + 4000)
    conversation_history = trimmed_history

    // ユーザーメッセージをFirestoreに保存
    await messages_ref.add({
        role: "user",
        content: body.message,
        created: FieldValue.serverTimestamp()
    })

    // モデルを決定（デフォルト: Claude Sonnet）
    const model = persona?.provider || AIProvider.CLAUDE_SONNET
    console.log("Using model:", model, "(streaming)")

    // SSE ストリームを作成
    const event_stream = createEventStream(event)

    // メッセージ収集用
    const collected_messages: string[] = []

    // ストリーミングコールバック
    const callbacks: StreamCallbacks = {
        onTextDelta: (text: string) => {
            event_stream.push({
                event: "text_delta",
                data: JSON.stringify({ text })
            })
        },
        onMessageComplete: (message: string) => {
            collected_messages.push(message)
            event_stream.push({
                event: "message_complete",
                data: JSON.stringify({ message })
            })
        },
        onDone: async () => {
            // メッセージをFirestoreに保存
            for (const msg of collected_messages) {
                await messages_ref.add({
                    role: "assistant",
                    content: msg,
                    created: FieldValue.serverTimestamp()
                })
                await appendToSessionCache(session_id!, { role: "assistant", content: msg })
            }

            // セッションを更新
            await db
                .collection(body.bucket)
                .doc("sessions")
                .collection("items")
                .doc(session_id!)
                .update({
                    updated: FieldValue.serverTimestamp(),
                    messages: FieldValue.increment(1 + collected_messages.length)
                })

            // 完了イベントを送信
            event_stream.push({
                event: "done",
                data: JSON.stringify({
                    session_id,
                    message_count: collected_messages.length
                })
            })

            console.log(LOG.AI.CHAT_GENERATED, { streaming: true, message_count: collected_messages.length })

            await event_stream.close()
        },
        onError: async (error: Error) => {
            console.error("Streaming error:", error)
            event_stream.push({
                event: "error",
                data: JSON.stringify({ error: error.message })
            })
            await event_stream.close()
        }
    }

    // セッションIDを最初に送信
    event_stream.push({
        event: "session",
        data: JSON.stringify({ session_id })
    })

    // ストリーミング会話を開始（Anthropic SDK）
    const anthropic = getAnthropicSDKClient()
    runClaudeConversationStream(anthropic, model, system_prompt, conversation_history, callbacks)

    return event_stream.send()
})
