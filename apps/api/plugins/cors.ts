/**
 * ego Graphica - CORS Plugin
 */

export default defineNitroPlugin((nitro) => {
    nitro.hooks.hook("request", (event) => {
        const origin = process.env.WEB_URL || "*"

        event.node.res.setHeader("Access-Control-Allow-Origin", origin)
        event.node.res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        event.node.res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-Bucket")
        event.node.res.setHeader("Access-Control-Allow-Credentials", "true")

        if (event.node.req.method === "OPTIONS") {
            event.node.res.statusCode = 204
            event.node.res.end()
        }
    })
})
