/** @module block */

import { hash, addressFromKey } from './util'
import { readFileSync } from 'fs'
import Transaction from './transaction'
import assert from 'assert'
import { chainData } from './chain'
import { difficulty } from './consts'

/** Object representing a block. */
export default class Block {
  /**
   * Creates a block object.
   * @param {string} options.prev previous block ID
   * @param {(Transaction|any)} options.data[] data of the block
   * @param {Account} options.account the account that sends the block
   * @param {string} options.nonce random bytes
   * @param {boolean} options.isGenesis whether the block is the genesis block
   * @param {string} [options.id] block ID in hexadecimal
   * @param {number} [options.height] block height in current chain
   */
  constructor (options) {
    ;['prev', 'data', 'account', 'nonce', 'isGenesis', 'id', 'height'].forEach(prop => this[prop] = options[prop])
    this.init()
  }

  /**
   * Initializes the block object.
   * @throws {AssertionError|Error} on invalid block
   */
  init () {
    assert(this.isGenesis || chainData[this.prev], 'No previous block')
    if(!this.id) this.id = hash(this.prev, JSON.stringify(this.data), this.account, this.nonce)
    if(typeof this.height !== 'number') this.height = chainData[this.prev].height + 1
    assert(Array.isArray(this.data))
    this.data = this.data.map(tx => tx instanceof Transaction ? tx : new Transaction(tx))
    if(this.isGenesis) return
    if(!this.validate()) throw new Error('Invalid block')
  }

  /**
   * Validates the block object.
   * @returns {boolean}
   */
  validate () {
    if(!this.isGenesis && !(BigInt('0x' + this.id) < difficulty)) return false
    if(!this.data.every(tx => tx instanceof Transaction)) return false
    if(!this.data.every(tx => tx.validate())) return false
    return true
  }

  /**
   * Converts this block to a network-transferrable object.
   * @returns {object}
   */
  toObject () {
    const obj = Object.create(null)
    ;['prev', 'account', 'nonce', 'id', 'height'].forEach(prop => obj[prop] = this[prop])
    obj.data = this.data.map(tx => tx.toObject())
    if(this.isGenesis) obj.isGenesis = this.isGenesis
    return obj
  }

  /** Converts this block to an object to be displayed on FE. */
  toShowObject () {
    const obj = this.toObject()
    obj.data = this.data.map(tx => tx.toShowObject())
    obj.address = addressFromKey(this.account)
    return obj
  }
}

/** The genesis block. */
export const genesis = new Block(JSON.parse(readFileSync('genesis.json')))
