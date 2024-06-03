const fs = require('fs')
const debounce = require('lodash.debounce')
const convertStylus = require('./convertStylus')
const { parse, nodeToJSON } = require('../lib')
const findMixin = require('./findMixin')

let startTime = 0
const constants = {}
const mixins = {}

function getStat(path, callback) {
  fs.stat(path, (err, stats) => {
    if (err) throw err
    callback(stats)
  })
}

function readDir(path, callback, errorHandler) {
  fs.readdir(path, (err, files) => {
    if (err) {
      errorHandler()
    } else {
      callback(files)
    }
  })
}

function mkDir(path, callback) {
  fs.mkdir(path, err => {
    if (err) throw err
    callback()
  })
}

function readAndMkDir(input, output, callback) {
  readDir(output, () => {
    readDir(input, callback)
  }, () => {
    mkDir(output, () => {
      readDir(input, callback)
    })
  })
}

function visitDirectory(input, output, inputParent, outputParent, options, callback) {
  const inputPath = inputParent ? inputParent + input : input
  const outputPath = outputParent ? outputParent + output : output
  getStat(inputPath, stats => {
    if (stats.isFile()) {
      convertStylus(inputPath, outputPath, options, callback)
    } else if (stats.isDirectory()) {
      readAndMkDir(inputPath, outputPath, files => {
        files.forEach(file => {
          if (inputParent) {
            visitDirectory(file, file, inputPath + '/', outputPath + '/', options, callback)
          } else {
            visitDirectory(file, file, input + '/', output + '/', options, callback)
          }
        })
      })
    }
  })
}

function populateGlobals() {
  if (Object.keys(constants).length > 0) {
    return; // Already initialized
  }

  for (const entry of [
    { path: 'src/stylesheets/constants.styl', use: 'src/stylesheets/constants', alias: 'c' },
    { path: 'src/stylesheets/mixins.styl', use: 'src/stylesheets/mixins', alias: 'm' },
    { path: 'src/js/shared-components/common.styl', use: 'src/js/shared-components/common', alias: 'sc' },
    { path: 'node_modules/@amplify/styles/styl/functions-variables-mixins.styl', use: '@amplify/styles/scss/_functions-variables-mixins.scss', alias: 'amp' }
  ]) {
    const result = fs.readFileSync(entry.path).toString();
    const ast = parse(result)
    const nodes = nodeToJSON(ast.nodes)
    nodes.forEach(node => {
      if (node.__type === 'Ident' && node.val.toJSON().__type === 'Function' && !mixins[node.name]) {
        mixins[node.name] = {
          use: entry.use,
          alias: entry.alias
        }
      }

      for (const mixin of findMixin(node)) {
        mixins[mixin] = {
          use: entry.use,
          alias: entry.alias,
          isMixin: true
        }
      }

      if (node.__type === 'Ident' && node.val.toJSON().__type === 'Expression') {
        if (!constants[node.name]) {
          constants[node.name] = {
            use: entry.use,
            alias: entry.alias
          }
        }
      }
    })
  }
}

function handleStylus(options, callback) {
  const input = options.input
  const output = options.output
  if (options.directory) {
    const baseInput = /\/$/.test(options.input)
      ? input.substring(0, input.length - 1)
      : input
    const baseOutput = /\/$/.test(options.output)
      ? output.substring(0, output.length - 1)
      : output
    visitDirectory(baseInput, baseOutput, '', '', options, callback)
  } else {
    convertStylus(input, output, options, callback)
  }
}

const handleCall = debounce(function (now, startTime, callback) {
  callback(now - startTime)
}, 500)

function converFile(options, callback) {
  populateGlobals();
  options.constants = constants
  options.mixins = mixins
  startTime = Date.now()
  options.status = 'ready'
  handleStylus(options, () => {
    options.status = 'complete'
    handleStylus(options, now => {
      // handleCall(now, startTime, callback)
      callback(now - startTime)
    })
  })
}

module.exports = converFile;
