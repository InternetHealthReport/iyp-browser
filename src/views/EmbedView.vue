<script setup>
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import OutputPanel from '@/components/OutputPanel.vue'

const route = useRoute()
const query = ref(JSON.parse(atob(route.query.session))[0])
</script>

<template>
  <OutputPanel
    :query="query.query"
    :disable-input="true"
    :disable-top-bar="true"
    :disable-resizer="true"
    class="fullscreen"
  />
</template>

<style scoped></style>
