const path = require('path')
const _ = require('lodash')

const utils = require('./utils')
const Graph = require('./graph')
const Logger = require('./logger')
const UnitModule = require('./unit-module')

class UnitManager {
  constructor(config) {
    this._config = config
    this._logger = new Logger('LoadUnits')

    this._files = this.files()
    this._modules = this.modules()
    this._units = this.units()

    this._logger.tryThrow()
  }

  /**
   * Find the yaml module files recursivelly in the config.rootDir, this function is lazy
   */
  files() {
    if (this._files) return this._files

    let files = utils
      .recursiveReadSync(this._config.rootDir())
      .filter(fp => /ya?ml$/.test(fp))
      .filter(f => {
        // omit the config yaml file
        return f != this._config.file()
      })
    return utils.sortFiles(files)
  }

  /**
   * Convert the files to test modules, this function is lazy
   */
  modules() {
    if (this._modules) return this._modules
    let files = this.files()
    let config = this._config
    let modules = files
      .map(f => {
        let logger = this._logger.enter(f)
        return new UnitModule(f, config, logger, this)
      })
      .filter(module => module.valid())

    // sort based on dependency graph
    let graph = new Graph(unit => unit.dependencies().map(v => v.module))
    modules.forEach(module => graph.add(module.name(), module))
    try {
      modules = graph.sort()
    } catch (err) {
      this._logger.log(err.message)
    }

    return modules
  }

  /**
   * Check the file path is an module
   * @param {string} moduleFile - path to the module
   */
  isModuleExist(moduleFile) {
    return this.files().indexOf(moduleFile) > -1
  }

  /**
   * list the test units, this function is lazy
   *
   * @returns {Unit[]}
   */
  units() {
    if (this._units) return this._units
    return _.flatMap(this.modules(), module => module.units())
  }
}

module.exports = UnitManager