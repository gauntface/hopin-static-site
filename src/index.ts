import * as process from 'process';
import * as path from 'path';
import * as fs from 'fs-extra';

import {getConfig, validateConfig, Config} from './models/config';
import {logger} from './utils/logger';
import {SiteGenerator} from './controllers/site-generator';

export {Config} from './models/config';

// tslint:disable-next-line:no-any
export async function buildSiteFromFile(configPath: any) {
  let buildDir = process.cwd();

  // TODO: Type checking on config path
  if (!configPath) {
    try {
      const defaultPath = path.resolve(buildDir, 'hopin.json5');
      await fs.access(defaultPath);
      configPath = defaultPath;
    } catch (err) {
      configPath = null;
    }
  } else {
    const stats = await fs.lstat(configPath);
    if (stats.isDirectory()) {
      buildDir = configPath;
      configPath = path.resolve(configPath, 'hopin.json5');
      try {
        await fs.access(configPath);
      } catch(err) {
        configPath = null;
      }
    } else {
      buildDir = path.dirname(configPath);
    }
  }

  const config = await getConfig(buildDir, configPath);
  return buildSite(buildDir, config, {});
}

export async function buildSite(relativePath: string, userConfig: {}, variables: {}) {
  if (!relativePath) {
    throw new Error('You must provide a path to the directory containing the sites content to buildSite(<directory>: string).');
  }
  if (!userConfig) {
    userConfig = {};
  }

  const config = await validateConfig(userConfig, relativePath);
  const siteGen = new SiteGenerator();
  await siteGen.build(relativePath, config, variables);
  logger.log(`✔️ C'est fini.`);
}