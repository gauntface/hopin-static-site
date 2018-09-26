import * as path from 'path';
import * as fs from 'fs-extra';
import * as json5 from 'json5';
import { DEFAULT_CONFIG } from 'tslint/lib/configuration';

export type Style = {
  inline?: string
  sync?: string
  async?: string
}

export type Config = {
  contentPath: string
  outputPath: string
  themePath: string
  navigationFile: string
  markdownExtension: string
  workPoolSize: number
  tokenAssets: {
    [key: string]: {
      styles: Style,
    }
  }
}

function getDefaults(buildDir: string): Config {
  return {
    contentPath: path.join(buildDir, 'content', path.sep),
    navigationFile: path.join(buildDir, 'content', 'navigation.json'),
    outputPath: path.join(buildDir, 'build', path.sep),
    themePath: path.join(__dirname, '..', 'themes', 'default'),
    markdownExtension: 'md',
    workPoolSize: 10,
    tokenAssets: {},
  };
}

// Takes a parsed json config file and validates it's contents
async function validateConfig(config: any, buildDir: string, configPath: string): Promise<Config> {
  if (typeof config != 'object' || Array.isArray(config)) {
    throw new Error(`Invalid Config, expected an object. Parsed config is: ${JSON.stringify(config)}`)
  }

  // Normalize relative paths in config to absolute paths
  const fields = [
    'contentPath',
    'outputPath',
    'themePath',
    'navigationFile',
  ];
  for (const field of fields) {
    if (config[field]) {
      config[field] = path.resolve(path.dirname(configPath), config[field]);
    }
  }
  
  if (config.tokenAssets) {
    for (const t of Object.keys(config.tokenAssets)) {
      const asset = config.tokenAssets[t];
      if (asset.styles && asset.styles.inline) {
        const absPath = path.resolve(path.dirname(configPath), asset.styles.inline);
        const buffer = await fs.readFile(absPath);
        config.tokenAssets[t].styles.inline = buffer.toString();
      }
    }
  }

  // Merge defaults with config
  return  Object.assign({}, getDefaults(buildDir), config);
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

export async function getConfig(buildDir: string, configPath: string|null): Promise<Config> {
  if (!configPath) {
    return Object.assign({}, getDefaults(buildDir));
  }

  let userConfig = {};
  if (configPath) {
    userConfig = await readConfig(configPath);
  }

  return validateConfig(userConfig, buildDir, configPath);
}