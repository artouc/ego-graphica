/**
 * ego Graphica - Pineconeベクトルメタデータ
 */

import type { SourceType } from "./enums"

/** Pineconeベクトルメタデータ */
export interface VectorMetadata {
    /** アーティストバケット名（Namespace） */
    bucket: string
    /** データソース種別（work | url | file） */
    sourcetype: SourceType
    /** FirestoreドキュメントID */
    source: string
    /** タイトル */
    title: string
    /** 検索用テキスト（max 1000 chars） */
    text: string
    /** チャンクインデックス（0始まり） */
    chunk_index?: number
    /** 総チャンク数 */
    total_chunks?: number
    /** 主要な色（ImageAnalysisから） */
    colors?: string[]
    /** スタイル（ImageAnalysisから） */
    style?: string
    /** 雰囲気（ImageAnalysisから） */
    mood?: string
    /** 作成日時（ISO 8601） */
    created: string
}

/** Vector upsert用 */
export interface VectorUpsert {
    id: string
    values: number[]
    metadata: VectorMetadata
}
