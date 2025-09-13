<script setup lang="ts">
const props = defineProps<{
    id?: string;
    name?: string;
    label?: string | boolean;
}>();
const aa  =  new Array();
</script>
<script lang="ts">
export default {
    inheritAttrs: false,
};
</script>
<template>
    <DIV v-bind="props"/>
</template>
