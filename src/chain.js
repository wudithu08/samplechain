/** @module chain */

/**
 * Current chain data.
 * @type {Block[]}
 */
export let chainData

import Block, { genesis } from './block'
import { readFileSync, writeFile as writeFileCb } from 'fs'
import { promisify } from 'util'
import assert from 'assert'
import { updateInterval, txPerBlock } from './consts'
import Account, { account as defaultAccount } from './account'
import { exportKey, hash } from './util'
import Transaction from './transaction'
import { txQueue } from './miner'

const writeFile = promisify(writeFileCb)

// load data
let dataChanged = false, updating = false
const chainFile = 'chain.json'

try {
  chainData = JSON.parse(readFileSync(chainFile))
  for(let id in chainData) chainData[id] = new Block(chainData[id])
} catch(e) {
  chainData = { [genesis.id]: genesis }
  console.log('[INFO] Data file not found, using empty: ' + e)
}

/**
 * Inserts a new block into the chain.
 * @param {Block} block the block to insert
 * @throws {AssertionError} on invalid block
 */
export function addBlock (block) {
  const wrongReason = 'Invalid block ' + block.id
  assert(block instanceof Block, wrongReason)
  assert(!block.isGenesis, wrongReason)
  assert(block.validate(), wrongReason)
  assert(block.data.every(tx => tx.validateNew(chainData[block.prev]) || txQueue.map(tx => tx.id).includes(tx.id)), wrongReason)
  assert(block.data.every((tx, i) => block.data.every((tx1, j) => i === j || tx1.id !== tx.id)), wrongReason)
  chainData[block.id] = block
  for (let tx of block.data) {
    const i = txQueue.map(tx => tx.id).indexOf(tx.id)
    if (i < 0) continue
    txQueue.splice(i, 1)
  }
  dataChanged = true
}

/**
 * Gets the last block in the chain.
 * @returns {Block}
 */
export function getLastBlock () {
  return Object.values(chainData).reduce((prev, curr) => curr.height > prev.height ? curr : prev, genesis)
}

/**
 * @typedef {object} UsableTx
 * @property {Block} block the block the (proposed) tx belongs to
 * @property {number} txCount the # of usable transaction in the block
 */

/**
 * Gets all usable transactions of an account.
 * @param {Account} [account] the account to check, defaults to current account
 * @returns {UsableTx}
 */
export function getUsableTx (account = defaultAccount) {
  if (account instanceof Account) account = exportKey(account.pub)
  return getLongestChain().filter(block => block.account === account).flatMap(block => {
    const usables = []
    for (let txCount of Array(txPerBlock).keys()) {
      const id = hash(block.id, String(txCount))
      if (Transaction.prototype.validateNew.call({ id }) && !txQueue.some(tx => tx.id === id)) usables.push({ block, txCount })
    }
    return usables
  })
}

/**
 * Gets the longest chain
 * @param {Block} [from] the last block to check, defaults to `getLastBlock()`
 * @returns {Block[]}
 */
export function getLongestChain ( from = getLastBlock() ) {
  return [...function* () {
    let last = from
    while (!last.isGenesis) {
      yield last
      last = chainData[last.prev]
    }
    yield last
  }()]
}

// save data
setInterval(async () => {
  if(dataChanged && !updating) {
    updating = true
    dataChanged = false
    let data = {}
    for (let id in chainData) {
      data[id] = chainData[id].toObject()
    }
    try {
      await writeFile(chainFile,
        JSON.stringify(data, null, process.env.NODE_ENV === 'development' ? 2 : 0)
      )
    } catch {
      console.log('[ERR] Cannot write data file')
    }
    updating = false
  }
}, updateInterval)
