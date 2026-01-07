/**
 * ego Graphica - 文体分析ユーティリティ
 * テキストサンプルから口調・文体を分析してCAGに活用
 */

import { generateText } from "ai"
import { getClaudeSonnet } from "./anthropic"
import type { WritingStyle } from "@egographica/shared"

/** 分析に必要な最小文字数 */
const MIN_TEXT_LENGTH = 100

/** サンプル文の最大数 */
const MAX_STYLE_SAMPLES = 5

/** サンプル文の最大長 */
const MAX_SAMPLE_LENGTH = 150

/**
 * テキストから代表的な文章サンプルを抽出
 */
export function extractStyleSamples(texts: string[]): string[] {
    const samples: string[] = []

    for (const text of texts) {
        // 文で分割
        const sentences = text
            .split(/[。！？\n]/)
            .map(s => s.trim())
            .filter(s => s.length >= 20 && s.length <= MAX_SAMPLE_LENGTH)

        for (const sentence of sentences) {
            // 挨拶や定型文を除外
            if (isGenericSentence(sentence)) continue

            samples.push(sentence)
            if (samples.length >= MAX_STYLE_SAMPLES * 2) break
        }

        if (samples.length >= MAX_STYLE_SAMPLES * 2) break
    }

    // 多様性を持たせるためランダムに選択
    const shuffled = samples.sort(() => Math.random() - 0.5)
    return shuffled.slice(0, MAX_STYLE_SAMPLES)
}

/**
 * 定型文かどうかを判定
 */
function isGenericSentence(sentence: string): boolean {
    const generic_patterns = [
        /^(こんにちは|こんばんは|おはよう|はじめまして)/,
        /^(ありがとう|よろしく)/,
        /^https?:\/\//,
        /^\d+円/,
        /^[\d\s:\/\-]+$/ // 日付や時間のみ
    ]

    return generic_patterns.some(p => p.test(sentence))
}

/**
 * Claude で文体を分析
 */
export async function analyzeWritingStyle(texts: string[]): Promise<WritingStyle | null> {
    // テキストを結合
    const combined_text = texts.join("\n\n")

    if (combined_text.length < MIN_TEXT_LENGTH) {
        console.log("Text too short for style analysis:", combined_text.length)
        return null
    }

    // 分析用に制限
    const analysis_text = combined_text.slice(0, 5000)

    const prompt = `以下のテキストの文体・口調を分析し、JSON形式で結果を返してください。

テキスト:
${analysis_text}

以下のJSON形式で返してください:
{
    "sentence_endings": ["よく使われる文末表現を3-5個"],
    "punctuation": {
        "uses_exclamation": true/false,
        "uses_question_marks": true/false,
        "uses_emoji": true/false,
        "period_style": "。" または "." または "none",
        "comma_style": "、" または ","
    },
    "formality_level": 0.0-1.0の数値（1.0が最もフォーマル）,
    "characteristic_phrases": ["特徴的な言い回しを3-5個"],
    "avoid_patterns": ["使われていないパターンを2-3個"],
    "sentence_length": "short" または "medium" または "long",
    "description": "この人の文体を50文字程度で説明"
}

JSONのみを返してください。`

    try {
        const model = getClaudeSonnet()

        const { text } = await generateText({
            model,
            messages: [{ role: "user", content: prompt }],
            maxTokens: 1000
        })

        const json_match = text.match(/\{[\s\S]*\}/)
        if (!json_match) {
            console.error("Failed to parse style analysis result")
            return null
        }

        const result = JSON.parse(json_match[0]) as WritingStyle
        console.log("Writing style analyzed:", result.description)

        return result
    } catch (e) {
        console.error("Style analysis failed:", e)
        return null
    }
}

/**
 * Firestoreからテキストコンテンツを収集
 */
export async function collectTextContent(
    db: FirebaseFirestore.Firestore,
    bucket: string
): Promise<string[]> {
    const texts: string[] = []

    // 3つのソースを並列で取得
    const [files_result, urls_result, hearings_result] = await Promise.allSettled([
        // ファイルからテキストを取得
        db.collection(bucket)
            .doc("files")
            .collection("items")
            .orderBy("created", "desc")
            .limit(10)
            .get(),
        // URLからテキストを取得
        db.collection(bucket)
            .doc("urls")
            .collection("items")
            .orderBy("created", "desc")
            .limit(10)
            .get(),
        // ヒアリングからテキストを取得
        db.collection(bucket)
            .doc("hearings")
            .collection("items")
            .orderBy("created", "desc")
            .limit(5)
            .get()
    ])

    // ファイルのテキスト
    if (files_result.status === "fulfilled") {
        for (const doc of files_result.value.docs) {
            const file = doc.data()
            if (file.text_content) {
                texts.push(file.text_content)
            }
        }
    }

    // URLのテキスト
    if (urls_result.status === "fulfilled") {
        for (const doc of urls_result.value.docs) {
            const url_data = doc.data()
            if (url_data.text_content) {
                texts.push(url_data.text_content)
            }
        }
    }

    // ヒアリングのテキスト（アシスタントの発言のみ）
    if (hearings_result.status === "fulfilled") {
        for (const doc of hearings_result.value.docs) {
            const hearing = doc.data()
            if (hearing.messages) {
                const assistant_messages = hearing.messages
                    .filter((m: { role: string }) => m.role === "assistant")
                    .map((m: { content: string }) => m.content)
                texts.push(...assistant_messages)
            }
        }
    }

    return texts
}

/**
 * 2つのWritingStyleをマージ（新しい分析結果を優先しつつ既存も保持）
 */
export function mergeWritingStyles(
    existing: WritingStyle | undefined | null,
    new_style: WritingStyle | null
): WritingStyle | null {
    if (!new_style) return existing || null
    if (!existing) return new_style

    // 新しい分析結果を基本に、一部のフィールドは既存とマージ
    return {
        sentence_endings: [...new Set([...new_style.sentence_endings, ...existing.sentence_endings])].slice(0, 5),
        punctuation: new_style.punctuation, // 新しい方を優先
        formality_level: (new_style.formality_level + existing.formality_level) / 2, // 平均
        characteristic_phrases: [...new Set([...new_style.characteristic_phrases, ...existing.characteristic_phrases])].slice(0, 5),
        avoid_patterns: [...new Set([...new_style.avoid_patterns, ...existing.avoid_patterns])].slice(0, 3),
        sentence_length: new_style.sentence_length, // 新しい方を優先
        description: new_style.description // 新しい方を優先
    }
}

/**
 * 2つのスタイルサンプル配列をマージ（重複を除去）
 */
export function mergeStyleSamples(
    existing: string[] | undefined | null,
    new_samples: string[]
): string[] {
    if (!existing || existing.length === 0) return new_samples
    if (new_samples.length === 0) return existing

    // 重複を除去して結合、最大数を制限
    const merged = [...new Set([...new_samples, ...existing])]
    return merged.slice(0, MAX_STYLE_SAMPLES)
}
