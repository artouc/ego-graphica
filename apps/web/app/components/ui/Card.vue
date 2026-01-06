<script setup lang="ts">
import { cn } from "./utils"

interface Props {
    class?: string
}

const props = defineProps<Props>()

const card_class = cn(
    "rounded-lg border bg-card text-card-foreground shadow-sm",
    props.class
)
</script>

<template>
    <div :class="card_class">
        <slot />
    </div>
</template>
