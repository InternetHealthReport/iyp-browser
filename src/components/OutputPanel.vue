<script setup>
import { ref, inject, onMounted } from "vue";
import InputPanel from "@/components/InputPanel.vue";
import GraphOutput from "@/components/output/GraphOutput.vue";
import TableOutput from "@/components/output/TableOutput.vue";
import ExplanationOutput from "@/components/output/ExplanationOutput.vue";
import { version } from "../../package.json";
import interact from "interactjs";
import Iframe from "@/components/Iframe.vue";

const Neo4jApi = inject("Neo4jApi");
const LlmApi = inject("LlmApi");
const GlobalVariables = inject("GlobalVariables");

const emits = defineEmits(["clear", "share", "update"]);

const props = defineProps([
  "query",
  "queryTypeInput",
  "disableInput",
  "disableTopBar",
  "disableResizer",
]);

const cypherQuery = ref("");
const textQuery = ref("");
const queryType = ref("");
const tab = ref("graph");
const splitter = ref(110);
const loading = ref(false);
const nodes = ref([]);
const relationships = ref([]);
const rows = ref([]);
const columns = ref([]);
const explanationText = ref("");
const errorText = ref("");
const outputPanel = ref();
const isFullscreen = ref(false);
const heightBeforeFullscreen = ref("");
let previousEditorHeight = 0;

const runCypher = async (cypher) => {
  loading.value = true;
  const res = await Neo4jApi.run(cypher);
  if (res["error"] === undefined) {
    nodes.value = res.graph.nodes;
    relationships.value = res.graph.relationships;
    rows.value = res.table.rows;
    columns.value = res.table.columns;
    if (!nodes.value.length) {
      tab.value = "table";
    }
  } else {
    errorText.value = res.error;
    tab.value = "error";
    nodes.value = [];
    relationships.value = [];
    rows.value = [];
    columns.value = [];
    explanationText.value = [];
  }
  loading.value = false;
};

const runLlm = async (text) => {
  loading.value = true;
  const res = await LlmApi.run(text);
  cypherQuery.value = res.cypher;
  explanationText.value = res.explanation;
  runCypher(cypherQuery.value);
  loading.value = false;
};

const run = async (queryInput, queryInputType) => {
  queryType.value = queryInputType;
  errorText.value = "";
  tab.value = "graph";
  if (queryType.value === "cypher") {
    cypherQuery.value = queryInput;
    textQuery.value = "";
    runCypher(cypherQuery.value);
  } else {
    textQuery.value = queryInput;
    runLlm(textQuery.value);
  }
  emits("update", {
    query: queryInput,
    queryType: queryInputType,
  });
};

const fullscreenQuery = (isFullscreen) => {
  if (isFullscreen) {
    outputPanel.value.classList.add("fullscreen");
    heightBeforeFullscreen.value = outputPanel.value.style.height;
    outputPanel.value.style.height = "100vh";
  } else {
    outputPanel.value.classList.remove("fullscreen");
    outputPanel.value.style.height = heightBeforeFullscreen.value;
  }
};

const handleEditorHeightChange = (newHeight) => {
  const diff = newHeight - previousEditorHeight;
  previousEditorHeight = newHeight;
  const height = outputPanel.value.offsetHeight;
  outputPanel.value.style.height = `${height + diff}px`;
};

onMounted(() => {
  run(props.query, props.queryTypeInput);
  if (!props.disableResizer) {
    interact(outputPanel.value)
      .origin("self")
      .resizable({
        edges: { top: false, left: false, bottom: true, right: false },
        inertia: true,
        listeners: {
          move: (event) => {
            outputPanel.value.style.height = `${event.rect.height}px`;
          },
        },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { height: GlobalVariables.outputPanelHeight },
            max: { height: 800 },
          }),
        ],
      });
  }
});
</script>

<template>
  <div class="output-panel" ref="outputPanel">
    <q-bar class="output-bar" v-if="!disableTopBar">
      <q-space />
      <q-btn dense flat icon="link" color="white" @click="emits('share')">
        <q-tooltip>Share</q-tooltip>
      </q-btn>
      <Iframe :query="cypherQuery" :query-type="queryType" />
      <q-btn
        dense
        flat
        :icon="isFullscreen ? 'fullscreen_exit' : 'fullscreen'"
        color="white"
        @click="fullscreenQuery((isFullscreen = !isFullscreen))"
      >
        <q-tooltip>Fullscreen</q-tooltip>
      </q-btn>
      <q-btn dense flat icon="close" color="white" @click="emits('clear')">
        <q-tooltip>Close</q-tooltip>
      </q-btn>
    </q-bar>
    <InputPanel
      v-if="!disableInput"
      :cypher-input="cypherQuery"
      :text-input="textQuery"
      :active-tab="queryType"
      :serve-in-output="true"
      @run="run"
      @clear="emits('clear')"
      @editorHeightChanged="handleEditorHeightChange"
    />
    <q-skeleton v-if="loading" width="100%" height="100%" animation="wave" />
    <div v-else class="output-container">
      <q-splitter v-model="splitter" disable unit="px" class="output-tabs">
        <template v-slot:before>
          <q-tabs v-model="tab" dense vertical>
            <q-tab name="graph" label="Graph" v-if="nodes.length" />
            <q-tab name="table" label="Table" v-if="rows.length" />
            <q-tab
              name="explanation"
              label="Explanation"
              v-if="textQuery !== ''"
            />
            <q-tab name="error" label="Error" v-if="errorText !== ''" />
          </q-tabs>
        </template>
        <template v-slot:after>
          <q-tab-panels v-model="tab" vertical class="output-panels">
            <q-tab-panel
              name="graph"
              v-if="nodes.length"
              class="output-tab-panel"
            >
              <GraphOutput :nodes="nodes" :relationships="relationships" />
            </q-tab-panel>
            <q-tab-panel
              name="table"
              v-if="rows.length"
              class="output-tab-panel"
            >
              <TableOutput :rows="rows" :columns="columns" />
            </q-tab-panel>
            <q-tab-panel
              name="explanation"
              v-if="textQuery !== ''"
              class="output-tab-panel"
            >
              <ExplanationOutput :text="explanationText" />
            </q-tab-panel>
            <q-tab-panel
              name="error"
              v-if="errorText !== ''"
              class="output-tab-panel"
            >
              <p>{{ errorText }}</p>
            </q-tab-panel>
          </q-tab-panels>
        </template>
      </q-splitter>
    </div>
    <div class="footer">
      <div class="row">
        <div class="col" style="text-align: left">
          <q-img
            src="@/assets/logo.svg"
            style="height: 20px; max-width: 20px"
          />
          Internet Yellow Pages Browser
          <a
            :href="`https://github.com/InternetHealthReport/iyp-browser/releases/tag/v${version}`"
            target="_blank"
          >
            <q-badge color="red">v{{ version }}</q-badge>
          </a>
        </div>
        <!-- <div class="col" style="text-align: center;">
          GitHub
        </div> -->
        <div class="col" style="text-align: right">
          This work is licensed under
          <a
            href="https://creativecommons.org/licenses/by-nc-sa/4.0"
            target="_blank"
            >CC BY-NC-SA 4.0</a
          >
          <q-img
            src="https://mirrors.creativecommons.org/presskit/icons/cc.svg"
            style="height: 15px; max-width: 15px"
          />
          <q-img
            src="https://mirrors.creativecommons.org/presskit/icons/by.svg"
            style="height: 15px; max-width: 15px"
          />
          <q-img
            src="https://mirrors.creativecommons.org/presskit/icons/nc.svg"
            style="height: 15px; max-width: 15px"
          />
          <q-img
            src="https://mirrors.creativecommons.org/presskit/icons/sa.svg"
            style="height: 15px; max-width: 15px"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.output-panel {
  display: flex;
  flex-direction: column;
  background-color: #f9fcff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  height: 100%;
  touch-action: none;
}
.output-container {
  width: 100%;
  height: 0;
  flex: 1;
  overflow-y: auto;
}
.output-panels {
  background-color: #f9fcff;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
}
.output-tabs {
  background-color: #ffffff;
  height: 100%;
}
.footer {
  width: 100%;
  background-color: #263238;
  color: #ffffff;
  border-bottom-left-radius: 4px;
  border-bottom-right-radius: 4px;
  padding: 1px;
  height: 24px;
}
.footer,
a {
  color: #ffffff;
}
.output-tab-panel {
  padding: 0px;
}
.output-bar {
  background-color: #263238;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
}
</style>
