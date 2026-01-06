/**
 * ego Graphica - テキストチャンキングユーティリティ
 */

export interface TextChunk {
    text: string
    index: number
}

export interface ChunkOptions {
    /** チャンクサイズ（文字数） */
    chunk_size: number
    /** オーバーラップサイズ（文字数） */
    overlap: number
}

const DEFAULT_OPTIONS: ChunkOptions = {
    chunk_size: 1000,
    overlap: 200
}

/**
 * テキストをチャンクに分割
 * - 文の途中で切らないよう、句点・改行で区切る
 * - オーバーラップで文脈を維持
 */
export function chunkText(text: string, options: Partial<ChunkOptions> = {}): TextChunk[] {
    const { chunk_size, overlap } = { ...DEFAULT_OPTIONS, ...options }

    if (!text || text.length === 0) {
        return []
    }

    // 短いテキストはそのまま
    if (text.length <= chunk_size) {
        return [{ text, index: 0 }]
    }

    const chunks: TextChunk[] = []
    let start = 0

    while (start < text.length) {
        let end = start + chunk_size

        // テキスト終端を超えないように
        if (end >= text.length) {
            chunks.push({
                text: text.slice(start).trim(),
                index: chunks.length
            })
            break
        }

        // 文の区切りを探す（句点、改行、段落）
        const search_start = Math.max(end - 100, start)
        const search_text = text.slice(search_start, end + 50)

        // 優先順位: 段落 > 句点 > 読点 > スペース
        const break_patterns = [
            /\n\n/g,
            /[。．！？]\s*/g,
            /[、，]\s*/g,
            /\s+/g
        ]

        let break_pos = -1

        for (const pattern of break_patterns) {
            pattern.lastIndex = 0
            let match: RegExpMatchArray | null

            while ((match = pattern.exec(search_text)) !== null) {
                const absolute_pos = search_start + match.index + match[0].length
                if (absolute_pos <= end + 50 && absolute_pos > start + chunk_size / 2) {
                    break_pos = absolute_pos
                }
            }

            if (break_pos > 0) {
                break
            }
        }

        // 区切りが見つからない場合はchunk_sizeで強制分割
        if (break_pos <= 0) {
            break_pos = end
        }

        chunks.push({
            text: text.slice(start, break_pos).trim(),
            index: chunks.length
        })

        // 次の開始位置（オーバーラップを考慮）
        start = break_pos - overlap
        if (start < 0) start = 0
    }

    return chunks.filter(chunk => chunk.text.length > 0)
}

/**
 * チャンク数を取得（プレビュー用）
 */
export function estimateChunkCount(text_length: number, options: Partial<ChunkOptions> = {}): number {
    const { chunk_size, overlap } = { ...DEFAULT_OPTIONS, ...options }

    if (text_length <= chunk_size) {
        return 1
    }

    const effective_size = chunk_size - overlap
    return Math.ceil((text_length - overlap) / effective_size)
}
