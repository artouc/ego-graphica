import type {
  ArtistResponse,
  WorkUploadResponse,
  HealthResponse
} from '@egographica/shared'

export function useApi() {
  const config = useRuntimeConfig()
  const baseUrl = config.public.apiUrl

  const fetchApi = async <T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> => {
    const response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    })

    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`)
    }

    return response.json()
  }

  return {
    // Health check
    health: () => fetchApi<HealthResponse>('/health'),

    // Artist
    getArtist: (id: string) => fetchApi<ArtistResponse>(`/artist/${id}`),

    // Work upload
    uploadWork: async (formData: FormData): Promise<WorkUploadResponse> => {
      const response = await fetch(`${baseUrl}/ingest/work`, {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }

      return response.json()
    }
  }
}
