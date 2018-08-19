import * as process from 'process';

import {logger} from './utils/logger';
import {SiteGenerator} from './controllers/site-generator';

export async function buildSite(configPath: any) {
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