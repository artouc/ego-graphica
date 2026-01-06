/**
 * ego Graphica - 文体分析ユーティリティ
 * アップロードされたテキストから文体特徴を抽出
 */

import { generateText } from "ai"
import { getClaudeSonnet } from "./anthropic"
import { LOG } from "@egographica/shared"
import type { WritingStyle } from "@egographica/shared"

/** 文体分析のプロンプト */
const STYLE_ANALYSIS_PROMPT = `以下のテキストの文体を詳細に分析し、JSON形式で結果を返してください。

分析観点:
1. 文末表現のパターン（です/ます調、である調、だ調など）
2. 句読点の使い方（感嘆符、疑問符、絵文字の使用有無）
3. フォーマル度（0.0-1.0）
4. 特徴的なフレーズや言い回し
5. 避けているパターン（使われていない表現）
6. 文の長さの傾向

以下のJSON形式で返してください:
{
    "sentence_endings": ["文末表現を3-5個"],
    "punctuation": {
        "uses_exclamation": false,
        "uses_question_marks": false,
        "uses_emoji": false,
        "period_style": "。",
        "comma_style": "、"
    },
    "formality_level": 0.8,
    "characteristic_phrases": ["特徴的なフレーズを3-5個"],
    "avoid_patterns": ["使われていないパターンを3-5個"],
    "sentence_length": "medium",
    "description": "この文体の総合的な特徴を1-2文で"
}

JSONのみを返してください。`

/** サンプル文抽出のプロンプト */
const SAMPLE_EXTRACTION_PROMPT = `以下のテキストから、この著者の文体を最もよく表している文を5つ選んでください。

選定基準:
- 著者の語り口や考え方が表れている文
- 特徴的な言い回しや表現が含まれる文
- 完結した意味を持つ文（断片的でないもの）

JSON配列形式で返してください:
["文1", "文2", "文3", "文4", "文5"]

JSONのみを返してください。`

/**
 * テキストから文体を分析
 */
export async function analyzeWritingStyle(text: string): Promise<WritingStyle> {
    console.log(LOG.AI.STYLE_ANALYZING)

    const model = getClaudeSonnet()

    // テキストが長すぎる場合は先頭部分を使用
    const analysis_text = text.slice(0, 10000)

    const { text: result } = await generateText({
        model,
        messages: [
            {
                role: "user",
                content: `${STYLE_ANALYSIS_PROMPT}\n\n---\n\n${analysis_text}`
            }
        ]
    })

    console.log(LOG.AI.STYLE_ANALYZED)

    const json_match = result.match(/\{[\s\S]*\}/)
    if (!json_match) {
        throw new Error("Failed to parse writing style analysis result")
    }

    return JSON.parse(json_match[0]) as WritingStyle
}

/**
 * テキストからサンプル文を抽出
 */
export async function extractStyleSamples(text: string): Promise<string[]> {
    console.log(LOG.AI.STYLE_SAMPLES_EXTRACTING)

    const model = getClaudeSonnet()

    // テキストが長すぎる場合は先頭部分を使用
    const analysis_text = text.slice(0, 10000)

    const { text: result } = await generateText({
        model,
        messages: [
            {
                role: "user",
                content: `${SAMPLE_EXTRACTION_PROMPT}\n\n---\n\n${analysis_text}`
            }
        ]
    })

    console.log(LOG.AI.STYLE_SAMPLES_EXTRACTED)

    const json_match = result.match(/\[[\s\S]*\]/)
    if (!json_match) {
        throw new Error("Failed to parse style samples result")
    }

    return JSON.parse(json_match[0]) as string[]
}

/**
 * 既存の文体分析結果と新しい分析結果をマージ
 * 複数ファイルからの分析を統合するため
 */
export function mergeWritingStyles(
    existing: WritingStyle | undefined,
    new_style: WritingStyle
): WritingStyle {
    if (!existing) {
        return new_style
    }

    // 文末表現をマージ（重複排除）
    const merged_endings = [...new Set([...existing.sentence_endings, ...new_style.sentence_endings])]

    // 特徴的フレーズをマージ（最大10個）
    const merged_phrases = [...new Set([...existing.characteristic_phrases, ...new_style.characteristic_phrases])].slice(0, 10)

    // 避けるパターンをマージ
    const merged_avoids = [...new Set([...existing.avoid_patterns, ...new_style.avoid_patterns])]

    // フォーマル度は平均
    const avg_formality = (existing.formality_level + new_style.formality_level) / 2

    // 句読点スタイルは新しい方を優先（より多くのデータから）
    // ただしフラグはAND（両方で使用されている場合のみtrue）
    const merged_punctuation = {
        uses_exclamation: existing.punctuation.uses_exclamation && new_style.punctuation.uses_exclamation,
        uses_question_marks: existing.punctuation.uses_question_marks || new_style.punctuation.uses_question_marks,
        uses_emoji: existing.punctuation.uses_emoji && new_style.punctuation.uses_emoji,
        period_style: new_style.punctuation.period_style,
        comma_style: new_style.punctuation.comma_style
    }

    return {
        sentence_endings: merged_endings.slice(0, 5),
        punctuation: merged_punctuation,
        formality_level: Math.round(avg_formality * 100) / 100,
        characteristic_phrases: merged_phrases,
        avoid_patterns: merged_avoids.slice(0, 10),
        sentence_length: new_style.sentence_length,
        description: new_style.description
    }
}

/**
 * サンプル文をマージ（最大10個を維持）
 */
export function mergeStyleSamples(
    existing: string[] | undefined,
    new_samples: string[]
): string[] {
    if (!existing) {
        return new_samples.slice(0, 10)
    }

    // 重複を排除してマージ
    const merged = [...new Set([...existing, ...new_samples])]
    return merged.slice(0, 10)
}
