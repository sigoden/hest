const _ = require('lodash')

const { EOL } = require('os')

const defaultOptions = { follow: false, indent: '  ', logFunc: console.log }

class Logger {
  /**
   * Create instance of Logger
   *
   * @param {string} title - title of logger
   * @param {object} options - options of logger
   * @param {boolean} options.follow - immeridate call logFunc while receiving a new msg
   * @param {function} options.logFunc - function to process the log string
   */
  constructor(title, options) {
    this.setTitle(title)
    this._opts = _.defaultsDeep(options, defaultOptions)

    this._msgs = []
    this._level = 0
    this._children = []
    this._index = -1
    this._focus = -1
  }

  /**
   * Rename the title
   * @param {string} title - The title of logger
   * @returns {Logger} - this
   */
  setTitle(title) {
    this._title = title || '-'
    return this
  }

  /**
   * Log the message
   * @param {string} msg - The message to append
   */
  log(msg) {
    this._msgs.push(msg)

    if (this._opts.follow) {
      this._follow(msg)
    }
  }

  /**
   * Follow the msg when options follow is true
   */
  _follow(msg) {
    if (this._isRoot()) {
      // print root logger only once
      if (!this._followed) {
        this._opts.logFunc(this._indentTitle())
        this._opts.logFunc(this._indentMsg(msg))
        this._followed = true
        return
      }
    }

    // print title of chaing loggers
    let chain = this._dirtyChain([])

    if (chain.length) {
      let top = chain[chain.length - 1].exit()
      top._unfocusChildren()

      chain.forEach(l => {
        if (l._parent) {
          l._parent._focus = l._index
        }
      })
      let titles = chain
        .reverse()
        .map(l => l._indentTitle())
        .join(EOL)

      this._opts.logFunc(titles)
    }

    this._opts.logFunc(this._indentMsg(msg))
  }

  /**
   * Whether is a root logger
   */
  _isRoot() {
    return !this._parent
  }

  /**
   * Get the chain of affected loggers when the focus changed
   *
   * a
   * +--b
   *    +--c
   *    |  +--d --> chain1
   *    +--e
   *       +--f --> chain2
   *
   * when changing focus from node from d to f, the affected loggers will be [e, f]
   */
  _dirtyChain(chain) {
    if (this._isRoot()) {
      if (this._followed) return chain
      return chain.concat([this])
    }

    let parent = this._parent
    if (this._index === parent._focus) {
      return chain
    }

    return parent._dirtyChain(chain.concat([this]))
  }

  /**
   * Unfocus the children recursivelly
   */
  _unfocusChildren() {
    this._children.forEach(l => {
      l._focus = -1
      l._unfocusChildren()
    })
  }

  /**
   * Throw the msgs and children msgs as an error msg if any
   */
  tryThrow() {
    if (!this.dirty()) return
    throw new Error(this.toString())
  }

  /**
   * Print the msgs
   */
  print() {
    if (!this.dirty()) return
    this._opts.logFunc(this.toString())
  }

  /**
   * Merge the msgs and children msgs as an big string
   */
  toString() {
    if (!this.dirty()) return ''

    let result = this._msgs.reduce((combined, msg) => {
      return combined + `${this._indentMsg(msg)}${EOL}`
    }, this._indentTitle() + EOL)

    result += this._children.reduce((combined, child) => {
      return combined + child.toString()
    }, '')

    return result
  }

  // indent title line
  _indentTitle() {
    return this._opts.indent.repeat(this._level) + this._title + ':'
  }

  // indent msg line
  _indentMsg(msg) {
    let _msg = msg.split(EOL)
    return _msg.map(v => this._opts.indent.repeat(this._level + 1) + v).join(EOL)
  }

  /**
   * Select the child logger, if not find, create new one and enter
   * @param {string} title - same as constructor
   *
   * @returns {Logger}
   */
  enter(title, opts = {}) {
    let child = this.findChild(title)
    if (child) {
      child._opts = _.defaultsDeep(opts, child._opts)
      return child
    }
    return this._createChild(title, opts)
  }

  /**
   * Create child logger
   */
  _createChild(title, opts) {
    let _opts = _.defaultsDeep(opts, this._opts)
    let child = new Logger(title, _opts)
    this._children.push(child)
    child._level = this._level + 1
    child._index = this._children.length - 1
    child._parent = this
    return child
  }

  /**
   * Select the parent logger
   */
  exit() {
    if (this._isRoot()) return this
    return this._parent
  }

  /**
   * Enter the child logger following the element of titles
   */
  enters(titles, opts = {}) {
    return titles.reduce((l, title) => {
      return l.enter(title, opts)
    }, this)
  }

  /**
   * Find the child by title
   */
  findChild(_title) {
    return _.find(this._children, { _title })
  }

  /**
   * Clear the msg recursivelly
   */
  clear() {
    this._msgs = []
    this._children.forEach(l => l.clear())
  }

  /**
   * Whether the logger have any msg or child has any msg recursivelly
   */
  dirty() {
    return !(this._msgs.length === 0 && this._children.every(child => !child.dirty()))
  }
}

module.exports = Logger