/**
 * ego Graphica - ペルソナ設定
 * Firestore: /{bucket}/persona
 */

import type { PersonaTone } from "./enums"

/** 理想的な応答例 */
export interface SampleResponse {
    /** 状況説明 */
    situation: string
    /** 顧客の発言例 */
    message: string
    /** 理想的な応答 */
    response: string
}

/** 句読点スタイル */
export interface PunctuationStyle {
    /** 感嘆符を使用するか */
    uses_exclamation: boolean
    /** 疑問符を多用するか */
    uses_question_marks: boolean
    /** 絵文字を使用するか */
    uses_emoji: boolean
    /** 句点スタイル（。, ., なし） */
    period_style: "。" | "." | "none"
    /** 読点スタイル（、, ,） */
    comma_style: "、" | ","
}

/** 文体分析結果 */
export interface WritingStyle {
    /** 文末表現パターン（例: ["です", "ます", "である"]） */
    sentence_endings: string[]
    /** 句読点スタイル */
    punctuation: PunctuationStyle
    /** フォーマル度（0.0-1.0、1.0が最もフォーマル） */
    formality_level: number
    /** 特徴的なフレーズ */
    characteristic_phrases: string[]
    /** 避けるべきパターン */
    avoid_patterns: string[]
    /** 一文の平均的な長さ（短い/普通/長い） */
    sentence_length: "short" | "medium" | "long"
    /** 文体の総合的な説明 */
    description: string
}

/** ペルソナ設定（CAG用） */
export interface Persona {
    /** キャラクター名 */
    character?: string
    /** モチーフ（カエル、猫など） */
    motif: string
    /** 話し方のトーン */
    tone: PersonaTone
    /** 創作哲学 */
    philosophy: string
    /** 影響を受けた作家・文化 */
    influences: string[]
    /** 理想的な応答例 */
    samples: SampleResponse[]
    /** 避けるべきトピック */
    avoidances: string[]
    /** 文体分析結果（自動生成） */
    writing_style?: WritingStyle
    /** 実際のテキストから抽出したサンプル文 */
    style_samples?: string[]
}

/** Persona 作成・更新用 */
export interface PersonaUpsert {
    character?: string
    motif: string
    tone: PersonaTone
    philosophy: string
    influences: string[]
    samples: SampleResponse[]
    avoidances: string[]
    writing_style?: WritingStyle
    style_samples?: string[]
}
