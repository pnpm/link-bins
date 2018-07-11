///<reference path="../typings/index.d.ts" />
import linkBins, {
  linkBinsOfPackages,
} from '@pnpm/link-bins'
import test = require('tape')
import path = require('path')
import exists = require('path-exists')
import tempy = require('tempy')
import fs = require('mz/fs')
import isWindows = require('is-windows')

const fixtures = path.join(__dirname, 'fixtures')
const simpleFixture = path.join(fixtures, 'simple-fixture')
const binNameConflictsFixture = path.join(fixtures, 'bin-name-conflicts')

const POWER_SHELL_IS_SUPPORTED = isWindows()
const IS_WINDOWS = isWindows()

function getExpectedBins (bins: string[]) {
  const expectedBins = [...bins]
  if (POWER_SHELL_IS_SUPPORTED) {
    bins.forEach((bin) => expectedBins.push(`${bin}.ps1`))
  }
  if (IS_WINDOWS) {
    bins.forEach((bin) => expectedBins.push(`${bin}.cmd`))
  }
  return expectedBins.sort()
}

test('linkBins()', async (t) => {
  const binTarget = tempy.directory()
  t.comment(`linking bins to ${binTarget}`)

  await linkBins(path.join(simpleFixture, 'node_modules'), binTarget)

  t.deepEqual(await fs.readdir(binTarget), getExpectedBins(['simple']))
  const binLocation = path.join(binTarget, 'simple')
  t.ok(await exists(binLocation))
  const content = await fs.readFile(binLocation, 'utf8')
  t.ok(content.includes('node_modules/simple/index.js'))
  t.end()
})

test('linkBinsOfPackages()', async (t) => {
  const binTarget = tempy.directory()
  t.comment(`linking bins to ${binTarget}`)

  await linkBinsOfPackages(
    [
      {
        manifest: await import(path.join(simpleFixture, 'node_modules/simple/package.json')),
        location: path.join(simpleFixture, 'node_modules/simple'),
      },
    ],
    binTarget,
  )

  t.deepEqual(await fs.readdir(binTarget), getExpectedBins(['simple']))
  const binLocation = path.join(binTarget, 'simple')
  t.ok(await exists(binLocation))
  const content = await fs.readFile(binLocation, 'utf8')
  t.ok(content.includes('node_modules/simple/index.js'))
  t.end()
})

test('linkBins() resolves conflicts. Prefer packages that use their name as bin name', async (t) => {
  const binTarget = tempy.directory()
  t.comment(`linking bins to ${binTarget}`)

  await linkBins(path.join(binNameConflictsFixture, 'node_modules'), binTarget)

  t.deepEqual(await fs.readdir(binTarget), getExpectedBins(['bar', 'foofoo']))

  {
    const binLocation = path.join(binTarget, 'bar')
    t.ok(await exists(binLocation))
    const content = await fs.readFile(binLocation, 'utf8')
    t.ok(content.includes('node_modules/bar/index.js'))
  }

  {
    const binLocation = path.join(binTarget, 'foofoo')
    t.ok(await exists(binLocation))
    const content = await fs.readFile(binLocation, 'utf8')
    t.ok(content.includes('node_modules/foo/index.js'))
  }

  t.end()
})

test('linkBinsOfPackages() resolves conflicts. Prefer packages that use their name as bin name', async (t) => {
  const binTarget = tempy.directory()
  t.comment(`linking bins to ${binTarget}`)

  const modulesPath = path.join(binNameConflictsFixture, 'node_modules')

  await linkBinsOfPackages(
    [
      {
        manifest: await import(path.join(modulesPath, 'bar', 'package.json')),
        location: path.join(modulesPath, 'bar'),
      },
      {
        manifest: await import(path.join(modulesPath, 'foo', 'package.json')),
        location: path.join(modulesPath, 'foo'),
      },
    ],
    binTarget,
  )

  t.deepEqual(await fs.readdir(binTarget), getExpectedBins(['bar', 'foofoo']))

  {
    const binLocation = path.join(binTarget, 'bar')
    t.ok(await exists(binLocation))
    const content = await fs.readFile(binLocation, 'utf8')
    t.ok(content.includes('node_modules/bar/index.js'))
  }

  {
    const binLocation = path.join(binTarget, 'foofoo')
    t.ok(await exists(binLocation))
    const content = await fs.readFile(binLocation, 'utf8')
    t.ok(content.includes('node_modules/foo/index.js'))
  }

  t.end()
})
