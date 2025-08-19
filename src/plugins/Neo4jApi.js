import axios from 'axios'
import randomColor from 'randomcolor'

/// Base url for neo4j api
const NEO4J_API_BASE = 'https://iyp.iijlab.net/iyp/db/neo4j/query/v2'

/// Default timeout before api call are considered failed
const DEFAULT_TIMEOUT = 180000

const Neo4jApi = {
  install: (app) => {
    const axios_base = axios.create({
      baseURL: NEO4J_API_BASE,
      timeout: DEFAULT_TIMEOUT
    })

    const run = async (query) => {
      try {
        let response = await axios_base.post(
          '',
          {
            statement: query
          },
          {
            headers: {
              Accept: 'application/vnd.neo4j.query'
            }
          }
        )
        const responseDataValues = response.data.data.values.flat()
        return {
          graph: nvlResultTransformer(responseDataValues),
          table: tableResultTransformer(response.data.data.fields, responseDataValues)
        }
      } catch (error) {
        if (typeof error.response.data === 'object') {
          return {
            error: error.response.data.errors[0].message
          }
        }
        return {
          error: error.response.data
        }
      }
    }

    const nvlResultTransformer = (results) => {
      const colorMap = new Map()
      const nodes = []
      const relationships = []
      results
        .map((row) => {
          if (row['$type'] === 'Path') {
            return row['_value']
          }
          return row
        })
        .flat()
        .forEach((row) => {
          if (row['$type'] === 'Path') {
            row = row['_value']
          }
          if (row['$type'] === 'Node') {
            const node = nvlResultTransformerNode(row['_value'], colorMap)
            if (nodes.indexOf(node) === -1) {
              nodes.push(node)
            }
          } else if (row['$type'] === 'Relationship') {
            const relationship = nvlResultTransformerRelationship(row['_value'])
            if (relationships.indexOf(relationship) === -1) {
              relationships.push(relationship)
            }
          }
        })
      return { nodes, relationships }
    }

    const nvlResultTransformerNode = (node, colorMap) => {
      const nodeType = node['_labels'][0]
      if (!colorMap.has(nodeType)) {
        colorMap.set(nodeType, randomColor({ seed: nodeType, luminosity: 'light' }))
      }
      const properties = {}
      Object.keys(node['_properties']).forEach((value) => {
        properties[value] = node['_properties'][value]['_value']
        if (node['_properties'][value]['$type'] === 'List') {
          properties[value] = node['_properties'][value]['_value'].map((val) => val['_value'])
        }
      })
      return {
        id: node['_element_id'],
        caption: String(Object.values(properties)[0]),
        color: colorMap.get(nodeType),
        properties: properties,
        nodeOrRelationship: 'node',
        selected: false,
        type: nodeType,
        captionKey: Object.keys(properties)[0]
      }
    }

    const nvlResultTransformerRelationship = (relationship) => {
      const properties = {}
      Object.keys(relationship['_properties']).forEach((value) => {
        properties[value] = relationship['_properties'][value]['_value']
        if (relationship['_properties'][value]['$type'] === 'List') {
          properties[value] = relationship['_properties'][value]['_value'].map(
            (val) => val['_value']
          )
        }
      })
      return {
        id: relationship['_element_id'],
        from: relationship['_start_node_element_id'],
        to: relationship['_end_node_element_id'],
        caption: relationship['_type'],
        properties: properties,
        nodeOrRelationship: 'relationship',
        selected: false,
        type: relationship['_type']
      }
    }

    const tableResultTransformer = (header, results) => {
      const rows = []
      const columns = tableResultTransformerColumn(header)
      if (columns.length) {
        let countElementsInRow = 0
        let returnedRow = {
          index: 0
        }
        results.forEach((row) => {
          if (countElementsInRow === 0) {
            returnedRow = {
              index: returnedRow.index + 1
            }
          }
          if (row['$type'] === 'Path') {
            const graphObj = []
            row['_value'].forEach((path) => {
              const properties = {}
              Object.keys(path['_value']['_properties']).forEach((prop) => {
                properties[prop] = path['_value']['_properties'][prop]['_value']
                if (path['_value']['_properties'][prop]['$type'] === 'List') {
                  properties[prop] = path['_value']['_properties'][prop]['_value'].map(
                    (value) => value['_value']
                  )
                }
              })
              graphObj.push(properties)
            })
            returnedRow[columns[countElementsInRow + 1].name] = JSON.stringify(graphObj)
          } else {
            returnedRow[columns[countElementsInRow + 1].name] = row['_value']
            if (row['$type'] === 'List') {
              returnedRow[columns[countElementsInRow + 1].name] = JSON.stringify(
                row['_value'].map((value) => value['_value'])
              )
            } else if (row['$type'] === 'Node' || row['$type'] === 'Relationship') {
              const properties = {}
              Object.keys(row['_value']['_properties']).forEach((prop) => {
                properties[prop] = row['_value']['_properties'][prop]['_value']
              })
              returnedRow[columns[countElementsInRow + 1].name] = JSON.stringify(properties)
            }
          }
          countElementsInRow += 1
          if (countElementsInRow === columns.length - 1) {
            countElementsInRow = 0
            rows.push(returnedRow)
          }
        })
      }
      return { rows, columns }
    }

    const tableResultTransformerColumn = (columns) => {
      if (columns.length) {
        return [
          {
            name: 'index',
            label: '#',
            field: 'index',
            align: 'left'
          }
        ].concat(
          columns.map((val) => {
            return {
              name: val,
              label: val,
              field: val,
              align: 'left'
            }
          })
        )
      }
      return []
    }

    const Neo4jApi = {
      run
    }
    app.provide('Neo4jApi', Neo4jApi)
  }
}

export { Neo4jApi }
