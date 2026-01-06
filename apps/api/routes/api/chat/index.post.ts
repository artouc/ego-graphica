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
import { getClaudeOpus } from "~/utils/anthropic"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR } from "@egographica/shared"
import type { Persona } from "@egographica/shared"

interface RequestBody {
    bucket: string
    message: string
    session_id?: string
}

/** ペルソナからシステムプロンプトを生成（CAG） */
function buildSystemPrompt(persona: Persona | null, context: string): string {
    let prompt = `あなたはアーティストの代わりに顧客対応を行うAIエージェント「ego Graphica」です。`

    if (persona) {
        prompt += `\n\n## キャラクター設定`
        if (persona.character) {
            prompt += `\nあなたの名前は「${persona.character}」です。`
        }
        prompt += `\nモチーフ: ${persona.motif}`
        prompt += `\n話し方: ${getToneDescription(persona.tone)}`
        prompt += `\n創作哲学: ${persona.philosophy}`

        if (persona.influences.length > 0) {
            prompt += `\n影響を受けた作家・文化: ${persona.influences.join("、")}`
        }

        if (persona.avoidances.length > 0) {
            prompt += `\n\n## 避けるべきトピック\n${persona.avoidances.join("、")}についての話題は避けてください。`
        }

        if (persona.samples.length > 0) {
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
- わからないことは正直に「確認します」と伝えてください`

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

    let persona: Persona | null = null
    try {
        const persona_doc = await db.collection(body.bucket).doc("persona").get()
        if (persona_doc.exists) {
            persona = persona_doc.data() as Persona
        }
    } catch (e) {
        console.error("Failed to load persona:", e)
    }

    let context = ""
    try {
        const query_embedding = await generateEmbedding(body.message)
        const results = await queryVectors(body.bucket, query_embedding, 5)

        if (results.length > 0) {
            context = results
                .map((r, i) => `[${i + 1}] ${r.metadata.title}\n${r.metadata.text}`)
                .join("\n\n")
        }
    } catch (e) {
        console.error("RAG search failed:", e)
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

    await messages_ref.add({
        role: "user",
        content: body.message,
        created: FieldValue.serverTimestamp()
    })

    const model = getClaudeOpus()

    try {
        console.log("Calling Claude API...")

        const { text, toolCalls } = await generateText({
            model,
            system: system_prompt,
            messages: [
                { role: "user", content: body.message }
            ],
            tools: {
                showPortfolio: tool({
                    description: "作品ポートフォリオを表示する",
                    parameters: z.object({
                        category: z.string().optional().describe("カテゴリでフィルター"),
                        limit: z.number().optional().describe("表示件数")
                    }),
                    execute: async ({ category, limit = 6 }) => {
                        const works_snapshot = await db
                            .collection(body.bucket)
                            .doc("works")
                            .collection("items")
                            .orderBy("created", "desc")
                            .limit(limit)
                            .get()

                        const works = works_snapshot.docs.map(doc => ({
                            id: doc.data().id,
                            title: doc.data().title,
                            url: doc.data().url,
                            status: doc.data().status
                        }))

                        return { works, total: works.length }
                    }
                }),
                searchWorks: tool({
                    description: "キーワードや要望に合った作品を検索する",
                    parameters: z.object({
                        query: z.string().describe("検索クエリ")
                    }),
                    execute: async ({ query }) => {
                        const embedding = await generateEmbedding(query)
                        const results = await queryVectors(body.bucket, embedding, 5, {
                            sourcetype: "work"
                        })

                        return {
                            works: results.map(r => ({
                                id: r.metadata.source,
                                title: r.metadata.title,
                                score: r.score
                            }))
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

        console.log("Claude API response received")

        const full_response = text

        await messages_ref.add({
            role: "assistant",
            content: full_response,
            tools: toolCalls || null,
            created: FieldValue.serverTimestamp()
        })

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
            tools: toolCalls || []
        })
    } catch (e) {
        console.error("Chat generation failed:", e)
        serverError(ERROR.SERVICE.ANTHROPIC_ERROR)
    }
})
