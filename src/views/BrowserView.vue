<script setup>
import { ref, watch, inject } from "vue";
import InputPanel from "@/components/InputPanel.vue";
import OutputPanel from "@/components/OutputPanel.vue";
import { uid, copyToClipboard } from "quasar";
import { useRoute, useRouter } from "vue-router";

const GlobalVariables = inject("GlobalVariables");

const route = useRoute();
const router = useRouter();
const queries = ref(route.query.session ? JSON.parse(route.query.session) : []);
const outputPanel = ref();
const outputPanelHeight = ref(`${GlobalVariables.outputPanelHeight}px`);

const runQuery = (query, queryType) => {
  const uuid = uid();
  queries.value.push({ query, queryType, uuid });
};

const clearQuery = (uuid) => {
  queries.value = queries.value.filter((query) => query.uuid !== uuid);
};

const shareQuery = (query) => {
  const urlToShare = `${window.location.origin}/?session=[${JSON.stringify(query)}]`;
  copyToClipboard(urlToShare);
};

const updateQuery = (query, uuid) => {
  const index = queries.value.findIndex((obj) => obj.uuid === uuid);
  if (
    queries.value[index].query !== query.query ||
    queries.value[index].queryType !== query.queryType
  ) {
    queries.value = queries.value.map((obj) => {
      if (obj.uuid === uuid) {
        return {
          ...obj,
          query: query.query,
          queryType: query.queryType,
        };
      }
      return obj;
    });
  }
};

const pushRoute = () => {
  router.push({
    replace: true,
    query: Object.assign({}, route.query, {
      session: JSON.stringify(queries.value),
    }),
  });
};

watch(
  queries,
  () => {
    pushRoute();
  },
  { deep: true },
);
</script>

<template>
  <div class="container">
    <div class="browser-input-container">
      <InputPanel active-tab="cypher" @run="runQuery" />
    </div>
    <div class="browser-output-container">
      <div v-for="query in queries" :key="query.uuid">
        <OutputPanel
          ref="outputPanel"
          :query="query.query"
          :query-type-input="query.queryType"
          :disable-input="false"
          :disable-top-bar="false"
          :disable-resizer="false"
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
  height: v-bind("outputPanelHeight");
}
</style>
