<script setup>
import { ref, onMounted, watch, inject } from "vue";
import * as monaco from "monaco-editor";
import schema from "@/assets/neo4j-schema.json";
import { autocomplete } from "@neo4j-cypher/language-support";
import Feedback from "./Feedback.vue";

const GlobalVariables = inject("GlobalVariables");

const emits = defineEmits(["run", "clear", "editorHeightChanged"]);

const props = defineProps([
  "cypherInput",
  "textInput",
  "activeTab",
  "serveInOutput",
]);

const code = ref();
const tab = ref("");
let cypher = "";
let text = "";
let editor = null;
const minHeight = 3;
const maxHeight = 10;
const lineHeight = 20;
const padding = 10;

const updateEditorHeight = () => {
  const lineCount = editor.getModel().getLineCount();
  const newHeight = Math.min (
    Math.max(lineCount * lineHeight, minHeight * lineHeight), maxHeight * lineHeight
  )+ padding;
  code.value.style.height = `${newHeight}px`;
  if(lineCount<maxHeight){
    emits('editorHeightChanged', newHeight);
  }
  editor.layout();
};

const runQuery = () => {
  const getValue = editor.getValue();
  if (getValue !== "") {
    emits("run", getValue, tab.value);
    if (props.serveInOutput) {
      if (tab.value === "cypher") {
        text = "";
      }
    } else {
      editor.setValue("");
      cypher = "";
      text = "";
    }
  }
};

const clearQuery = () => {
  if (!props.serveInOutput) {
    editor.setValue("");
    cypher = "";
    text = "";
    tab.value = "cypher";
  } else {
    emits("clear");
  }
};

watch(tab, (newTab, oldTab) => {
  if (newTab === "text" && oldTab === "cypher") {
    cypher = editor.getValue();
    editor.setValue(text);
  } else if (newTab === "cypher" && oldTab === "text") {
    text = editor.getValue();
    editor.setValue(cypher);
  }
  monaco.editor.setModelLanguage(editor.getModel(), tab.value);
});

watch(
  () => props.cypherInput,
  () => {
    cypher = props.cypherInput;
    if (props.activeTab === "cypher") {
      tab.value = "cypher";
      editor.setValue(cypher);
    }
  },
);

watch(
  () => props.textInput,
  () => {
    text = props.textInput;
    if (props.activeTab === "text") {
      tab.value = "text";
      editor.setValue(text);
    }
  },
);

onMounted(() => {
  tab.value = "cypher";
  editor = monaco.editor.create(code.value, {
    value: "",
    language: "cypher",
    theme: "vs",
    minimap: {
      enabled: false,
    },
    automaticLayout: true,
    contextmenu: false,
    scrollBeyondLastLine: false,
    lineHeight: lineHeight
  });

  let previousLineCount = editor.getModel().getLineCount();

  editor.onDidChangeModelContent(() => {
    const currentLineCount = editor.getModel().getLineCount();
    if (currentLineCount !== previousLineCount) {
        previousLineCount = currentLineCount;
        updateEditorHeight();
    }
  });

  window.addEventListener("hitResult", () => {
    // console.log(e)
  });
  monaco.languages.register({
    id: "cypher",
    extensions: [".cypher"],
    aliases: ["Cypher", "cypher"],
  });
  monaco.languages.registerCompletionItemProvider("cypher", {
    provideCompletionItems: (model, position) => {
      const textUtilPosition = model.getValueInRange({
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });
      const autocompleteSchema = {
        labels: Object.keys(schema.node_properties),
        relationshipTypes: Object.keys(schema.relationship_properties),
        propertyKeys: [
          ...Object.values(schema.node_properties).flat(),
          ...Object.values(schema.relationship_properties).flat(),
        ],
      };
      const completionItems = autocomplete(
        textUtilPosition,
        autocompleteSchema,
      );
      return {
        suggestions: completionItems.map((item) => ({
          label: item.label,
          kind: item.kind,
          insertText: item.label,
          range: item.range,
        })),
      };
    },
  });
  editor.addAction({
    id: "run",
    label: "Run",
    keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.Enter],
    run: () => {
      runQuery();
    },
  });
});
</script>

<template>
  <div class="input-container row">
    <q-tabs v-model="tab" class="input-language-switcher" vertical dense>
      <q-tab
        v-if="!GlobalVariables.disableCypherInput"
        name="cypher"
        label="Cypher"
      />
      <q-tab
        v-if="!GlobalVariables.disableTextInput"
        name="text"
        label="Text"
        disable
      >
        <q-badge>Coming Soon</q-badge>
      </q-tab>
    </q-tabs>
    <div ref="code" class="code col q-mr-md"></div>
    <div class="col-auto q-mr-md">
      <div class="row q-mb-sm">
        <q-btn
          flat
          square
          color="primary"
          icon="play_arrow"
          class="full-width"
          @click="runQuery"
        />
        <!-- <q-btn flat square color="red" icon="close" @click="clearQuery" /> -->
      </div>
      <div class="row" style="width: 100%">
        <Feedback />
      </div>
    </div>
  </div>
</template>

<style scoped>
.input-container {
  width: 100%;
  min-height: v-bind("minHeight * lineHeight + padding + 'px'");
  max-height: v-bind("maxHeight * lineHeight + padding + 'px'");
  padding-top: 4px;
  padding-bottom: 4px;
  background-color: #f9fcff;
}
.input-language-switcher {
  width: 110px;
}
.code {
  width: 100%;
  height: v-bind("minHeight * lineHeight + padding + 'px'");
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
</style>
