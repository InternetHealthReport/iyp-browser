<script setup>
import { ref, watch, inject } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/scss/vs.scss'
import { copyToClipboard } from 'quasar'

const GlobalVariables = inject('GlobalVariables')

const props = defineProps(['query'])

const showIframeDialog = ref(false)
const showGraphOverview = ref(true)

const createIframeCode = () => {
  const query = {
    query: props.query
  }
  const session = btoa(JSON.stringify([query]))
  const pathName =
    GlobalVariables.basePath.slice(-1) === '/'
      ? GlobalVariables.basePath
      : `${GlobalVariables.basePath}/`
  return `<iframe src="${window.location.origin}${pathName}embed/?session=${session}&showGraphOverview=${showGraphOverview.value}" width="100%" height="500px"></iframe>`
}
// watch(
//   () => props.query,
//   () => {
//     const query = {
//       query: props.query
//     }
//     const session = btoa(JSON.stringify([query]))
//     const pathName =
//       GlobalVariables.basePath.slice(-1) === '/'
//         ? GlobalVariables.basePath
//         : `${GlobalVariables.basePath}/`
//     iFrameCode.value = `<iframe src="${window.location.origin}${pathName}embed/?session=${session}&showGraphOverview=${showGraphOverview.value}" width="100%" height="500px"></iframe>`
//   }
// )
</script>

<template>
  <q-btn dense flat icon="integration_instructions" @click="showIframeDialog = true" color="white">
    <q-tooltip> I-frame </q-tooltip>
  </q-btn>
  <q-dialog v-model="showIframeDialog">
    <q-card>
      <q-card-section>
        <div class="text-h6">iFrame</div>
      </q-card-section>
      <q-card-section>
        <div>
          You can embed this content within your webpage.
        </div>
        <div>
          <q-checkbox v-model="showGraphOverview" label="Show graph overview" />
        </div>
        <div>
          <q-btn no-caps outline @click="copyToClipboard(createIframeCode())" label="Copy iFrame code" />
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup label="Close" outline />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
