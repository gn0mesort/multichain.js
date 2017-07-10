/**
 * jsonrpc.js
 * Defines a simple JSON-RPC client
 */

// Requires
const uuid = require('uuid/v1') // uuid v1 function. Gets a timestamp uuid

// Constants
const RPC_VERSION = '2.0' // The current version of JSON-RPC
const METHOD_CASING = Object.freeze({ // Defines method casing options for JSONRPCClient.prototype.call
  DEFAULT: 0, // Don't change cases
  UPPER: 1, // Upper case methods
  LOWER: 2 // Lower case methods
})

/**
 * Make a JSON-RPC request using HTTP or HTTPS
 * @param {String} method The method to use
 * @param {Array} params An array of parameters for the JSON-RPC request
 * @param {Object} options Connection options for this request. These are any valid http.request or https.request options. Method will always be POST and content-type will always be application/json
 * @return {Promise} A promise to an object containing the parsed JSON-RPC response
 */
function request (method, params = [], options = {}) {
  return new Promise((resolve, reject) => {
    let data = JSON.stringify(new JSONRPCRequest(method.trim(), params)) // Create the request and stringify it
    let web = options.protocol && options.protocol.trim().toLowerCase().startsWith('https') ? require('https') : require('http') // Load the correct http library
    let request = null // Initialize the request object

    options.headers = Object.assign({}, options.headers) // Ensure that options.headers exists
    options.headers['content-type'] = 'application/json' // Set the content-type header to application/json
    options.headers['content-length'] = Buffer.byteLength(data, 'utf8') // Set the content-length header to the length of the current request
    options.method = 'POST' // Always post messages
    if (options.user && options.pass) { // If authentication is required
      options.auth = `${options.user}:${options.pass}` // Create auth field
    }
    request = web.request(options, (res) => { // Create a web request
      let body = '' // Initialize the response body
      res.on('data', (chunk) => { // For each chunk of data in the response
        body += chunk // Concatinate it onto body
      }).on('end', () => { // When the response is finished
        if (res.statusCode === 200) { // If the request was successful
          resolve(JSON.parse(body)) // Resolve and return the parsed body
        } else if (res.headers['content-type'] === 'application/json') { // if the response was unsuccessful but received a JSON error
          reject(JSON.parse(body)) // Reject and return the parsed body
        } else { // Otherwise
          reject(new Error(`Request failed. HTTP ${res.statusCode}`)) // Reject and return the error code
        }
      })
    })
    request.on('error', (err) => { // On request errors
      reject(err) // Reject and return the error
    })

    request.write(data) // Write request data
    request.end() // Close the request
  })
}

/**
 * Defines the basic structure of a JSON-RPC request
 */
class JSONRPCRequest {
  /**
   * Construct a new JSONRPCRequest object
   * @param {String} method A valid JSON-RPC method for the server
   * @param {Array} params The parameters (if any) for that method
   */
  constructor (method, params = []) {
    this.id = uuid() // Set the ID field to a timestamp uuid
    this.method = method // Set the method
    this.params = params // Set the parameters
    this.jsonrpc = RPC_VERSION // Set the version to the current JSON-RPC version
  }
}

/**
 * Defines a simple JSON-RPC client that manages its own connection configuration and accepts a list of commands to bind methods to
 */
class JSONRPCClient {
  /**
   * Construct a new JSONRPCClient
   * @param {Object} connection A valid http or https options object
   * @param {Object} commands An object containing command names, parameter names and default parameter values for this client
   * @param {Number} methodCasing A METHOD_CASING value indicating how rpc commands should be cased when sending
   */
  constructor (connection = {}, commands = {}, methodCasing = METHOD_CASING.LOWER) {
    this.connection = connection // Set connection options
    this.commands = commands // Set commands
    this.methodCasing = methodCasing // Set casing
  }

  /**
   * Get the current commands for this client
   * @returns {Object} The current commands object
   */
  get commands () {
    return this._commands
  }

  /**
   * Set the current commands for this client. This will delete old command methods and recreate the appropriate ones
   * @param {Object} value The command object to set
   */
  set commands (value) {
    for (let command in this._commands) { // For all the current commands
      delete this[command] // Delete the command
    }
    this._commands = value // Set the new object
    for (let command in this._commands) { // For all the new commands
      this[command] = function () { // Create the command
        return this.call(command, arguments)
      }
    }
  }

  /**
   * Call an rpc command using the current configuration
   * @param {String} method The command to call
   * @param {Array} params The parameters for the command
   */
  call (method, params = []) {
    return request(this.handleCasing(method), this.handleDefaults(method, params), this.connection)
  }

  /**
   * Place the appropriate default values in a parameter array
   * @param {String} method The method to find the defaults of
   * @param {Array} params The input parameter array
   * @return {Array} An array containing the correct parameters for the input method
   */
  handleDefaults (method, params) {
    let r = [] // The output array
    if (method in this.commands) { // If the command exists
      for (let i = 0; i < this.commands[method].length; ++i) { // For every parameter of that command
        if (typeof this.commands[method][i] !== 'object' && !params[i]) { // If the parameter i is not an object and there is no input value
          throw new Error(`Required parameter ${this.commands[method][i]} not found for method ${method} at params[${i}]!`) // Throw a missing required parameter error
        }
        r.push(params[i] || this.commands[method][i][Object.keys(this.commands[method][i])[0]]) // @_@; Wizardry is afoot
        // Basically add the input value or the correct default value to r
      }
    }
    return r
  }

  /**
   * Apply the correct casing to the input method string
   * @param {String} method The string to apply casing to
   * @return {String} A correctly cased string
   */
  handleCasing (method) {
    if (this.methodCasing === METHOD_CASING.DEFAULT) { // If default casing
      return method // Return the input
    } else if (this.methodCasing === METHOD_CASING.UPPER) { // If upper case
      return method.toUpperCase() // Return upper case
    } else if (this.methodCasing === METHOD_CASING.LOWER) { // If lower case
      return method.toLowerCase() // Return lower case
    } else { // Otherwise
      return method // Return the input
    }
  }

  /**
   * A reference to the METHOD_CASING constant that defines different casing types
   */
  static get METHOD_CASING () {
    return METHOD_CASING
  }
}

module.exports = { request, JSONRPCRequest, JSONRPCClient, RPC_VERSION }
