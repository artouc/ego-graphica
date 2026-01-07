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
import { getCache, setCache, buildRagSummary, buildStyleAnalysis } from "~/utils/cag"
import type { WritingStyle, Persona } from "@egographica/shared"
import { buildChatSystemPrompt } from "@egographica/shared"
import { getCachedSessionHistory, setSessionCache, appendToSessionCache } from "~/utils/session-cache"
import { getCachedVectorResults, setVectorCache } from "~/utils/vector-cache"
import { estimateTokens, truncateToTokenLimit, getContextTokenBudget } from "~/utils/token-counter"
import { runClaudeConversationStream } from "~/utils/chat-tools"
import type { ConversationMessage, StreamCallbacks } from "~/utils/chat-tools"
import { LOG, AIProvider } from "@egographica/shared"
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

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.message) {
        return { error: "bucket and message are required" }
    }

    console.log(LOG.AI.CHAT_GENERATING, { bucket: body.bucket, streaming: true })

    const db = getFirestoreInstance()

    // SSE ストリームを先に作成（タイミング情報を送信するため）
    const event_stream = createEventStream(event)

    // タイミング送信ヘルパー
    const sendTiming = (category: "CAG" | "RAG" | "LLM" | "TOOL", duration: number) => {
        event_stream.push({
            event: "timing",
            data: JSON.stringify({ category, duration })
        })
    }

    // CAG: キャッシュからペルソナ・RAGサマリー・口調分析を取得
    const cag_start = Date.now()
    let persona: Persona | null = null
    let rag_summary = ""
    let writing_style: WritingStyle | null = null
    let style_samples: string[] = []
    const cached = await getCache(body.bucket)

    if (cached) {
        console.log("CAG: Using cached context (Redis)")
        persona = cached.persona
        rag_summary = cached.rag_summary
        writing_style = cached.writing_style
        style_samples = cached.style_samples || []
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

        // RAGサマリーと口調分析を並列で構築
        const [rag_result, style_result] = await Promise.all([
            buildRagSummary(db, body.bucket),
            buildStyleAnalysis(db, body.bucket)
        ])

        rag_summary = rag_result
        writing_style = style_result.writing_style
        style_samples = style_result.style_samples

        await setCache(body.bucket, persona, rag_summary, writing_style, style_samples)
    }
    sendTiming("CAG", Date.now() - cag_start)

    // リアルタイムRAG
    let realtime_context = ""
    if (!shouldSkipRealtimeRag(body.message)) {
        const rag_start = Date.now()
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
        sendTiming("RAG", Date.now() - rag_start)
    }

    // コンテキストを結合
    let context = ""
    if (rag_summary) {
        context += `### 知識ベース（CAG）\n${rag_summary}\n\n`
    }
    if (realtime_context) {
        context += `### 関連情報（RAG）\n${realtime_context}`
    }

    const system_prompt = buildChatSystemPrompt({
        persona,
        context,
        writing_style,
        style_samples
    })

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

    // エージェントイベント送信ヘルパー
    const sendAgentEvent = (message: string) => {
        event_stream.push({
            event: "agent",
            data: JSON.stringify({ message })
        })
    }

    // メッセージ収集用
    const collected_messages: string[] = []
    let llm_start = 0

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
        onToolCall: (tool_name: string) => {
            sendAgentEvent(`ツール呼び出し：${tool_name}`)
            sendTiming("TOOL", 0) // ツール自体の実行時間は瞬時
        },
        onImage: (image: { url: string; subject: string; asset_id: string }) => {
            event_stream.push({
                event: "image",
                data: JSON.stringify(image)
            })
            sendAgentEvent(`画像を表示：${image.subject}`)
        },
        onDone: async () => {
            // LLMタイミングを送信
            if (llm_start > 0) {
                sendTiming("LLM", Date.now() - llm_start)
            }
            sendAgentEvent("生成完了")

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

    // 生成開始イベント
    sendAgentEvent("生成を開始")
    llm_start = Date.now()

    // ストリーミング会話を開始（Anthropic SDK）
    const anthropic = getAnthropicSDKClient()
    runClaudeConversationStream(anthropic, model, system_prompt, conversation_history, callbacks, body.bucket)

    return event_stream.send()
})
