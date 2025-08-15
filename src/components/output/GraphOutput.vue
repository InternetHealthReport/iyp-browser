<script setup>
import { ref, onMounted, onUnmounted, watch, inject, computed } from 'vue'
import { NVL } from '@neo4j-nvl/base'
import {
  ZoomInteraction,
  PanInteraction,
  DragNodeInteraction,
  HoverInteraction,
  ClickInteraction
} from '@neo4j-nvl/interaction-handlers'
import { useQuasar } from 'quasar'

const Neo4jApi = inject('Neo4jApi')
const emit = defineEmits(['nodeExpanded', 'nodeUnexpanded'])
const props = defineProps(['nodes', 'relationships', 'expandedNodesState'])

const q = useQuasar()
const expandedNodesMap = ref(props.expandedNodesState)

const graph = ref()
const properties = ref({})
const selectedElement = ref({
  nodeOrRelationship: '',
  id: '',
  type: '',
  color: '',
  clicked: false
})
const hideOverviewBtn = ref(false)
const hideOverviewBtnIcon = ref('keyboard_arrow_up')
const overview = ref()
let nvl = null
const nodeRightClickMenu = ref({
  node: null,
  clicked: false
})

const options = {
  disableTelemetry: true,
  layout: 'forceDirected',
  initialZoom: 1,
  renderer: 'canvas',
  maxZoom: 3,
  minZoom: 1
}

const hideOverview = () => {
  hideOverviewBtn.value = !hideOverviewBtn.value
  if (hideOverviewBtn.value) {
    overview.value.$el.style.height = 'auto'
    hideOverviewBtnIcon.value = 'keyboard_arrow_down'
  } else {
    overview.value.$el.style.width = '250px'
    overview.value.$el.style.height = '100%'
    hideOverviewBtnIcon.value = 'keyboard_arrow_up'
  }
}

const zoomIn = () => {
  nvl.setZoom(nvl.getScale() + 0.5)
}

const zoomOut = () => {
  nvl.setZoom(nvl.getScale() - 0.5)
}

const reset = () => {
  nvl.resetZoom()
}

const fetchConnectedNodes = async (nodeId) => {
  const cypher = `
    MATCH (n)
    WHERE elementId(n) = "${nodeId}"
    MATCH (n)-[r]-(m)
    WITH type(r) AS relType, r, m
    WITH relType, collect({r: r, m: m}) AS connections
    UNWIND connections[..1] AS conn
    RETURN conn.r AS rel, conn.m AS target
  `
  const res = await Neo4jApi.run(cypher)
  return {
    nodes: res.graph?.nodes || [],
    relationships: res.graph?.relationships || []
  }
}

const nodeExpansion = async (nodeId) => {
  const { nodes: newNodes, relationships: newRels } = await fetchConnectedNodes(nodeId)

  const existingNodeIds = new Set(nvl.getNodes().map((n) => n.id))
  const existingRelIds = new Set(nvl.getRelationships().map((r) => r.id))

  const filteredNodes = newNodes.filter((n) => !existingNodeIds.has(n.id))
  const filteredRels = newRels.filter((r) => !existingRelIds.has(r.id))

  if (filteredNodes.length || filteredRels.length) {
    nvl.addAndUpdateElementsInGraph(filteredNodes, filteredRels)
    expandedNodesMap.value.set(nodeId, {
      nodes: filteredNodes,
      relationships: filteredRels
    })
    emit('nodeExpanded', {
      newNodes: filteredNodes,
      newRels: filteredRels,
      expandedState: expandedNodesMap.value
    })
  } else {
    q.notify({
      message: 'Node is not expandable',
      position: 'top',
      type: 'info',
      color: 'primary',
      actions: [{ icon: 'close', color: 'white', round: true, handler: () => {} }]
    })
  }
}

const nodeUnexpand = (nodeId) => {
  const expansion = expandedNodesMap.value.get(nodeId)
  if (expansion) {
    const nodeIds = expansion.nodes.map((n) => n.id)
    const relIds = expansion.relationships.map((r) => r.id)

    nvl.removeNodesWithIds(nodeIds)
    nvl.removeRelationshipsWithIds(relIds)
    expandedNodesMap.value.delete(nodeId)

    emit('nodeUnexpanded', {
      removedNodeIds: nodeIds,
      removedRelIds: relIds,
      expandedState: expandedNodesMap.value
    })
  } else {
    q.notify({
      message: 'Node is not un-expandable',
      position: 'top',
      type: 'info',
      color: 'primary',
      actions: [{ icon: 'close', color: 'white', round: true, handler: () => {} }]
    })
  }
}

const isNodeExpanded = (nodeId) => {
  return expandedNodesMap.value.has(nodeId)
}

const updateNvlElementselectedElement = (element) => {
  if (!element && selectedElement.value.clicked) {
    if (selectedElement.value.nodeOrRelationship === 'node') {
      const oldNode = nvl.getNodeById(selectedElement.value.id)
      oldNode.selected = false
      nvl.addAndUpdateElementsInGraph([oldNode], [])
    } else if (selectedElement.value.nodeOrRelationship === 'relationship') {
      const oldRelationship = nvl.getRelationshipById(selectedElement.value.id)
      oldRelationship.selected = false
      nvl.addAndUpdateElementsInGraph([], [oldRelationship])
    }
    selectedElement.value.id = ''
    selectedElement.value.nodeOrRelationship = ''
    selectedElement.value.type = ''
    selectedElement.value.color = ''
    selectedElement.value.clicked = false
    properties.value = {}
  } else if (element && selectedElement.value.id === '') {
    properties.value = element.properties
    element.selected = true
    if (element.nodeOrRelationship === 'node') {
      nvl.addAndUpdateElementsInGraph([element], [])
    } else {
      nvl.addAndUpdateElementsInGraph([], [element])
    }
    selectedElement.value.id = element.id
    selectedElement.value.nodeOrRelationship = element.nodeOrRelationship
    selectedElement.value.type = element.type
    selectedElement.value.color = element.color
  } else if (element && element?.id !== selectedElement.value.id) {
    properties.value = element.properties
    element.selected = true
    if (selectedElement.value.nodeOrRelationship === 'node') {
      const oldNode = nvl.getNodeById(selectedElement.value.id)
      oldNode.selected = false
      if (element.nodeOrRelationship === 'node') {
        nvl.addAndUpdateElementsInGraph([oldNode, element], [])
      } else {
        nvl.addAndUpdateElementsInGraph([oldNode], [element])
      }
    } else if (selectedElement.value.nodeOrRelationship === 'relationship') {
      const oldRelationship = nvl.getRelationshipById(selectedElement.value.id)
      oldRelationship.selected = false
      nvl.addAndUpdateElementsInGraph([], [oldRelationship])
      if (element.nodeOrRelationship === 'node') {
        nvl.addAndUpdateElementsInGraph([element], [oldRelationship])
      } else {
        nvl.addAndUpdateElementsInGraph([], [oldRelationship, element])
      }
    } else {
      if (element.nodeOrRelationship === 'node') {
        nvl.addAndUpdateElementsInGraph([element], [])
      } else {
        nvl.addAndUpdateElementsInGraph([], [element])
      }
    }
    selectedElement.value.id = element.id
    selectedElement.value.nodeOrRelationship = element.nodeOrRelationship
    selectedElement.value.type = element.type
    selectedElement.value.color = element.color
  }
}

const init = (nodes, relationships) => {
  if (nodes.length) {
    nvl = new NVL(graph.value, nodes, relationships, options)
    nvl.setDisableWebGL(true)
    new ZoomInteraction(nvl)
    new PanInteraction(nvl)
    new DragNodeInteraction(nvl).updateCallback('onDrag', (nodes) => {})
    new HoverInteraction(nvl).updateCallback('onHover', (element, hitElements, event) => {
      if (!selectedElement.value.clicked) {
        if (element) {
          properties.value = element.properties
          selectedElement.value.id = ''
          selectedElement.value.nodeOrRelationship = element.nodeOrRelationship
          selectedElement.value.type = element.type
          selectedElement.value.color = element.color
        } else {
          properties.value = {}
          selectedElement.value.id = ''
          selectedElement.value.nodeOrRelationship = ''
          selectedElement.value.type = ''
          selectedElement.value.color = ''
        }
      }
    })
    const clickInteraction = new ClickInteraction(nvl)
    clickInteraction.updateCallback('onNodeClick', (node) => {
      if (node) {
        selectedElement.value.clicked = true
        updateNvlElementselectedElement(node)
      }
    })
    clickInteraction.updateCallback('onRelationshipClick', (relationship) => {
      if (relationship) {
        selectedElement.value.clicked = true
        updateNvlElementselectedElement(relationship)
      }
    })
    clickInteraction.updateCallback('onCanvasClick', (canvas) => {
      selectedElement.value.clicked = true
      updateNvlElementselectedElement()
    })

    clickInteraction.updateCallback('onNodeRightClick', (node) => {
      if (node) {
        nodeRightClickMenu.value.node = node
        nodeRightClickMenu.value.clicked = true
      }
    })
    clickInteraction.updateCallback('onRelationshipRightClick', (relationship) => {
      if (relationship) {
        nodeRightClickMenu.value.node = null
        nodeRightClickMenu.value.clicked = false
      }
    })
    clickInteraction.updateCallback('onCanvasRightClick', (canvas) => {
      nodeRightClickMenu.value.node = null
      nodeRightClickMenu.value.clicked = false
    })
  }
}

// watch(props, () => {
//   if (nvl) {
//     nvl.destroy()
//   }
//   init(props.nodes, props.relationships)
// })

onMounted(async () => {
  init(props.nodes, props.relationships)
})

onUnmounted(() => {
  if (nvl) {
    nvl.destroy()
  }
})
</script>

<template>
  <div class="graph">
    <div ref="graph">
      <q-menu v-model="nodeRightClickMenu.clicked" context-menu>
        <q-list dense>
          <q-item
            clickable
            v-close-popup
            @click="
              () => {
                const nodeId = nodeRightClickMenu.node?.id
                if (!nodeId) return
                if (isNodeExpanded(nodeId)) {
                  nodeUnexpand(nodeId)
                } else {
                  nodeExpansion(nodeId)
                }
              }
            "
          >
            <q-item-section v-if="isNodeExpanded(nodeRightClickMenu.node?.id)">
              Unexpand
            </q-item-section>
            <q-item-section v-else> Expand </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </div>
    <q-card class="overview" ref="overview">
      <q-bar class="fixed-top overview-bar">
        <div class="row justify-between" style="width: 100%">
          <q-btn icon="zoom_in" flat square color="white" @click="zoomIn" />
          <q-btn icon="zoom_out" flat square color="white" @click="zoomOut" />
          <q-btn icon="center_focus_strong" flat square color="white" @click="reset" />
          <q-btn :icon="hideOverviewBtnIcon" flat square color="white" @click="hideOverview" />
        </div>
      </q-bar>
      <q-card-section style="padding-top: 0" v-if="!hideOverviewBtn">
        <div class="fixed-top overview-info">
          <div v-if="selectedElement.nodeOrRelationship === 'node'">
            <div class="text-subtitle1">Node properties</div>
            <q-badge
              rounded
              :label="selectedElement.type"
              text-color="black"
              :style="`background-color: ${selectedElement.color};`"
            />
          </div>
          <div v-else-if="selectedElement.nodeOrRelationship === 'relationship'">
            <div class="text-subtitle1">Relationship properties</div>
            <q-badge
              :label="selectedElement.type"
              text-color="white"
              style="background-color: #848484"
            />
          </div>
          <div v-else>
            <div class="text-subtitle1">Overview</div>
            <div class="text-subtitle2">Node labels</div>
            <div>
              <span
                class="q-mr-sm"
                v-for="(node, index) in nodes
                  .map((el) => ({ type: el.type, color: el.color }))
                  .filter(
                    (value, index, self) => index === self.findIndex((t) => t.type === value.type)
                  )"
                :key="index"
              >
                <q-badge
                  :label="node.type"
                  text-color="black"
                  :style="`background-color: ${node.color};`"
                />
              </span>
            </div>
            <div class="text-subtitle2">Relationship types</div>
            <div>
              <span
                class="q-mr-sm"
                v-for="(relType, index) in [...new Set(relationships.map((el) => el.type))]"
                :key="index"
              >
                <q-badge :label="relType" text-color="white" style="background-color: #848484" />
              </span>
            </div>
          </div>
        </div>
        <q-markup-table flat wrap-cells dense>
          <thead></thead>
          <tbody>
            <tr v-for="(property, key, index) in properties" :key="index">
              <td class="text-bold text-left overview-property-key">
                {{ key }}
              </td>
              <td class="text-left overview-property-value">{{ property }}</td>
            </tr>
          </tbody>
        </q-markup-table>
      </q-card-section>
    </q-card>
  </div>
</template>

<style scoped>
.graph {
  position: absolute;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
}
.overview {
  position: absolute;
  top: 0px;
  right: 0px;
  width: 250px;
  height: 100%;
  border-top-left-radius: 4px;
  border-top-right-radius: 0px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
  overflow-y: auto;
}
.overview-property-key {
  max-width: 70px;
  word-wrap: break-word;
  padding-left: 0px !important;
}
.overview-property-value {
  max-width: 120px;
  word-wrap: break-word;
  padding-right: 0px !important;
}
.overview-bar {
  position: sticky;
  top: 0px;
  z-index: 1;
  height: 30px;
  background-color: #263238;
}
.overview-info {
  position: sticky;
  top: 30px;
  z-index: 1;
  background-color: white;
}
</style>
