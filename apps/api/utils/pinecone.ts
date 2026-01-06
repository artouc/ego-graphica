/**
 * ego Graphica - Pinecone 初期化
 */

import { Pinecone, type Index } from "@pinecone-database/pinecone"
import { LOG } from "@egographica/shared"
import type { VectorMetadata } from "@egographica/shared"

let pinecone_client: Pinecone | null = null
let pinecone_index: Index | null = null

/** Pinecone クライアントを初期化 */
export function initializePinecone(): Pinecone {
    if (pinecone_client) {
        return pinecone_client
    }

    console.log(LOG.PINECONE.INITIALIZING)

    const config = useRuntimeConfig()

    pinecone_client = new Pinecone({
        apiKey: config.pineconeApiKey
    })

    console.log(LOG.PINECONE.INITIALIZED)

    return pinecone_client
}

/** Pinecone インデックスを取得 */
export function getPineconeIndex(): Index {
    if (pinecone_index) {
        return pinecone_index
    }

    const client = initializePinecone()
    const config = useRuntimeConfig()

    pinecone_index = client.index(config.pineconeIndex)
    console.log(LOG.PINECONE.INDEX_CONNECTED)

    return pinecone_index
}

/** ベクトルをUpsert */
export async function upsertVectors(
    namespace: string,
    vectors: Array<{
        id: string
        values: number[]
        metadata: VectorMetadata
    }>
): Promise<void> {
    console.log(LOG.DATA.VECTOR_UPSERTING)

    const index = getPineconeIndex()
    const ns = index.namespace(namespace)

    await ns.upsert(vectors)

    console.log(LOG.DATA.VECTOR_UPSERTED)
}

/** ベクトル検索 */
export async function queryVectors(
    namespace: string,
    vector: number[],
    top_k: number = 10,
    filter?: Record<string, unknown>
): Promise<Array<{ id: string; score: number; metadata: VectorMetadata }>> {
    const index = getPineconeIndex()
    const ns = index.namespace(namespace)

    const result = await ns.query({
        vector,
        topK: top_k,
        includeMetadata: true,
        filter
    })

    return (result.matches || []).map((match) => ({
        id: match.id,
        score: match.score || 0,
        metadata: match.metadata as VectorMetadata
    }))
}

/** ベクトルを削除 */
export async function deleteVectors(
    namespace: string,
    ids: string[]
): Promise<void> {
    const index = getPineconeIndex()
    const ns = index.namespace(namespace)

    await ns.deleteMany(ids)
}
