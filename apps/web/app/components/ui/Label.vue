<script setup lang="ts">
import { cn } from "./utils"

interface Props {
    for?: string
    error?: boolean
}

const props = withDefaults(defineProps<Props>(), {
    error: false
})

const label_class = cn(
    "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
    props.error && "text-destructive"
)
</script>

<template>
    <label :for="props.for" :class="label_class">
        <slot />
    </label>
</template>
