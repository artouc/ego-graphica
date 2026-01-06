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
}
