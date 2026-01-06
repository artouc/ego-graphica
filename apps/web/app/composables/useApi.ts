/**
 * ego Graphica - API クライアント composable
 */

import type { ApiResponse } from "@egographica/shared"

export function useApi() {
    const config = useRuntimeConfig()
    const auth = useAuth()

    async function request<T>(
        path: string,
        options: {
            method?: "GET" | "POST" | "PUT" | "DELETE"
            body?: unknown
        } = {}
    ): Promise<T> {
        const { method = "GET", body } = options

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            "X-API-Key": config.public.masterApiKey,
            "X-Bucket": auth.bucket.value
        }

        const response = await $fetch<ApiResponse<T>>(`${config.public.apiUrl}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        })

        if (response.error) {
            throw new Error(response.error.message)
        }

        return response.data as T
    }

    return {
        get: <T>(path: string) =>
            request<T>(path, { method: "GET" }),

        post: <T>(path: string, body: unknown) =>
            request<T>(path, { method: "POST", body }),

        put: <T>(path: string, body: unknown) =>
            request<T>(path, { method: "PUT", body }),

        delete: <T>(path: string) =>
            request<T>(path, { method: "DELETE" })
    }
}
