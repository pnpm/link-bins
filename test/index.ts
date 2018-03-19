import linkBins, {linkPackageBins} from '@pnpm/link-bins'
import test = require('tape')
import path = require('path')
import exists = require('path-exists')
import tempy = require('tempy')

const fixtures = path.join(__dirname, 'fixtures')

test('linkBins()', async (t) => {
  const binTarget = tempy.directory()
  await linkBins(path.join(fixtures, 'node_modules'), binTarget)

  t.ok(await exists(path.join(binTarget, 'simple')))
  t.end()
})

test('linkPackageBins()', async (t) => {
  const binTarget = tempy.directory()
  await linkPackageBins(path.join(fixtures, 'node_modules/simple'), binTarget)

  t.ok(await exists(path.join(binTarget, 'simple')))
  t.end()
})
