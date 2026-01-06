/**
 * ego Graphica - エージェント会話API
 * POST /api/chat
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { getFirestoreInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { queryVectors } from "~/utils/pinecone"
import { getAnthropicSDKClient } from "~/utils/anthropic"
import { getCache, setCache, buildRagSummary } from "~/utils/cag"
import { getCachedSessionHistory, setSessionCache, appendToSessionCache } from "~/utils/session-cache"
import { getCachedVectorResults, setVectorCache } from "~/utils/vector-cache"
import { estimateTokens, truncateToTokenLimit, getContextTokenBudget } from "~/utils/token-counter"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR } from "@egographica/shared"
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

    prompt += `\n\n## 応答スタイル（最重要）
- **超短文**: 1文、長くても2文まで。人間のチャットのように短く。
- **自然な会話**: 「〜ですね」「〜かな」のような口語的な終わり方
- **自己評価**: 回答後、shouldKeepTalking を呼んで足りなければ追加メッセージを送る
- **分割して話す**: 長くなりそうなら複数メッセージに分ける

## 注意事項
- 顧客に対して丁寧に、でもアーティストらしい個性を持って対応してください
- 作品について聞かれた場合は、参考情報を元に具体的に説明してください
- わからないことは正直に「確認します」と伝えてください`

    return prompt
}

export default defineEventHandler(async (event: H3Event) => {
    const total_start = Date.now()
    const timings: Record<string, number> = {}

    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.message) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    console.log(LOG.AI.CHAT_GENERATING, { bucket: body.bucket })

    const db = getFirestoreInstance()

    // CAG: キャッシュからペルソナとRAGサマリーを取得
    const cag_start = Date.now()
    let persona: Persona | null = null
    let rag_summary = ""
    const cached = getCache(body.bucket)

    if (cached) {
        console.log("CAG: Using cached context")
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

        // キャッシュに保存
        setCache(body.bucket, persona, rag_summary)
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

            // ベクター検索キャッシュをチェック
            const vector_start = Date.now()
            let results = getCachedVectorResults(body.bucket, query_embedding)
            if (results) {
                console.log("Vector cache HIT")
            } else {
                console.log("Vector cache MISS - querying Pinecone")
                results = await queryVectors(body.bucket, query_embedding, 5)
                setVectorCache(body.bucket, query_embedding, results)
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

    // 過去の会話履歴を取得（キャッシュ優先）
    const history_start = Date.now()
    let conversation_history: Array<{ role: "user" | "assistant"; content: string }> = []
    const cached_history = getCachedSessionHistory(session_id)

    if (cached_history) {
        console.log("Session cache HIT")
        conversation_history = cached_history as Array<{ role: "user" | "assistant"; content: string }>
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
        // セッションキャッシュに保存
        setSessionCache(session_id, conversation_history)
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

    try {
        console.log("Calling Claude API...", { history_count: conversation_history.length })

        // Anthropic SDKを直接使用（AI SDKのバグを回避）
        const anthropic = getAnthropicSDKClient()
        
        // ツール定義（Anthropic SDK形式）
        const tools = [
            {
                name: "shouldKeepTalking",
                description: "回答の後に必ず呼び出す。追加で話すべき内容があるか評価する。",
                input_schema: {
                    type: "object",
                    properties: {
                        have_more_to_say: {
                            type: "boolean",
                            description: "まだ伝えたいことがあるならtrue、十分ならfalse"
                        },
                        next_topic: {
                            type: "string",
                            description: "次に話す内容、または「なし」"
                        }
                    },
                    required: ["have_more_to_say", "next_topic"]
                }
            }
        ]

        const ai_start = Date.now()
        
        // Anthropic SDKを使用してAPI呼び出し
        const response_messages: string[] = []
        let current_messages = conversation_history.map(msg => ({
            role: msg.role as "user" | "assistant",
            content: msg.content
        }))
        
        // maxStepsの代わりに手動でループ（最大5回）
        let shouldContinue = true
        for (let step = 0; step < 5 && shouldContinue; step++) {
            const response = await anthropic.messages.create({
                model: "claude-opus-4-5",
                max_tokens: 350,
                system: system_prompt,
                messages: current_messages,
                tools: step === 0 ? tools : undefined // 最初のステップのみツールを提供
            })
            
            // アシスタントの応答全体をメッセージに追加（テキストとtool_useの両方を含む）
            const assistantContent: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }> = []
            
            // テキストを追加
            for (const content of response.content) {
                if (content.type === "text") {
                    response_messages.push(content.text)
                    assistantContent.push({
                        type: "text",
                        text: content.text
                    })
                } else if (content.type === "tool_use") {
                    assistantContent.push({
                        type: "tool_use",
                        id: content.id,
                        name: content.name,
                        input: content.input
                    })
                }
            }
            
            // アシスタントの応答をメッセージ履歴に追加
            current_messages.push({
                role: "assistant",
                content: assistantContent
            })
            
            // ツール呼び出しを処理
            const toolUseBlocks = response.content.filter((c): c is { type: "tool_use"; id: string; name: string; input: unknown } => c.type === "tool_use")
            
            if (toolUseBlocks.length === 0) {
                shouldContinue = false // ツール呼び出しがない場合は終了
                break
            }
            
            // ツール実行結果を追加
            const toolResults = []
            for (const toolUse of toolUseBlocks) {
                if (toolUse.name === "shouldKeepTalking") {
                    const { have_more_to_say, next_topic } = toolUse.input as { have_more_to_say: boolean; next_topic: string }
                    console.log("shouldKeepTalking:", { have_more_to_say, next_topic })
                    
                    if (!have_more_to_say) {
                        // 続ける必要がない場合は終了
                        shouldContinue = false
                        break
                    }
                    
                    toolResults.push({
                        type: "tool_result" as const,
                        tool_use_id: toolUse.id,
                        content: JSON.stringify({ continue: true, topic: next_topic })
                    })
                }
            }
            
            if (toolResults.length === 0 || !shouldContinue) {
                shouldContinue = false // ツール実行結果がない場合は終了
                break
            }
            
            // ツール実行結果をメッセージに追加
            current_messages.push({
                role: "user",
                content: toolResults
            })
        }
        
        timings.ai_call = Date.now() - ai_start

        console.log("Claude API response received")
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
            appendToSessionCache(session_id, { role: "assistant", content: msg })
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
                timings,
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
        serverError(ERROR.SERVICE.ANTHROPIC_ERROR)
    }
})
