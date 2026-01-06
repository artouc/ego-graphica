export default defineNuxtConfig({
    compatibilityDate: "2025-01-06",
    future: {
        compatibilityVersion: 4
    },
    srcDir: "app",
    devServer: {
        port: 3010
    },
    modules: [
        "@nuxtjs/tailwindcss"
    ],
    css: [
        "~/assets/css/main.css"
    ],
    runtimeConfig: {
        public: {
            apiUrl: process.env.NUXT_PUBLIC_API_URL
        }
    },
    typescript: {
        strict: true,
        typeCheck: false
    },
    devtools: {
        enabled: true
    },
    app: {
        head: {
            title: "ego Graphica",
            htmlAttrs: {
                lang: "ja"
            },
            meta: [
                { charset: "utf-8" },
                { name: "viewport", content: "width=device-width, initial-scale=1" },
                { name: "description", content: "ego Graphica - AIアーティストエージェント" }
            ]
        }
    }
})
