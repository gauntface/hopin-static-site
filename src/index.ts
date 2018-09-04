import * as process from 'process';
import * as path from 'path';
import * as fs from 'fs-extra';

import {logger} from './utils/logger';
import {SiteGenerator} from './controllers/site-generator';

export async function buildSite(configPath: any) {
  // TODO: Type checking on config path
  if (!configPath) {
    try {
      const defaultPath = path.resolve('.', 'hopin.json');
      fs.access(defaultPath);
      configPath = defaultPath;
    } catch (err) {
      configPath = null;
    }
  } else {
    const stats = fs.lstatSync(configPath);
    if (stats.isDirectory()) {
      configPath = path.resolve(configPath, 'hopin.json');
    }
  }

  const siteGen = new SiteGenerator();
  try {
    await siteGen.build(configPath);
    logger.log(`C'est fini.`);
  } catch (err) {
    logger.error('Unable to build site.');
    logger.error(err);
    process.exit(1);
  }
}