import * as path from 'path';

import {getConfig} from '../models/config';
import {getMarkdownFiles} from '../models/markdown-files';
import {logger} from '../utils/logger';
import {WorkerPool} from './worker-pool';


export class SiteGenerator {
  async build(buildDir: string, configPath: string|null) {
    const config = await getConfig(buildDir, configPath);
    logger.log('🔧 Config......');
    logger.log(`    🏗️ Building In : ${path.relative(process.cwd(), buildDir)}`);
    logger.log(`    📓 Content     : ${path.relative(buildDir, config.contentPath)}`);
    logger.log(`    📦 Output      : ${path.relative(buildDir, config.outputPath)}`);

    // Find all files
    const mdFiles = await getMarkdownFiles(config);
    logger.log(`🔍 Found ${mdFiles.length} markdown files.`);

    // Worker Pool Start
    const workerPool = new WorkerPool(config, mdFiles);
    const results = await workerPool.start(path.join(__dirname, 'file-processor.js'));
    let errors = [];
    for (const key of Object.keys(results)) {
      const result = results[key];
      if (result instanceof Error) {
        errors.push(`Error building ${key}\n${result.message}`);
      }
    }
    if (errors.length > 0) {
      for(const err of errors) {
        console.error(err);
      }
      throw new Error(`${errors} errors occured.`);
    }
    // Fin.
  }
}