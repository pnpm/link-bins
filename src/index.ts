import logger from '@pnpm/logger'
import binify from '@pnpm/package-bins'
import {PackageJson} from '@pnpm/types'
import cmdShim = require('@zkochan/cmd-shim')
import isWindows = require('is-windows')
import mkdirp = require('mkdirp-promise')
import Module = require('module')
import fs = require('mz/fs')
import normalizePath = require('normalize-path')
import path = require('path')
import R = require('ramda')
import readPackageJson = require('read-package-json')
import getPkgDirs from './getPkgDirs'

const IS_WINDOWS = isWindows()

export default async (modules: string, binPath: string, exceptPkgName?: string) => {
  const pkgDirs = await getPkgDirs(modules)
  return Promise.all(
    pkgDirs
      .map((pkgDir) => normalizePath(pkgDir))
      .filter((pkgDir) => !exceptPkgName || !pkgDir.endsWith(`/${exceptPkgName}`))
      .map((pkgDir: string) => linkPackageBins(pkgDir, binPath)),
  )
}

/**
 * Links executable into `node_modules/.bin`.
 */
export async function linkPackageBins (target: string, binPath: string) {
  const pkg = await safeReadPkg(path.join(target, 'package.json'))

  if (!pkg) {
    logger.warn(`There's a directory in node_modules without package.json: ${target}`)
    return
  }

  const cmds = await binify(pkg, target)

  if (!cmds.length) return

  await mkdirp(binPath)
  await Promise.all(cmds.map(async (cmd) => {
    const externalBinPath = path.join(binPath, cmd.name)

    const nodePath = (await getBinNodePaths(target)).join(path.delimiter)
    return cmdShim(cmd.path, externalBinPath, {nodePath})
  }))
}

async function getBinNodePaths (target: string) {
  const targetRealPath = await fs.realpath(target)

  return R.union(
    Module['_nodeModulePaths'](targetRealPath), // tslint:disable-line:no-string-literal
    Module['_nodeModulePaths'](target), // tslint:disable-line:no-string-literal
  )
}

function safeReadPkg (pkgPath: string): Promise<PackageJson | null> {
  return new Promise((resolve, reject) => {
    readPackageJson(pkgPath, (err: Error, pkg: PackageJson) => {
      if (!err) {
        resolve(pkg)
      } else if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        reject(err)
      } else {
        resolve(null)
      }
    })
  })
}
