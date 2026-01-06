<script setup lang="ts">
import { computed } from "vue"
import { cn } from "./utils"

interface Props {
    variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
    size?: "default" | "sm" | "lg" | "icon"
    disabled?: boolean
    loading?: boolean
    type?: "button" | "submit" | "reset"
}

const props = withDefaults(defineProps<Props>(), {
    variant: "default",
    size: "default",
    disabled: false,
    loading: false,
    type: "button"
})

const emit = defineEmits<{
    click: [event: MouseEvent]
}>()

const variant_classes = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    link: "text-primary underline-offset-4 hover:underline"
}

const size_classes = {
    default: "h-10 px-4 py-2",
    sm: "h-9 rounded-md px-3",
    lg: "h-11 rounded-md px-8",
    icon: "h-10 w-10"
}

const button_class = computed(() =>
    cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variant_classes[props.variant],
        size_classes[props.size]
    )
)

function handleClick(event: MouseEvent) {
    if (!props.disabled && !props.loading) {
        emit("click", event)
    }
}
</script>

<template>
    <button
        :type="type"
        :class="button_class"
        :disabled="disabled || loading"
        @click="handleClick"
    >
        <svg
            v-if="loading"
            class="mr-2 h-4 w-4 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
        >
            <circle
                class="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                stroke-width="4"
            />
            <path
                class="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
        </svg>
        <slot />
    </button>
</template>
