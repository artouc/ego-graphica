/**
 * ego Graphica - バケット・アーティスト設定 composable
 */

const BUCKET_KEY = "egographica_bucket"
const ARTIST_NAME_KEY = "egographica_artist_name"

export function useAuth() {
    const bucket = useState<string>("bucket", () => "")
    const artist_name = useState<string>("artist_name", () => "")

    const is_configured = computed(() => !!bucket.value && !!artist_name.value)

    function initializeFromStorage() {
        if (import.meta.client) {
            const stored_bucket = localStorage.getItem(BUCKET_KEY)
            const stored_name = localStorage.getItem(ARTIST_NAME_KEY)
            if (stored_bucket) {
                bucket.value = stored_bucket
            }
            if (stored_name) {
                artist_name.value = stored_name
            }
        }
    }

    function saveSettings(new_bucket: string, new_name: string) {
        if (import.meta.client) {
            localStorage.setItem(BUCKET_KEY, new_bucket)
            localStorage.setItem(ARTIST_NAME_KEY, new_name)
        }
        bucket.value = new_bucket
        artist_name.value = new_name
    }

    function clearSettings() {
        if (import.meta.client) {
            localStorage.removeItem(BUCKET_KEY)
            localStorage.removeItem(ARTIST_NAME_KEY)
        }
        bucket.value = ""
        artist_name.value = ""
    }

    return {
        bucket: readonly(bucket),
        artist_name: readonly(artist_name),
        is_configured,
        initializeFromStorage,
        saveSettings,
        clearSettings
    }
}
