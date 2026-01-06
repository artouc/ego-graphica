/**
 * ego Graphica - 作品データ
 * Firestore: /{bucket}/works/{workId}
 */

import type { Timestamp } from "firebase-admin/firestore"
import type { FileType, SalesStatus, WorkType } from "./enums"

/** Claude Vision画像解析結果（マルチモーダルRAG用） */
export interface ImageAnalysis {
    /** 主要な色（例: ["深い青", "白", "金"]） */
    colors: string[]
    /** 色の印象（例: "落ち着いた", "鮮やか"） */
    colormood: string
    /** 構図（例: "中央配置", "三分割"） */
    composition: string
    /** スタイル（例: "写実的", "抽象的"） */
    style: string
    /** 技法（例: "油彩風", "水彩風"） */
    technique: string
    /** 主題（例: "海辺の風景"） */
    subject: string
    /** 要素（例: ["波", "夕日", "岩"]） */
    elements: string[]
    /** 雰囲気（例: "静謐", "躍動的"） */
    mood: string
    /** 物語性 */
    narrative: string
    /** 推奨タグ */
    tags: string[]
    /** 検索用テキスト（全体を統合した自然言語説明） */
    searchable: string
}

/** 作品データ */
export interface Work {
    /** 作品ID（Firestore自動生成） */
    id: string
    /** Firebase Storage URL */
    url: string
    /** ファイル形式 */
    filetype: FileType
    /** タイトル */
    title: string
    /** 作成年月日 */
    date: Timestamp
    /** クライアントワーク or 自主制作 */
    worktype: WorkType
    /** クライアント名（worktype=client時のみ） */
    client?: string
    /** 販売状況 */
    status: SalesStatus
    /** 説明（自由記述） */
    description?: string
    /** 制作ストーリー（自由記述） */
    story?: string
    /** Claude Vision解析結果（マルチモーダルRAG用） */
    analysis?: ImageAnalysis
    /** 登録日時 */
    created: Timestamp
    /** 更新日時 */
    updated: Timestamp
}

/** Work 作成用 */
export interface WorkCreate {
    url: string
    filetype: FileType
    title: string
    date: Date
    worktype: WorkType
    client?: string
    status: SalesStatus
    description?: string
    story?: string
}

/** Work 更新用 */
export interface WorkUpdate {
    title?: string
    date?: Date
    worktype?: WorkType
    client?: string
    status?: SalesStatus
    description?: string
    story?: string
}
