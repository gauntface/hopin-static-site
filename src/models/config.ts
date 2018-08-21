import * as path from 'path';
import * as fs from 'fs-extra';
import * as json5 from 'json5';

export type Config = {
  contentPath: string
  outputPath: string
  markdownExtension: string
  workPoolSize: number
}

const CONFIG_DEFAULTS:Config = {
  contentPath: path.join(process.cwd(), 'content', path.sep),
  outputPath: path.join(process.cwd(), 'build', path.sep),
  markdownExtension: 'md',
  workPoolSize: 10,
};

// Takes a parsed json config file and validates it's contents
function validateConfig(config: any, configPath: string): Config {
  if (typeof config != 'object' || Array.isArray(config)) {
    throw new Error(`Invalid Config, expected an object. Parsed config is: ${JSON.stringify(config)}`)
  }

  // Normalize relative paths in config to absolute paths
  const fields = [
    'contentPath',
    'outputPath',
  ];
  for (const field of fields) {
    if (config[field]) {
      config[field] = path.resolve(path.dirname(configPath), config[field]);
      config[field] = path.join(config[field], path.sep);
    }
  }
  
  // Merge defaults with config
  return  Object.assign({}, CONFIG_DEFAULTS, config);
}

// Find and read config and validate it's contents
async function readConfig(configPath: string|null): Promise<Config> {
  const resolvedPath = path.resolve(configPath);
  try {
    await fs.access(resolvedPath);
  } catch(err) {
    throw new Error(`Unable to access config path: ${configPath}.`)
  }
  const configBuffer = await fs.readFile(resolvedPath);
  const configContents = configBuffer.toString();
  try {
    return json5.parse(configContents);
  } catch (err) {
    throw new Error(`Unable to parse the config file: ${err.message}`);
  }
}

export async function getConfig(configPath: string|null): Promise<Config> {
  let userConfig = {};
  if (configPath) {
    userConfig = await readConfig(configPath);
  }
  return validateConfig(userConfig, configPath);
}