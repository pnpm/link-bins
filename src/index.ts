import logger from '@pnpm/logger'
import binify, {Command} from '@pnpm/package-bins'
import {fromDir as readPackageJsonFromDir} from '@pnpm/read-package-json'
import {PackageJson} from '@pnpm/types'
import cmdShim = require('@zkochan/cmd-shim')
import isWindows = require('is-windows')
import mkdirp = require('mkdirp-promise')
import Module = require('module')
import fs = require('mz/fs')
import normalizePath = require('normalize-path')
import path = require('path')
import R = require('ramda')
import getPkgDirs from './getPkgDirs'

const POWER_SHELL_IS_SUPPORTED = isWindows()

export default async (modules: string, binPath: string) => {
  const pkgDirs = await getPkgDirs(modules)
  const allCmds = R.unnest(
    (await Promise.all(
      pkgDirs
        .map(normalizePath)
        .map(getPackageBins),
    ))
    .filter((cmds: Command[]) => cmds.length),
  )

  return linkBins(allCmds, binPath)
}

export async function linkBinsOfPackages (
  pkgs: Array<{
    manifest: PackageJson,
    location: string,
  }>,
  binsTarget: string,
) {
  if (!pkgs.length) return

  const allCmds = R.unnest(
    (await Promise.all(
      pkgs
        .map((pkg) => getPackageBinsFromPackageJson(pkg.manifest, pkg.location)),
    ))
    .filter((cmds: Command[]) => cmds.length),
  )

  return linkBins(allCmds, binsTarget)
}

async function linkBins (
  allCmds: Array<Command & {
    ownName: boolean,
    pkgName: string,
  }>,
  binPath: string,
) {
  if (!allCmds.length) return

  await mkdirp(binPath)

  const [cmdsWithOwnName, cmdsWithOtherNames] = R.partition((cmd) => cmd.ownName, allCmds)

  await Promise.all(cmdsWithOwnName.map((cmd: Command) => linkBin(cmd, binPath)))

  const usedNames = R.fromPairs(cmdsWithOwnName.map((cmd) => [cmd.name, cmd.name] as R.KeyValuePair<string, string>))
  await Promise.all(cmdsWithOtherNames.map((cmd: Command & {pkgName: string}) => {
    if (usedNames[cmd.name]) {
      logger.warn(`Cannot link bin "${cmd.name}" of "${cmd.pkgName}" to "${binPath}". A package called "${usedNames[cmd.name]}" already has its bin linked.`)
      return
    }
    usedNames[cmd.name] = cmd.pkgName
    return linkBin(cmd, binPath)
  }))
}

async function getPackageBins (target: string) {
  const pkg = await safeReadPkg(target)

  if (!pkg) {
    logger.warn(`There's a directory in node_modules without package.json: ${target}`)
    return []
  }

  return getPackageBinsFromPackageJson(pkg, target)
}

async function getPackageBinsFromPackageJson (pkgJson: PackageJson, pkgPath: string) {
  const cmds = await binify(pkgJson, pkgPath)
  return cmds.map((cmd) => ({...cmd, ownName: cmd.name === pkgJson.name, pkgName: pkgJson.name}))
}

async function linkBin (cmd: Command, binPath: string) {
  const externalBinPath = path.join(binPath, cmd.name)

  const nodePath = (await getBinNodePaths(cmd.path)).join(path.delimiter)
  return cmdShim(cmd.path, externalBinPath, {
    createPwshFile: POWER_SHELL_IS_SUPPORTED,
    nodePath,
  })
}

async function getBinNodePaths (target: string) {
  const targetRealPath = await fs.realpath(target)

  return R.union(
    Module['_nodeModulePaths'](targetRealPath), // tslint:disable-line:no-string-literal
    Module['_nodeModulePaths'](target), // tslint:disable-line:no-string-literal
  )
}

async function safeReadPkg (pkgPath: string): Promise<PackageJson | null> {
  try {
    return await readPackageJsonFromDir(pkgPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw err
  }
}
