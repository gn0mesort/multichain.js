/**
 * multichain.js
 * Defines a NodeJS Multichain client
 */

// Requires
const { JSONRPCClient } = require('./jsonrpc.js') // JSON-RPC client object
const fs = require('fs') // File system library

// Constants
const CHAIN_PATH = process.platform === 'win32' ? `${process.env.APPDATA}\\MultiChain` : `${process.env.HOME}/.multichain` // Path to Multichain data folder. OS dependent

/**
 * Defines a Multichain client
 */
class Client extends JSONRPCClient {
  /**
   * Constructs a new Client object
   * @param {String} name The name of the chain to construct a client for. If no other input is provided the chain name will be used to configure the connection
   * @param {Object} commands A valid JSONRPCClient command object that defines commands for this client. Defaults to null
   * @param {Object} connection A valid http or https options object. Defaults to an empty object
   */
  constructor (name, commands = null, connection = {}) {
    super(connection, commands || require('./commands.js')) // Run base constructor
    this.name = name // Set name
  }

  /**
   * Get the current chain name
   * @return {String} The current name
   */
  get name () {
    return this._name
  }

  /**
   * Set the current chain name. This will also reconfigure the connection to the new chain
   * @param {String} value The new chain name to set
   */
  set name (value) {
    this.connection = Client.getConnectionByName(value, this.connection) // Reconfigure connection
    this._name = value // Set chain name
  }

  /**
   * Return a connection object for the input name based on the input connection
   * @param {String} name The name of the chain to use
   * @param {Object} connection The base connection object to use
   * @return {Object} The input connection object with the values of port, user, and pass set properly
   */
  static getConnectionByName (name, connection) {
    let chains = Client.getChainNames() // Get chain names
    if (chains.indexOf(name) !== -1) { // If the input name is a valid chain name
      let config = fs.readFileSync(`${CHAIN_PATH}/${name}/multichain.conf`, 'utf8').trim().split('\n').map((element) => {
        return element.trim()
      }) // Read the config file
      connection.user = config[0].split('=')[1] // Set the user based on the chain config file
      connection.pass = config[1].split('=')[1] // Set the password based on the chain config file
      connection.port = fs.readFileSync(`${CHAIN_PATH}/${name}/params.dat`, 'utf8').trim().split('\n').map((element) => {
        return element.trim()
      }).find((element) => {
        return element.startsWith('default-rpc-port')
      }).split('=')[1].trim().split(/\s+/g)[0] // Read, and manipulate the paramater file to get the default rpc port
    } else { // Otherwise
      throw new Error('Invalid Chain!') // The chain isn't valid!
    }
    return connection
  }

  /**
   * Get an array of Multichain blockchains stored on the current system
   */
  static getChainNames () {
    return fs.readdirSync(CHAIN_PATH).filter((element) => {
      if (fs.statSync(`${CHAIN_PATH}/${element}`).isDirectory() && !element.startsWith('.') && element !== 'multichaind') {
        return true
      }
      return false
    }) // Read the CHAIN_PATH and eliminate invalid directories
  }
}

module.exports = { Client }
