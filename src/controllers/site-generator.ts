import * as fs from 'fs-extra';
import * as json5 from 'json5';
import * as path from 'path';
import {validateConfig} from '../models/config';

import {logger} from '../utils/logger';

export class SiteGenerator {
  build(configPath: any) {
    const rawConfig = this.readConfig(configPath);

    const config = validateConfig(rawConfig);

    // Find all files

    // Worker Pool Start
        
        // Read file

        // Parse yaml

        // Process markdown

        // Process template

    // Fin.
  }

  // Find and read config
  private async readConfig(configPath: any): Promise<any> {
    const resolvedPath = path.resolve(configPath);
    try {
      await fs.access(resolvedPath);
    } catch(err) {
      throw new Error(`Unable to access config path: ${configPath}.`)
    }
    const configBuffer = await fs.readFile(resolvedPath);
    const configContents = configBuffer.toString();
    return json5.parse(configContents);
  }
}