<script setup lang="ts">
import { computed } from "vue"
import { cn } from "./utils"

interface Props {
    variant?: "default" | "destructive"
}

const props = withDefaults(defineProps<Props>(), {
    variant: "default"
})

const variant_classes = {
    default: "bg-background text-foreground",
    destructive: "border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive"
}

const alert_class = computed(() =>
    cn(
        "relative w-full rounded-lg border p-4 [&>svg~*]:pl-7 [&>svg+div]:translate-y-[-3px] [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:text-foreground",
        variant_classes[props.variant]
    )
)
</script>

<template>
    <div :class="alert_class" role="alert">
        <slot />
    </div>
</template>
