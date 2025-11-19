<script setup>
import { ref, watch, inject } from 'vue'
import hljs from 'highlight.js'
import 'highlight.js/scss/vs.scss'
import { copyToClipboard } from 'quasar'

const GlobalVariables = inject('GlobalVariables')

const props = defineProps(['query'])

const showIframeDialog = ref(false)
const iFrameCode = ref('')

watch(
  () => props.query,
  () => {
    const query = {
      query: props.query
    }
    const session = btoa(JSON.stringify([query]))
    const pathName =
      GlobalVariables.basePath.slice(-1) === '/'
        ? GlobalVariables.basePath
        : `${GlobalVariables.basePath}/`
    iFrameCode.value = `<iframe src="${window.location.origin}${pathName}embed/?session=${session}" width="100%" height="500px"></iframe>`
  }
)
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
          <br />
          <q-btn
            no-caps
            dense
            flat
            @click="copyToClipboard(iFrameCode)"
            style="width: 100%"
            align="left"
          >
            <pre
              style="text-align: left"
            ><code style="white-space: pre-wrap;" v-html="hljs.highlight(iFrameCode, {language: 'html'}).value"></code></pre>
            <q-tooltip> Click to copy </q-tooltip>
          </q-btn>
        </div>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn v-close-popup label="Close" outline />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
