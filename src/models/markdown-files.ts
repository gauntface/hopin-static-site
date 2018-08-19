import * as fs from 'fs-extra';
import {glob} from '../utils/promise-glob';
import {Config} from './config';

export async function getMarkdownFiles(config: Config): Promise<Array<string>> {
  try {
    await fs.access(config.contentPath);
  } catch (err) {
    throw new Error(`Unable to access content directory: ${err.message}`);
  }
  
  return glob(`**/*.${config.markdownExtension}`, {
    cwd: config.contentPath,
    strict: true,
    absolute: true,
  });
}