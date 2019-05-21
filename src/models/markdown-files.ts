import * as fs from 'fs-extra';
import {glob} from '../utils/glob-promise';
import {Config} from './config';

export async function getMarkdownFiles(config: Config): Promise<string[]> {
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