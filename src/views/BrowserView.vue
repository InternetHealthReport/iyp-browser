<script setup>
import { ref, watch, inject } from 'vue'
import InputPanel from '@/components/InputPanel.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import { uid, copyToClipboard } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

const GlobalVariables = inject('GlobalVariables')

const route = useRoute()
const router = useRouter()
const queries = ref(route.query.session ? JSON.parse(route.query.session) : [])
const outputPanel = ref()
const outputPanelHeight = ref(`${GlobalVariables.outputPanelHeight}px`)

const runQuery = (query) => {
  const uuid = uid()
  queries.value.push({ query, uuid })
}

const clearQuery = (uuid) => {
  queries.value = queries.value.filter((query) => query.uuid !== uuid)
}

const shareQuery = (query) => {
  const urlToShare = `${window.location.origin}/?session=[${JSON.stringify(query)}]`
  copyToClipboard(urlToShare)
}

const updateQuery = (query, uuid) => {
  const index = queries.value.findIndex((obj) => obj.uuid === uuid)
  if (queries.value[index].query !== query.query) {
    queries.value = queries.value.map((obj) => {
      if (obj.uuid === uuid) {
        return {
          ...obj,
          query: query.query
        }
      }
      return obj
    })
  }
}

const pushRoute = () => {
  router.push({
    replace: true,
    query: Object.assign({}, route.query, {
      session: JSON.stringify(queries.value)
    })
  })
}

watch(
  queries,
  () => {
    pushRoute()
  },
  { deep: true }
)
</script>

<template>
  <div class="container">
    <q-banner dense inline-actions class="neo4j-browser-banner">
      You are using IHR's custom IYP Browser!
      <template v-slot:action>
        <q-btn
          outline
          dense
          label="Go back to Neo4J Browser"
          size="sm"
          href="https://iyp.iijlab.net/iyp/browser/?dbms=iyp-bolt.iijlab.net:443"
        />
      </template>
    </q-banner>
    <div class="browser-input-container">
      <InputPanel @run="runQuery" />
    </div>
    <div class="browser-output-container">
      <div v-for="query in queries" :key="query.uuid">
        <OutputPanel
          ref="outputPanel"
          :query="query.query"
          :disable-input="false"
          :disable-top-bar="false"
          :disable-resizer="GlobalVariables.disableOutputPanelResizer"
          @clear="clearQuery(query.uuid)"
          @share="shareQuery(query)"
          @update="updateQuery($event, query.uuid)"
          class="output-panel"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.container {
  display: flex;
  height: 100vh;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background-color: #f9f9f9;
}
.browser-input-container {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
.browser-output-container {
  display: flex;
  flex-direction: column-reverse;
  gap: 16px;
}
.output-panel {
  height: v-bind('outputPanelHeight');
}
.neo4j-browser-banner {
  background-color: #263238;
  color: #ffffff;
  margin-top: -16px;
  margin-left: -16px;
  margin-right: -16px;
}
</style>
