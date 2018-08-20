import * as path from 'path';

import {getConfig} from '../models/config';
import {getMarkdownFiles} from '../models/markdown-files';
import {logger} from '../utils/logger';
import {WorkerPool} from './worker-pool';


export class SiteGenerator {
  async build(configPath: string|null) {
    const config = await getConfig(configPath);
    logger.log('🔧 Config......');
    logger.log(`    📓 Content : ${path.relative(process.cwd(), config.contentPath)}`);
    logger.log(`    📦 Output  : ${path.relative(process.cwd(), config.contentPath)}`);

    // Find all files
    const mdFiles = await getMarkdownFiles(config);
    logger.log(`🔍 Found ${mdFiles.length} markdown files.`);

    // Worker Pool Start
    const workerPool = new WorkerPool(10, mdFiles);
    await workerPool.start(path.join(__dirname, 'file-processor.js'));
        
        // Read file

        // Parse yaml

        // Process markdown

        // Process template

    // Fin.
  }
}