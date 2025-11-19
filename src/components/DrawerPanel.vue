<script setup>
import { ref } from 'vue'
import schema from '@/assets/neo4j-schema.json'
import randomColor from 'randomcolor'

const emit = defineEmits(['run'])

const nodes = ref(
  Object.keys(schema.node_properties)
    .sort()
    .map((val) => ({ text: val, color: randomColor({ seed: val, luminosity: 'light' }) }))
)
const relationships = ref(Object.keys(schema.relationship_properties).sort())
const databaseInstance = ref('iyp-bolt.iijlab.net:443')

const getContrastingColor = (color) => {
  let r
  let g
  let b

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
    return 'black'
  }

  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  return brightness > 128 ? 'black' : 'white'
}

const runNode = (type) => {
  const cypher = `MATCH (n:${type}) RETURN n LIMIT 25`
  emit('run', cypher)
}

const runRelationship = (type) => {
  const cypher = `MATCH p=()-[r:${type}]->() RETURN p LIMIT 25`
  emit('run', cypher)
}
</script>

<template>
  <div class="q-mr-sm q-ml-sm">
    <div class="text-h6">Database Information</div>
    <div>
      <div class="text-subtitle1">Database instance</div>
      <div>
        <q-input dense outlined label="neo4j+s://" v-model="databaseInstance" readonly />
      </div>
    </div>
    <div>
      <div class="text-subtitle1">Node labels</div>
      <div>
        <span class="q-mr-sm" v-for="(node, index) in nodes" :key="index">
          <q-btn
            flat
            dense
            padding="none xs"
            size="11px"
            no-caps
            :label="node.text"
            :text-color="getContrastingColor(node.color)"
            :style="`background-color: ${node.color};`"
            class="q-mb-sm"
            @click="runNode(node.text)"
          />
        </span>
      </div>
    </div>
    <div>
      <div class="text-subtitle1">Relationship types</div>
      <div>
        <span class="q-mr-sm" v-for="(relType, index) in relationships" :key="index">
          <q-btn
            flat
            dense
            padding="none xs"
            size="11px"
            no-caps
            :label="relType"
            text-color="white"
            style="background-color: #848484"
            class="q-mb-sm"
            @click="runRelationship(relType)"
          />
        </span>
      </div>
    </div>
  </div>
</template>
