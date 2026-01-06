/**
 * ego Graphica - エージェント会話API
 * POST /api/chat
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { generateText, tool } from "ai"
import { z } from "zod"
import { getFirestoreInstance } from "~/utils/firebase"
import { generateEmbedding } from "~/utils/openai"
import { queryVectors } from "~/utils/pinecone"
import { getGrok } from "~/utils/grok"
import { getClaudeOpus } from "~/utils/anthropic"
import { getCache, setCache, buildRagSummary } from "~/utils/cag"
import { getCachedSessionHistory, setSessionCache, appendToSessionCache } from "~/utils/session-cache"
import { getCachedVectorResults, setVectorCache } from "~/utils/vector-cache"
import { estimateTokens, truncateToTokenLimit, getContextTokenBudget } from "~/utils/token-counter"
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
 * リアルタイムRAG検索が必要かどうかを判定
 * キーワード検出による条件分岐でAPI呼び出しを削減
 */
function shouldUseRealtimeRag(message: string): boolean {
    const search_keywords = [
        "探して", "検索", "見つけて", "作品", "ポートフォリオ",
        "過去の", "以前の", "前に", "絵", "イラスト", "デザイン",
        "買いたい", "購入", "見せて", "見たい"
    ]
    return search_keywords.some(kw => message.includes(kw))
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
        if (persona.tone) {
            prompt += `\n話し方: ${getToneDescription(persona.tone)}`
        }
        if (persona.philosophy) {
            prompt += `\n創作哲学: ${persona.philosophy}`
        }

        if (persona.influences && persona.influences.length > 0) {
            prompt += `\n影響を受けた作家・文化: ${persona.influences.join("、")}`
        }

        // 文体スタイル（重要：これに厳密に従う）
        if (persona.writing_style) {
            const style = persona.writing_style
            prompt += `\n\n## 文体スタイル（厳守）`
            prompt += `\n${style.description}`
            prompt += `\n\n### 文末表現`
            prompt += `\n使用する文末: ${style.sentence_endings.join("、")}`
            prompt += `\n\n### 句読点ルール`
            if (!style.punctuation.uses_exclamation) {
                prompt += `\n- 感嘆符（！）は使用しない`
            }
            if (!style.punctuation.uses_emoji) {
                prompt += `\n- 絵文字は使用しない`
            }
            if (!style.punctuation.uses_question_marks) {
                prompt += `\n- 疑問符（？）の多用は避ける`
            }
            prompt += `\n- 句点: ${style.punctuation.period_style}`
            prompt += `\n- 読点: ${style.punctuation.comma_style}`
            prompt += `\n\n### フォーマル度: ${Math.round(style.formality_level * 100)}%`

            if (style.characteristic_phrases.length > 0) {
                prompt += `\n\n### 特徴的な表現`
                prompt += `\n${style.characteristic_phrases.join("、")}`
            }

            if (style.avoid_patterns.length > 0) {
                prompt += `\n\n### 絶対に使用しない表現`
                prompt += `\n${style.avoid_patterns.join("、")}`
            }
        }

        // サンプル文（実際のアーティストの文章）
        if (persona.style_samples && persona.style_samples.length > 0) {
            prompt += `\n\n## アーティスト本人の文章例（この文体を模倣）`
            for (const sample of persona.style_samples) {
                prompt += `\n「${sample}」`
            }
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

    prompt += `\n\n## 注意事項
- 顧客に対して丁寧に、でもアーティストらしい個性を持って対応してください
- 作品について聞かれた場合は、参考情報を元に具体的に説明してください
- わからないことは正直に「確認します」と伝えてください
- 文体スタイルの指定がある場合は、それに厳密に従ってください（特に絵文字・感嘆符の使用禁止）`

    return prompt
}

function getToneDescription(tone: string): string {
    const tones: Record<string, string> = {
        formal: "丁寧でフォーマルな話し方",
        friendly: "親しみやすくフレンドリーな話し方",
        artistic: "芸術的で詩的な表現を使う話し方",
        professional: "プロフェッショナルでビジネスライクな話し方",
        playful: "遊び心があり、ユーモアを交えた話し方"
    }
    return tones[tone] || "自然な話し方"
}

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.message) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    console.log(LOG.AI.CHAT_GENERATING, { bucket: body.bucket })

    const db = getFirestoreInstance()

    // CAG: キャッシュからペルソナとRAGサマリーを取得
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

    // リアルタイムRAG: キーワードに基づいて条件分岐（コスト削減）
    let realtime_context = ""
    if (shouldUseRealtimeRag(body.message)) {
        console.log("Realtime RAG: Searching (keyword match detected)")
        try {
            const query_embedding = await generateEmbedding(body.message)

            // ベクター検索キャッシュをチェック
            let results = getCachedVectorResults(body.bucket, query_embedding)
            if (results) {
                console.log("Vector cache HIT")
            } else {
                console.log("Vector cache MISS - querying Pinecone")
                results = await queryVectors(body.bucket, query_embedding, 5)
                setVectorCache(body.bucket, query_embedding, results)
            }

            if (results.length > 0) {
                realtime_context = results
                    .map((r, i) => `[${i + 1}] ${r.metadata.title}\n${r.metadata.text}`)
                    .join("\n\n")
            }
        } catch (e) {
            console.error("RAG search failed:", e)
        }
    } else {
        console.log("Realtime RAG: Skipped (no keyword match)")
    }

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

    // 現在のユーザーメッセージを追加
    conversation_history.push({ role: "user", content: body.message })

    // プロバイダーに応じてトークン制限を適用
    const provider_name = persona?.provider || AIProvider.CLAUDE
    const system_prompt_tokens = estimateTokens(system_prompt)
    const token_budget = getContextTokenBudget(provider_name)
    const available_tokens = token_budget - system_prompt_tokens - 4000 // レスポンス用に予約

    console.log("Token budget:", {
        provider: provider_name,
        total_budget: token_budget,
        system_prompt: system_prompt_tokens,
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

    // プロバイダーに応じてモデルを選択
    const model = provider_name === AIProvider.GROK ? getGrok() : getClaudeOpus()

    try {
        console.log(`Calling ${provider_name === AIProvider.GROK ? "Grok" : "Claude"} API...`, { history_count: conversation_history.length })

        // ツールコーリング無効化中
        const { text } = await generateText({
            model,
            system: system_prompt,
            messages: conversation_history
            // maxSteps: 3,
            // tools: { ... } - 下記コメントアウト参照
        })
        const toolCalls: unknown[] = []
        const steps: unknown[] = []

        /* ツールコーリング（一時無効化）
        const { text, toolCalls, steps } = await generateText({
            model,
            system: system_prompt,
            messages: conversation_history,
            maxSteps: 3,
            tools: {
                showPortfolio: tool({
                    description: "作品ポートフォリオを表示する",
                    parameters: z.object({
                        category: z.string().optional().describe("カテゴリでフィルター"),
                        limit: z.number().optional().describe("表示件数")
                    }),
                    execute: async ({ category, limit = 6 }) => {
                        console.log("showPortfolio called:", { bucket: body.bucket, category, limit })
                        try {
                            const works_snapshot = await db
                                .collection(body.bucket)
                                .doc("works")
                                .collection("items")
                                .orderBy("created", "desc")
                                .limit(limit)
                                .get()

                            console.log("showPortfolio query result:", {
                                path: `${body.bucket}/works/items`,
                                docs_count: works_snapshot.docs.length,
                                empty: works_snapshot.empty
                            })

                            const works = works_snapshot.docs.map(doc => {
                                const data = doc.data()
                                return {
                                    id: data.id,
                                    title: data.title,
                                    url: data.url,
                                    status: data.status
                                }
                            })

                            return { works, total: works.length }
                        } catch (e) {
                            console.error("showPortfolio error:", e)
                            return { works: [], total: 0, error: "作品の取得に失敗しました" }
                        }
                    }
                }),
                searchWorks: tool({
                    description: "キーワードや要望に合った作品を検索する",
                    parameters: z.object({
                        query: z.string().describe("検索クエリ")
                    }),
                    execute: async ({ query }) => {
                        console.log("searchWorks called:", { query })
                        try {
                            const embedding = await generateEmbedding(query)
                            const results = await queryVectors(body.bucket, embedding, 5, {
                                sourcetype: "work"
                            })
                            console.log("searchWorks results:", { count: results.length })

                            return {
                                works: results.map(r => ({
                                    id: r.metadata.source,
                                    title: r.metadata.title,
                                    score: r.score
                                }))
                            }
                        } catch (e) {
                            console.error("searchWorks error:", e)
                            return { works: [], error: "検索に失敗しました" }
                        }
                    }
                }),
                generateQuote: tool({
                    description: "概算見積もりを生成する",
                    parameters: z.object({
                        project_type: z.string().describe("プロジェクトの種類"),
                        description: z.string().describe("プロジェクトの説明"),
                        urgent: z.boolean().optional().describe("急ぎ対応かどうか")
                    }),
                    execute: async ({ project_type, description, urgent }) => {
                        return {
                            project_type,
                            description,
                            urgent: urgent || false,
                            note: "正式な見積もりは別途ご相談ください",
                            contact_required: true
                        }
                    }
                })
            }
        })
        ツールコーリング（一時無効化）ここまで */

        console.log(`${provider_name === AIProvider.GROK ? "Grok" : "Claude"} API response received`)
        console.log("generateText result:", {
            text_length: text?.length || 0,
            text_preview: text?.slice(0, 200) || "(empty)",
            toolCalls_count: toolCalls?.length || 0,
            steps_count: steps?.length || 0
        })
        // stepsの詳細をログ
        if (steps && steps.length > 0) {
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i]
                console.log(`Step ${i}:`, {
                    text: step.text?.slice(0, 100) || "(empty)",
                    toolCalls: step.toolCalls?.length || 0,
                    toolResults: step.toolResults?.length || 0,
                    toolResultsData: step.toolResults ? JSON.stringify(step.toolResults, null, 2).slice(0, 500) : null
                })
            }
        }

        // テキストが空でツール結果がある場合、ツール結果を元にレスポンスを構築
        let full_response = text
        if (!text && steps && steps.length > 0) {
            const tool_results: string[] = []
            for (const step of steps) {
                if (step.toolResults && step.toolResults.length > 0) {
                    for (const tr of step.toolResults) {
                        // Vercel AI SDK v6では結果は `output` に入る
                        const output = (tr as { output?: unknown }).output
                        if (tr.toolName === "showPortfolio" && output) {
                            const portfolio = output as { works: Array<{ title: string; status: string; url: string }>; total: number }
                            if (portfolio.works && portfolio.works.length > 0) {
                                tool_results.push(`作品一覧（${portfolio.total}件）:`)
                                for (const work of portfolio.works) {
                                    tool_results.push(`- ${work.title}${work.status === "sold" ? "（売約済み）" : ""}`)
                                }
                            } else {
                                tool_results.push("現在登録されている作品はありません。")
                            }
                        } else if (tr.toolName === "searchWorks" && output) {
                            const search = output as { works: Array<{ title: string; score: number }> }
                            if (search.works && search.works.length > 0) {
                                tool_results.push("検索結果:")
                                for (const work of search.works) {
                                    tool_results.push(`- ${work.title}`)
                                }
                            } else {
                                tool_results.push("該当する作品が見つかりませんでした。")
                            }
                        } else if (tr.toolName === "generateQuote" && output) {
                            const quote = output as { project_type: string; description: string; note: string }
                            tool_results.push(`お見積りのご依頼ありがとうございます。`)
                            tool_results.push(`プロジェクト: ${quote.project_type}`)
                            tool_results.push(`${quote.note}`)
                        }
                    }
                }
            }
            if (tool_results.length > 0) {
                full_response = tool_results.join("\n")
            }
        }

        const cleaned_tool_calls = toolCalls && toolCalls.length > 0 ? stripUndefined(toolCalls) : null

        await messages_ref.add({
            role: "assistant",
            content: full_response,
            tools: cleaned_tool_calls,
            created: FieldValue.serverTimestamp()
        })

        // セッションキャッシュを更新（ユーザーとアシスタントのメッセージを追加）
        appendToSessionCache(session_id, { role: "assistant", content: full_response || "" })

        await db
            .collection(body.bucket)
            .doc("sessions")
            .collection("items")
            .doc(session_id)
            .update({
                updated: FieldValue.serverTimestamp(),
                messages: FieldValue.increment(2)
            })

        console.log(LOG.AI.CHAT_GENERATED)

        return success(event, {
            session_id,
            message: full_response,
            tools: cleaned_tool_calls || []
        })
    } catch (e) {
        console.error("Chat generation failed:", e)
        serverError(provider_name === AIProvider.GROK ? ERROR.SERVICE.XAI_ERROR : ERROR.SERVICE.ANTHROPIC_ERROR)
    }
})
