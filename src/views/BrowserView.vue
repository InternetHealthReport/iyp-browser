<script setup>
import { ref, watch, inject } from 'vue'
import InputPanel from '@/components/InputPanel.vue'
import OutputPanel from '@/components/OutputPanel.vue'
import DrawerPanel from '@/components/DrawerPanel.vue'
import { uid, copyToClipboard, useQuasar } from 'quasar'
import { useRoute, useRouter } from 'vue-router'

const GlobalVariables = inject('GlobalVariables')

const route = useRoute()
const router = useRouter()
const queries = ref(route.query.session ? JSON.parse(atob(route.query.session)) : [])
const outputPanel = ref()
const outputPanelHeight = ref(`${GlobalVariables.outputPanelHeight}px`)
const drawer = ref(true)
const $q = useQuasar()

const runQuery = (query) => {
  const uuid = uid()
  queries.value.push({ query, uuid })
}

const clearQuery = (uuid) => {
  queries.value = queries.value.filter((query) => query.uuid !== uuid)
}

const shareQuery = (query) => {
  const pathName =
    GlobalVariables.basePath.slice(-1) === '/'
      ? GlobalVariables.basePath
      : `${GlobalVariables.basePath}/`
  const session = btoa(JSON.stringify([query]))
  const urlToShare = `${window.location.origin}${pathName}?session=${session}`
  copyToClipboard(urlToShare)
    .then(() => {
      $q.notify({ message: 'Link copied to clipboard!', color: 'positive' })
    })
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
      session: btoa(JSON.stringify(queries.value))
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
  <q-layout class="container" container view="hHh Lpr lff">
    <q-header class="header" elevated>
      <q-toolbar>
        <q-btn @click="drawer = !drawer" icon="menu" dense outline />
        <q-toolbar-title>You are using IHR's custom IYP Browser!</q-toolbar-title>
        <q-btn
          outline
          dense
          label="Go back to Neo4J Browser"
          href="https://iyp.iijlab.net/iyp/browser/?dbms=iyp-bolt.iijlab.net:443"
        />
      </q-toolbar>
    </q-header>
    <q-drawer v-model="drawer" :width="300" :breakpoint="500">
      <DrawerPanel @run="runQuery" />
    </q-drawer>
    <q-page-container class="drawer-container">
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
            :hide-graph-overview="false"
            @clear="clearQuery(query.uuid)"
            @share="shareQuery(query)"
            @update="updateQuery($event, query.uuid)"
            class="output-panel"
          />
        </div>
      </div>
    </q-page-container>
  </q-layout>
</template>

<style scoped>
.container {
  display: flex;
  height: 100vh;
  flex-direction: column;
  background-color: #f9f9f9;
}
.header {
  background-color: #263238;
  color: #ffffff;
}
.browser-input-container {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin-top: 8px;
  margin-bottom: 16px;
}
.browser-output-container {
  display: flex;
  flex-direction: column-reverse;
  gap: 16px;
}
.output-panel {
  height: v-bind('outputPanelHeight');
}
.drawer-container {
  margin-left: 16px;
  margin-right: 16px;
}
</style>
