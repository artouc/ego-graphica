/**
 * ego Graphica - ヒアリングAPI
 * POST /api/hearing
 */

import { defineEventHandler, readBody, H3Event } from "h3"
import { FieldValue } from "firebase-admin/firestore"
import { generateText } from "ai"
import { getFirestoreInstance } from "~/utils/firebase"
import { getClaudeOpus } from "~/utils/anthropic"
import { success, validationError, serverError } from "~/utils/response"
import { LOG, ERROR } from "@egographica/shared"

interface RequestBody {
    bucket: string
    message: string
    hearing_id?: string
}

const SYSTEM_PROMPT = `あなたはアーティストからフィードバックを収集するAIアシスタントです。

## 役割
- アーティストがAIエージェントとの対話で感じた違和感や改善点を聞き出す
- 具体的なシチュエーションや発言を引き出す
- 建設的なフィードバックを促す

## 質問例
- 「エージェントのどのような対応に違和感を感じましたか？」
- 「その時、どのような返答をしてほしかったですか？」
- 「あなたらしさが出ていないと感じた点はありますか？」
- 「顧客にどのような印象を与えたいですか？」

## 注意
- 共感的に傾聴する
- 具体的なエピソードを深掘りする
- 改善提案につなげる質問をする`

export default defineEventHandler(async (event: H3Event) => {
    const body = await readBody<RequestBody>(event)

    if (!body.bucket || !body.message) {
        validationError(ERROR.VALIDATION.REQUIRED_FIELD)
    }

    console.log(LOG.AI.CHAT_GENERATING, { bucket: body.bucket, type: "hearing" })

    const db = getFirestoreInstance()

    let hearing_id = body.hearing_id
    let previous_messages: Array<{ role: string; content: string }> = []

    if (!hearing_id) {
        const hearing_ref = db.collection(body.bucket).doc("hearings").collection("items").doc()
        hearing_id = hearing_ref.id
        await hearing_ref.set({
            id: hearing_id,
            started: FieldValue.serverTimestamp(),
            updated: FieldValue.serverTimestamp(),
            messages: 0
        })
    } else {
        const messages_snapshot = await db
            .collection(body.bucket)
            .doc("hearings")
            .collection("items")
            .doc(hearing_id)
            .collection("messages")
            .orderBy("created", "asc")
            .limit(20)
            .get()

        previous_messages = messages_snapshot.docs.map(doc => ({
            role: doc.data().role as string,
            content: doc.data().content as string
        }))
    }

    const messages_ref = db
        .collection(body.bucket)
        .doc("hearings")
        .collection("items")
        .doc(hearing_id)
        .collection("messages")

    await messages_ref.add({
        role: "user",
        content: body.message,
        created: FieldValue.serverTimestamp()
    })

    const model = getClaudeOpus()

    try {
        const all_messages = [
            ...previous_messages.map(m => ({
                role: m.role as "user" | "assistant",
                content: m.content
            })),
            { role: "user" as const, content: body.message }
        ]

        const { text } = await generateText({
            model,
            system: SYSTEM_PROMPT,
            messages: all_messages
        })

        await messages_ref.add({
            role: "assistant",
            content: text,
            created: FieldValue.serverTimestamp()
        })

        await db
            .collection(body.bucket)
            .doc("hearings")
            .collection("items")
            .doc(hearing_id)
            .update({
                updated: FieldValue.serverTimestamp(),
                messages: FieldValue.increment(2)
            })

        console.log(LOG.AI.CHAT_GENERATED)

        return success(event, {
            hearing_id,
            message: text
        })
    } catch (e) {
        console.error("Hearing chat failed:", e)
        serverError(ERROR.SERVICE.ANTHROPIC_ERROR)
    }
})
