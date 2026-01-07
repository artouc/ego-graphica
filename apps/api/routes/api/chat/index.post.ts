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
import type { WritingStyle } from "@egographica/shared"
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

/** システムプロンプト構築用のオプション */
interface SystemPromptOptions {
    persona: Persona | null
    context: string
    writing_style: WritingStyle | null
    style_samples: string[]
}

/** ペルソナからシステムプロンプトを生成（ストリーミング用） */
function buildSystemPrompt(options: SystemPromptOptions): string {
    const { persona, context, writing_style, style_samples } = options
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

    // 口調分析をCAGキャッシュから適用
    if (writing_style) {
        prompt += `\n\n## 文体ガイド（CAG）`
        prompt += `\n${writing_style.description}`
        prompt += `\n- 文末表現: ${writing_style.sentence_endings.join("、")}`
        prompt += `\n- フォーマル度: ${writing_style.formality_level < 0.4 ? "カジュアル" : writing_style.formality_level < 0.7 ? "やや丁寧" : "フォーマル"}`
        if (writing_style.characteristic_phrases.length > 0) {
            prompt += `\n- 特徴的フレーズ: ${writing_style.characteristic_phrases.join("、")}`
        }
        if (writing_style.punctuation.uses_emoji) {
            prompt += `\n- 絵文字を適度に使用`
        }
        if (writing_style.punctuation.uses_exclamation) {
            prompt += `\n- 感嘆符（！）を使用`
        }
    }

    // 実際の文章サンプル
    if (style_samples.length > 0) {
        prompt += `\n\n## 参考文章（この人の実際の書き方）`
        for (const sample of style_samples.slice(0, 3)) {
            prompt += `\n「${sample}」`
        }
    }

    if (context) {
        prompt += `\n\n## 参考情報（RAG）\n以下の情報を参考にして回答してください:\n\n${context}`
    }

    prompt += `\n\n## 応答ルール（厳守）
1. 顧客への返答を1-2文で書く
2. 返答を書き終えたら、shouldContinue ツールを呼び出す（テキストで説明しない）
3. shouldContinue で have_more_to_say: true を返した場合、ツール結果を受け取ったら次の話題について新しいメッセージを書く

shouldContinue ツールのパラメータ:
- have_more_to_say: 続けて話したいなら true、終わりなら false
- next_topic: 次の話題（なければ「なし」）

## 継続時の動作
ツール結果で「続けてください」と指示されたら、新しい短いメッセージを書いてください。各メッセージは独立した吹き出しとして表示されます。

## 禁止事項
- ツールについてテキストで説明しない
- 「shouldContinue」という単語を顧客に見せない
- 長文を書かない（1-2文まで）

## 応答スタイル
- 上記の文体ガイドに従って自然に話す
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

    const system_prompt = buildSystemPrompt({
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
    runClaudeConversationStream(anthropic, model, system_prompt, conversation_history, callbacks)

    return event_stream.send()
})
