import flatten = require('arr-flatten')
import fs = require('mz/fs')
import pFilter = require('p-filter')
import path = require('path')

export default async function (
  modules: string,
  warn: (msg: string) => void,
): Promise<string[]> {
  const dirs = await getDirectories(modules, warn)
  const subdirs = await Promise.all(
    dirs.map((dir: string): Promise<string[]> => {
      return isScopedPkgsDir(dir) ? getDirectories(dir, warn) : Promise.resolve([dir])
    }),
  )
  return flatten(subdirs)
}

async function getDirectories (
  srcPath: string,
  warn: (msg: string) => void,
): Promise<string[]> {
  let dirs: string[]
  try {
    dirs = await fs.readdir(srcPath)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw err
    }
    dirs = []
  }
  return pFilter(
    dirs
      .filter((relativePath) => relativePath[0] !== '.') // ignore directories like .bin, .store, etc
      .map((relativePath) => path.join(srcPath, relativePath)),
    async (absolutePath: string) => {
      try {
        const stats = await fs.stat(absolutePath)
        return stats.isDirectory()
      } catch (err) {
        if (err!.code !== 'ENOENT') throw err
        warn(`Cannot find file at ${absolutePath} although it was listed by readdir`)
        return false
      }
    },
  )
}

function isScopedPkgsDir (dirPath: string) {
  return path.basename(dirPath)[0] === '@'
}
