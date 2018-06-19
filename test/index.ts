import linkBins, {linkPackageBins} from '@pnpm/link-bins'
import test = require('tape')
import path = require('path')
import exists = require('path-exists')
import tempy = require('tempy')
import fs = require('mz/fs')

const fixtures = path.join(__dirname, 'fixtures')

test('linkBins()', async (t) => {
  const binTarget = tempy.directory()
  t.comment(`linking bins to ${binTarget}`)

  await linkBins(path.join(fixtures, 'node_modules'), binTarget)

  const binLocation = path.join(binTarget, 'simple')
  t.ok(await exists(binLocation))
  const content = await fs.readFile(binLocation, 'utf8')
  t.ok(content.includes('node_modules/simple/index.js'))
  t.end()
})

test('linkPackageBins()', async (t) => {
  const binTarget = tempy.directory()
  t.comment(`linking bins to ${binTarget}`)

  await linkPackageBins(path.join(fixtures, 'node_modules/simple'), binTarget)

  const binLocation = path.join(binTarget, 'simple')
  t.ok(await exists(binLocation))
  const content = await fs.readFile(binLocation, 'utf8')
  t.ok(content.includes('node_modules/simple/index.js'))
  t.end()
})
