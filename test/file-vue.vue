<script setup lang="ts">
/*
do not autofix this file, it contains linting error intentionally, for debugging
*/

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
