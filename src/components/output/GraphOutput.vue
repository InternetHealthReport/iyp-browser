<script setup>
import { ref, onMounted, onUnmounted, inject } from 'vue'
import { NVL } from '@neo4j-nvl/base'
import {
  ZoomInteraction,
  PanInteraction,
  DragNodeInteraction,
  HoverInteraction,
  ClickInteraction
} from '@neo4j-nvl/interaction-handlers'
import { useQuasar } from 'quasar'
import interact from 'interactjs'

const Neo4jApi = inject('Neo4jApi')
const GlobalVariables = inject('GlobalVariables')
const emit = defineEmits(['nodeExpanded', 'nodeUnexpanded', 'nodeDeleted', 'updateNodeProperties'])
const props = defineProps(['nodes', 'relationships', 'expandedNodesState', 'disableResizer'])

const q = useQuasar()
const expandedNodesMap = ref(props.expandedNodesState)

const graph = ref()
const selectedElement = ref({
  nodeOrRelationship: '',
  id: '',
  type: '',
  color: '',
  captionKey: '',
  caption: '',
  properties: {},
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
const graphOverviewPanelWidth = ref(`${GlobalVariables.graphOverviewPanelWidth}px`)

const options = {
  disableTelemetry: true,
  layout: 'forcedirected',
  initialZoom: 1,
  renderer: 'canvas',
  maxZoom: 3,
  minZoom: 1
}

const hideOverview = () => {
  hideOverviewBtn.value = !hideOverviewBtn.value
  if (hideOverviewBtn.value) {
    hideOverviewBtnIcon.value = 'keyboard_arrow_down'
  } else {
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

  let filteredNodes = newNodes.filter((n) => !existingNodeIds.has(n.id))
  const filteredRels = newRels.filter((r) => !existingRelIds.has(r.id))

  if (filteredNodes.length || filteredRels.length) {
    filteredNodes = filteredNodes.map((fn) => {
      const hasType = props.nodes.find((n) => n.type === fn.type)
      if (hasType) {
        fn.color = hasType.color
        fn.captionKey = hasType.captionKey
        fn.caption = hasType.caption
      }
      return fn
    })
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
    const nodeIds = expansion.nodes
      .filter((n) => {
        if (expandedNodesMap.value.has(n.id)) {
          return false
        }
        return true
      })
      .map((n) => n.id)
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

const nodeDeletion = (nodeId) => {
  const relIds = props.relationships
    .filter((r) => r.from === nodeId || r.to === nodeId)
    .map((r) => r.id)

  nvl.removeNodesWithIds([nodeId])
  nvl.removeRelationshipsWithIds(relIds)

  emit('nodeDeleted', {
    removedNodeIds: [nodeId],
    removedRelIds: relIds
  })
}

const nodeColorChange = ({ type, color }) => {
  const nodes = nvl.getNodes().map((v) => {
    if (v.type === type) {
      v.color = color
    }
    return v
  })

  nvl.addAndUpdateElementsInGraph(nodes)

  emit('updateNodeProperties', nodes)
}

const nodeCaptionChange = ({ type, captionKey, properties }) => {
  const nodes = nvl.getNodes().map((v) => {
    if (v.type === type) {
      v.captionKey = captionKey
      if (captionKey === '<type>') {
        v.caption = type
      } else {
        v.caption = properties[captionKey]
      }
    }
    return v
  })

  nvl.addAndUpdateElementsInGraph(nodes)

  emit('updateNodeProperties', nodes)
}

const isNodeExpanded = (nodeId) => {
  return expandedNodesMap.value.has(nodeId)
}

const getContrastingColor = (color) => {
  let r
  let g
  let b

  if (!color.startsWith('#')) {
    q.notify({
      message: 'Color must be in hex format',
      position: 'top',
      type: 'info',
      color: 'primary',
      actions: [{ icon: 'close', color: 'white', round: true, handler: () => {} }]
    })
    return 'black'
  }

  color = color.slice(1)
  if (color.length === 6) {
    r = parseInt(color.substring(0, 2), 16)
    g = parseInt(color.substring(2, 4), 16)
    b = parseInt(color.substring(4, 6), 16)
  } else if (color.length === 3) {
    r = parseInt(color[0] + color[0], 16)
    g = parseInt(color[1] + color[1], 16)
    b = parseInt(color[2] + color[2], 16)
  } else {
    q.notify({
      message: 'Invalid hex color format',
      position: 'top',
      type: 'info',
      color: 'primary',
      actions: [{ icon: 'close', color: 'white', round: true, handler: () => {} }]
    })
    return 'black'
  }

  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? 'black' : 'white'
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
    selectedElement.value.properties = {}
    selectedElement.value.captionKey = ''
    selectedElement.value.caption = ''
  } else if (element && selectedElement.value.id === '') {
    selectedElement.value.properties = element.properties
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
    selectedElement.value.captionKey = element.captionKey
    selectedElement.value.caption = element.caption
  } else if (element && element?.id !== selectedElement.value.id) {
    selectedElement.value.properties = element.properties
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
    selectedElement.value.captionKey = element.captionKey
    selectedElement.value.caption = element.caption
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
          selectedElement.value.properties = element.properties
          selectedElement.value.id = ''
          selectedElement.value.nodeOrRelationship = element.nodeOrRelationship
          selectedElement.value.type = element.type
          selectedElement.value.color = element.color
          selectedElement.value.captionKey = element.captionKey
          selectedElement.value.caption = element.caption
        } else {
          selectedElement.value.properties = {}
          selectedElement.value.id = ''
          selectedElement.value.nodeOrRelationship = ''
          selectedElement.value.type = ''
          selectedElement.value.color = ''
          selectedElement.value.captionKey = ''
          selectedElement.value.caption = ''
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

onMounted(async () => {
  init(props.nodes, props.relationships)
  if (!props.disableResizer) {
    interact(overview.value)
      .origin('self')
      .resizable({
        edges: { top: false, left: true, bottom: false, right: false },
        inertia: true,
        listeners: {
          move: (event) => {
            overview.value.style.width = `${event.rect.width}px`
          }
        },
        modifiers: [
          interact.modifiers.restrictSize({
            min: { width: GlobalVariables.graphOverviewPanelWidth },
            max: { width: 800 }
          })
        ]
      })
  }
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
      <q-menu v-if="nodeRightClickMenu.clicked" context-menu>
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
            <q-item-section v-if="!isNodeExpanded(nodeRightClickMenu.node?.id)">
              Expand
            </q-item-section>
            <q-item-section v-else> Unexpand </q-item-section>
          </q-item>
          <q-item
            clickable
            v-close-popup
            @click="
              () => {
                const nodeId = nodeRightClickMenu.node?.id
                if (!nodeId) return
                nodeDeletion(nodeId)
              }
            "
          >
            <q-item-section> Delete </q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </div>
    <div class="overview" ref="overview">
      <q-card class="overview-card" :style="{ height: !hideOverviewBtn ? '100%' : 'auto' }">
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
                :text-color="getContrastingColor(selectedElement.color)"
                :style="`background-color: ${selectedElement.color};`"
              >
                <q-popup-proxy>
                  <q-card>
                    <q-card-section>
                      <div class="text-subtitle1">Customize Style</div>
                      <q-color
                        v-model="selectedElement.color"
                        @change="nodeColorChange(selectedElement)"
                        no-header-tabs
                        no-footer
                        flat
                      />
                      <q-select
                        v-model="selectedElement.captionKey"
                        :options="Object.keys(selectedElement.properties).concat(['<type>'])"
                        label="Caption"
                        outlined
                        @update:model-value="nodeCaptionChange(selectedElement)"
                      />
                    </q-card-section>
                  </q-card>
                </q-popup-proxy>
              </q-badge>
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
                  v-for="(node, index) in nodes.filter(
                    (value, index, self) => index === self.findIndex((t) => t.type === value.type)
                  )"
                  :key="index"
                >
                  <q-badge
                    :label="node.type"
                    :text-color="getContrastingColor(node.color)"
                    :style="`background-color: ${node.color};`"
                  >
                    <q-popup-proxy>
                      <q-card>
                        <q-card-section>
                          <div class="text-subtitle1">Customize Style</div>
                          <q-color
                            v-model="node.color"
                            @change="nodeColorChange(node)"
                            no-header-tabs
                            no-footer
                            flat
                          />
                          <q-select
                            v-model="node.captionKey"
                            :options="Object.keys(node.properties).concat(['<type>'])"
                            label="Caption"
                            outlined
                            @update:model-value="nodeCaptionChange(node)"
                          />
                        </q-card-section>
                      </q-card>
                    </q-popup-proxy>
                  </q-badge>
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
              <tr v-for="(property, key, index) in selectedElement.properties" :key="index">
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
  width: v-bind('graphOverviewPanelWidth');
  height: 100%;
  overflow-y: auto;
}
.overview-card {
  overflow-y: auto;
  border-top-left-radius: 4px;
  border-top-right-radius: 0px;
  border-bottom-left-radius: 0px;
  border-bottom-right-radius: 0px;
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
  z-index: 2;
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
