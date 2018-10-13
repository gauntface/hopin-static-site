import * as process from 'process';
import * as path from 'path';
import * as fs from 'fs-extra';
import {logger} from '@hopin/logger';

import {SiteGenerator} from './controllers/site-generator';

logger.setPrefix('@hopin/static-site');

export async function buildSite(configPath: any) {
  let buildDir = process.cwd();

  // TODO: Type checking on config path
  if (!configPath) {
    try {
      const defaultPath = path.resolve(buildDir, 'hopin.json');
      await fs.access(defaultPath);
      configPath = defaultPath;
    } catch (err) {
      configPath = null;
    }
  } else {
    const stats = await fs.lstat(configPath);
    if (stats.isDirectory()) {
      buildDir = configPath;
      configPath = path.resolve(configPath, 'hopin.json');
      try {
        await fs.access(configPath);
      } catch(err) {
        configPath = null;
      }
    }
  }

  const siteGen = new SiteGenerator();
  try {
    await siteGen.build(buildDir, configPath);
    logger.log(`✔️ C'est fini.`);
  } catch (err) {
    logger.error('❌ Unable to build site.');
    logger.error(err);
    process.exit(1);
  }
}