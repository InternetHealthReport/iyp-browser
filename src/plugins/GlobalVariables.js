const basePath = '/' // default value: '/'

const GlobalVariables = {
  install: (app) => {
    const GlobalVariables = {
      basePath: basePath,
      outputPanelHeight: 580,
      graphOverviewPanelWidth: 250,
      disableOutputPanelResizer: false,
      disableGraphOverviewPanelResizer: false
    }
    app.provide('GlobalVariables', GlobalVariables)
  }
}

export { GlobalVariables, basePath }
