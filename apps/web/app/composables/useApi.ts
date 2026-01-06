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
            requireAuth?: boolean
        } = {}
    ): Promise<T> {
        const { method = "GET", body, requireAuth = false } = options

        const headers: Record<string, string> = {
            "Content-Type": "application/json"
        }

        if (requireAuth && auth.token.value) {
            headers["Authorization"] = `Bearer ${auth.token.value}`
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
        get: <T>(path: string, requireAuth = false) =>
            request<T>(path, { method: "GET", requireAuth }),

        post: <T>(path: string, body: unknown, requireAuth = false) =>
            request<T>(path, { method: "POST", body, requireAuth }),

        put: <T>(path: string, body: unknown, requireAuth = false) =>
            request<T>(path, { method: "PUT", body, requireAuth }),

        delete: <T>(path: string, requireAuth = false) =>
            request<T>(path, { method: "DELETE", requireAuth })
    }
}
