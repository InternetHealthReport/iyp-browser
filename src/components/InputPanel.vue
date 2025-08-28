<script setup>
import { ref, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import * as monaco from 'monaco-editor'
import schema from '@/assets/neo4j-schema.json'
import { autocomplete } from '@neo4j-cypher/language-support'
import Feedback from './Feedback.vue'

const GlobalVariables = inject('GlobalVariables')

const emits = defineEmits(['run', 'clear', 'editorHeightChanged'])

const props = defineProps(['cypherInput', 'serveInOutput'])

const code = ref()
let cypher = ''
let editor = null
const minHeight = 3
const maxHeight = 10
const lineHeight = 20
const padding = 10
let providerDisposable = null
const PROVIDER_FLAG = '__cypherProviderAdded'

const updateEditorHeight = () => {
  const lineCount = editor.getModel().getLineCount()
  const newHeight =
    Math.min(Math.max(lineCount * lineHeight, minHeight * lineHeight), maxHeight * lineHeight) +
    padding * 2
  code.value.style.height = `${newHeight}px`
  emits('editorHeightChanged', newHeight)
  editor.layout()
}

const runQuery = () => {
  const getValue = editor.getValue()
  if (getValue !== '') {
    emits('run', getValue)
    if (!props.serveInOutput) {
      editor.setValue('')
      cypher = ''
    }
  }
}

const clearQuery = () => {
  if (!props.serveInOutput) {
    editor.setValue('')
    cypher = ''
  } else {
    emits('clear')
  }
}

watch(
  () => props.cypherInput,
  () => {
    cypher = props.cypherInput
    editor.setValue(cypher)
  }
)

onMounted(() => {
  editor = monaco.editor.create(code.value, {
    value: '',
    language: 'cypher',
    theme: 'vs',
    minimap: {
      enabled: false
    },
    automaticLayout: true,
    contextmenu: false,
    scrollBeyondLastLine: false,
    lineHeight: lineHeight,
    padding: { top: 10, bottom: 10 }
  })

  let previousLineCount = editor.getModel().getLineCount()

  editor.onDidChangeModelContent(() => {
    const currentLineCount = editor.getModel().getLineCount()
    if (currentLineCount !== previousLineCount) {
      previousLineCount = currentLineCount
      updateEditorHeight()
    }
  })

  window.addEventListener('hitResult', () => {
    // console.log(e)
  })
  monaco.languages.register({
    id: 'cypher',
    extensions: ['.cypher'],
    aliases: ['Cypher', 'cypher']
  })
  if (!window[PROVIDER_FLAG]) {
    providerDisposable = monaco.languages.registerCompletionItemProvider('cypher', {
      triggerCharacters: [':', ')', '-', '[', ']', '>', '<', '{', '}', '.'],
      provideCompletionItems: (model, position) => {
        const textUtilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        })

        // Splits query text whenever a MATCH / OPTIONAL MATCH / MERGE starts.
        const split = textUtilPosition.split(/(?=MATCH|OPTIONAL MATCH|MERGE)/gi)

        // Picks the last MATCH/MERGE clause to analyze.
        const lastMatchClause = split.length ? split[split.length - 1] : textUtilPosition

        // Detects the node labels inside (alias:Label).
        const matchNodes = [...lastMatchClause.matchAll(/\(\s*\w*\s*:\s*([A-Za-z0-9_]+)/g)]

        // Detects the relationship type inside [alias:TYPE].
        const matchRels = [
          ...lastMatchClause.matchAll(/\[\s*\w*\s*:\s*([A-Za-z0-9_]+)(?=[\s\]\-]|$)/g)
        ]

        const trimmedBeforeCursor = textUtilPosition.trimRight()

        // Detects if cursor is right after opening a block like CALL { … } or EXISTS { … }, etc.
        const justOpenedBlock =
          /\b(?:WHERE\s+NOT\s+EXISTS|CALL|EXISTS|FOREACH\s*\([^)]+\))\s*\{$/.test(
            trimmedBeforeCursor
          )

        // Detects if user just typed "MATCH({" meaning a node map literal started but no node label was specified.
        const genericNodeMatch = textUtilPosition.match(/MATCH\s*\(\s*\{\s*$/)

        // Detects either node properties inside { … } or alias.property typing (like n.name). eg. "MATCH (a:Person {na" captures na .
        const nodePropMatch = textUtilPosition.match(
          /(?:\(\s*\w*\s*:\s*[A-Za-z0-9_]+\s*\{\s*([A-Za-z0-9_]*))|\b([A-Za-z][A-Za-z0-9_]*)\.\s*([A-Za-z0-9_]*)$/
        )

        // Detects relationship properties being typed inside { … }. eg "MATCH (a)-[r:KNOWS {ye" captures ye .
        const relPropMatch = textUtilPosition.match(
          /\[\s*\w*\s*:\s*[A-Za-z0-9_]+\s*\{\s*([A-Za-z0-9_]*)$/
        )

        // Captures node alias + label from patterns like (alias:label).
        const aliasLabelRE = /\(\s*(\w*)\s*:\s*([A-Za-z0-9_]+)/g

        // Captures relationship alias + type from patterns like [alias:type].
        const relAliasTypeRE = /\[\s*(\w*)\s*:\s*([A-Za-z0-9_]+)/g

        // Detects when typing alias.property (like a.asn).
        const dotPropMatch = textUtilPosition.match(
          /\b([A-Za-z][A-Za-z0-9_]*)\.\s*([A-Za-z0-9_]*)$/
        )

        // Detects a chained node being typed after something like (a)--(b:Label).
        const chainedNodeMatch = textUtilPosition.match(/\)\s*--\s*\(\s*(\w*\s*:)?\s*[\w]+.*$/)

        // Finds path aliases in patterns like MATCH p = (a)--(b).
        const pathAliasMatch = [...textUtilPosition.matchAll(/MATCH\s+(\w+)\s*=\s*\(.*?\)/g)]

        // Extracts only the alias names (e.g. "p").
        const pathAliases = pathAliasMatch.map((m) => m[1])

        // Matches relationship being typed with properties but no type (like [{id: …}]).
        const relWithoutTypePropMatch = textUtilPosition.match(/\[\s*\{\s*([A-Za-z0-9_]*)$/)

        // Captures alias + path variable in "r IN relationships(p)".
        const relInPathMatch = textUtilPosition.match(/\b(\w+)\s+IN\s+relationships\(\s*(\w+)\s*\)/)

        // Captures alias + path variable in "n IN nodes(p)".
        const nodeInPathMatch = textUtilPosition.match(/\b(\w+)\s+IN\s+nodes\(\s*(\w+)\s*\)/)

        // Gives the most recent node typed 
        const activeNodeLabel = matchNodes.length ? matchNodes[matchNodes.length - 1][1] : null

        // Gives the most recent relationship typed
        const activeRelationship =
          matchRels.length && !chainedNodeMatch ? matchRels[matchRels.length - 1][1] : null

        const aliasMap = {}

        for (const m of textUtilPosition.matchAll(aliasLabelRE)) {
          const alias = m[1] || null
          const label = m[2]
          if (alias) aliasMap[alias] = label
        }

        for (const m of textUtilPosition.matchAll(relAliasTypeRE)) {
          const alias = m[1] || null
          const type = m[2]
          if (alias) aliasMap[alias] = type
        }

        let relationships = []
        let targetNodes = []
        let properties = []

        if (activeNodeLabel) {
          relationships = Object.keys(schema.schema[activeNodeLabel] || {}) // Adds all relationships nodes connected to the detected node
          const connectedVia = schema.schema[activeNodeLabel] || {}
          targetNodes = Object.values(connectedVia).flat()
          targetNodes = [...new Set(targetNodes)] // Adds all unique nodes connected to the detected node type
        }
        if (justOpenedBlock) {
          return { suggestions: [] } 
        }
        if (genericNodeMatch) {
          const allProps = Object.values(schema.node_properties || {}).flat()
          properties = [...new Set(allProps)] // Adds all unique properties connected to that node type
        }
        if (activeRelationship && activeNodeLabel) {
          targetNodes = schema.schema[activeNodeLabel]?.[activeRelationship] || [] // Adds all target nodes connected to the active node through the relationship typed
        }
        if (activeNodeLabel && nodePropMatch) {
          properties = [...new Set(schema.node_properties[activeNodeLabel] || [])] // Adds all the properties available for that node type
        }
        if (activeRelationship && relPropMatch) {
          properties = [...new Set(schema.relationship_properties[activeRelationship] || [])] // Adds all the properties available for that relationship type
        }
        if (activeNodeLabel && relWithoutTypePropMatch) {
          const relTypes = Object.keys(schema.schema[activeNodeLabel] || {})
          properties = relTypes.flatMap((type) => schema.relationship_properties[type] || [])
          properties = [...new Set(properties)] // Adds all the unique properties for all relationships connected to the active node
        }
        // Handles property suggestions for alias.property patterns (like r.name or n.id)
        if (dotPropMatch) {
          const alias = dotPropMatch[1]
          // Case 1: Relationship alias in path context (r IN relationships(p))
          if (relInPathMatch && alias === relInPathMatch[1]) {
            const pathVar = relInPathMatch[2]
            let relTypes = []
            for (const m of textUtilPosition.matchAll(
              /MATCH\s+(\w+)\s*=\s*.*?\[:([A-Za-z0-9_]+)/g
            )) {
              if (m[1] === pathVar) {
                relTypes.push(m[2])
              }
            }
            properties = relTypes.flatMap((type) => schema.relationship_properties[type] || [])
            properties = [...new Set(properties)]
          } 
          // Case 2: Node alias in path context (n IN nodes(p)) 
          else if (nodeInPathMatch && alias === nodeInPathMatch[1]) {
            const pathVar = nodeInPathMatch[2]
            let nodeLabels = []
            for (const m of textUtilPosition.matchAll(
              /MATCH\s+(\w+)\s*=\s*\((?:\w*):([A-Za-z0-9_]+)/g
            )) {
              if (m[1] === pathVar) {
                nodeLabels.push(m[2])
              }
            }
            nodeLabels = [...new Set(nodeLabels)]
            properties = [
              ...new Set(nodeLabels.flatMap((label) => schema.node_properties[label] || []))
            ]
            // Case 3: Regular alias lookup from aliasMap
          } else {
            if (pathAliases.includes(alias)) {
              return { suggestions: [] }
            }
            const labelOrType = aliasMap[alias]
            if (schema.node_properties[labelOrType]) {
              properties = [...new Set(schema.node_properties[labelOrType] || [])]
            } else if (schema.relationship_properties[labelOrType]) {
              properties = [...new Set(schema.relationship_properties[labelOrType] || [])]
            }
          }
        }

        const autocompleteSchema = {
          labels: targetNodes.length > 0 ? targetNodes : Object.keys(schema.node_properties),
          relationshipTypes:
            relationships.length > 0 ? relationships : Object.keys(schema.relationship_properties),
          propertyKeys:
            properties.length > 0
              ? properties
              : [
                  ...new Set([
                    ...Object.values(schema.node_properties).flat(),
                    ...Object.values(schema.relationship_properties).flat()
                  ])
                ]
        }

        const completionItems = autocomplete(textUtilPosition, autocompleteSchema)
        return {
          suggestions: completionItems.map((item) => ({
            label: item.label,
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: item.label,
            range: item.range
          }))
        }
      }
    })
    window[PROVIDER_FLAG] = true
  }
  editor.addAction({
    id: 'run',
    label: 'Run',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
    run: () => {
      runQuery()
    }
  })
})
onBeforeUnmount(() => {
  editor?.dispose()
  providerDisposable?.dispose()
})
</script>

<template>
  <div class="input-container row">
    <div ref="code" class="code col q-mr-md q-ml-xs"></div>
    <div class="col-auto q-mr-md">
      <div class="row q-mb-sm">
        <q-btn flat square color="primary" icon="play_arrow" class="full-width" @click="runQuery" />
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
  padding-top: 4px;
  padding-bottom: 4px;
  background-color: #f9fcff;
}
.input-language-switcher {
  width: 110px;
}
.code {
  width: 100%;
  height: v-bind("minHeight * lineHeight + padding * 2 + 'px'");
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}
</style>
