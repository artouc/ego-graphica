/**
 * ego Graphica - ヘルスチェックAPI
 * GET /api/health
 */

import { defineEventHandler } from "h3"

export default defineEventHandler(() => {
    return {
        status: "ok",
        timestamp: new Date().toISOString()
    }
})
