import * as path from 'path';
import * as fs from 'fs-extra';
import * as json5 from 'json5';
import {logger} from '../utils/logger';
import { StylesAssetGroup } from '@hopin/render/build/models/styles-assets-groups';

const THEME_FILE = 'theme.json5';

export type Style = {
  inline?: string[]
  sync?: string[]
  async?: string[]
};

export type Script = {
  inline?: string[],
  sync?: string[],
  async?: string[],
};

export type Config = {
  contentPath: string
  outputPath: string
  themePath: string
  staticPath: string
  navigationFile: string
  markdownExtension: string
  workPoolSize: number
  origin: string
  styles: Style,
  scripts: Script,
  tokenAssets: {
    [key: string]: {
      styles: Style,
      scripts: Script,
    }
  }
};

type TokenAssets = {
  [key: string]: {
    styles: Style,
    scripts: Script,
  }
};

export type InternalConfig = {
  contentPath: string
  outputPath: string
  theme: Theme | null
  staticPath: string
  navigationFile: string
  markdownExtension: string
  workPoolSize: number
  origin: string
  tokenAssets: TokenAssets
  styles: Style
  scripts: Script
};

export interface Theme {
  root: string;
  elements: string;
  styleguide: string;
  assets: Assets;
}

export interface Elements {
  root: string;
  tags: Tag[];
}

export interface Tag {
  tag: string;
  styles: Style;
  scripts: Script;
}

export interface Assets {
  dir: string;
  outputdir: string;
}

function getDefaults(buildDir: string): Config {
  return {
    contentPath: path.join(buildDir, 'content', path.sep),
    navigationFile: path.join(buildDir, 'content', 'navigation.json'),
    outputPath: path.join(buildDir, 'build', path.sep),
    themePath: path.join(__dirname, '..', 'themes', 'default'),
    staticPath: path.join(buildDir, 'static', path.sep),
    markdownExtension: 'md',
    workPoolSize: 10,
    origin: '',
    tokenAssets: {},
    styles: {},
    scripts: {},
  };
}

// Takes a parsed json config file and validates it's contents
// tslint:disable-next-line:no-any
export async function validateConfig(config: any, relativePath: string): Promise<InternalConfig> {
  if (typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`Invalid Config, expected an object. Parsed config is: ${JSON.stringify(config)}`);
  }

  let relPath = relativePath;
  try {
    const s = await fs.stat(relPath);
    if (s.isFile()) {
      relPath = path.dirname(relPath);
    }
  } catch (e) {}

  // Normalize relative paths in config to absolute paths
  const fields = [
    'contentPath',
    'outputPath',
    'themePath',
    'navigationFile',
  ];
  for (const field of fields) {
    if (config[field]) {
      config[field] = path.resolve(relPath, config[field]);
    }
  }

  if (config.tokenAssets) {
    for (const t of Object.keys(config.tokenAssets)) {
      const asset = config.tokenAssets[t];
      if (asset.styles && asset.styles.inline) {
        const inlineContents = [];
        for (const inline of asset.styles.inline) {
          const absPath = path.resolve(relPath, inline);
          inlineContents.push(absPath);
        }
        config.tokenAssets[t].styles.inline = inlineContents;
      }
    }
  }

  if (config.styles) {
    if (config.styles.inline) {
      const inlineContents = [];
      for (const inline of config.styles.inline) {
        const absPath = path.resolve(relPath, inline);
        inlineContents.push(absPath);
      }
      config.styles.inline = inlineContents;
    }
  }

  // Merge defaults with config
  const cfg = Object.assign({}, getDefaults(relPath), config);
  return convertConfig(cfg);
}

async function convertConfig(cfg: Config): Promise<InternalConfig> {
  const theme = await getThemeFile(cfg.themePath);
  const elements = await getElementsFile(cfg.themePath, theme);
  const tokens: TokenAssets = {};
  if (elements) {
    for (const t of elements.tags) {
      tokens[t.tag] = {
        styles: t.styles || {},
        scripts: t.scripts || {},
      };
    }
  }

  return {
    contentPath: cfg.contentPath,
    outputPath: cfg.outputPath,
    theme,
    staticPath: cfg.staticPath,
    navigationFile: cfg.navigationFile,
    markdownExtension: cfg.markdownExtension,
    workPoolSize: cfg.workPoolSize,
    origin: cfg.origin,
    tokenAssets: tokens,
    styles: cfg.styles,
    scripts: cfg.scripts,
  };
}

async function getThemeFile(dir: string): Promise<Theme|null> {
  const themeFile = path.join(dir, THEME_FILE);
  try {
      const s = await fs.stat(themeFile);
      if (!s) {
          throw new Error(`Unable to stat the theme file.s`);
      }
  } catch (e) {
      logger.error(`Unable to find the theme ${themeFile}`, e);
      return null;
  }
  
  try {
      const themeBuffer = await fs.readFile(themeFile);
      const theme = json5.parse(themeBuffer.toString()) as Theme;
      theme.root = path.dirname(themeFile);
      if (theme.assets && theme.assets.dir) {
        if (!path.isAbsolute(theme.assets.dir)) {
          theme.assets.dir = path.join(dir, theme.assets.dir);
        }
      }
      return theme;
  } catch (err) {
      logger.error(`Unable to read and parse the theme:`, err);
  }
  
  return null;
}

async function getElementsFile(dir: string, theme: Theme): Promise<Elements|null> {
  if (!theme || !theme.elements) {
    return null;
  }

  const elementsFile = path.join(dir, theme.elements);
  const elementsDir = path.dirname(elementsFile);
  try {
      const s = await fs.stat(elementsFile);
      if (!s) {
          throw new Error(`Unable to stat the theme file.s`);
      }
  } catch (e) {
      logger.error(`Unable to find the elements ${elementsFile}`, e);
      return null;
  }
  
  try {
      const elementsBuffer = await fs.readFile(elementsFile);
      const tags = json5.parse(elementsBuffer.toString()) as Tag[];
      for (let i = 0; i < tags.length; i++) {
        const t = tags[i];
        if (t.styles) {
          if (t.styles.inline) {
            for ( let i = 0; i < t.styles.inline.length; i++) {
              const s = t.styles.inline[i];
              if (!path.isAbsolute(s)) {
                t.styles.inline[i] = path.resolve(elementsDir, s);
              }
            }
          }
          if (t.styles.sync) {
            for ( let i = 0; i < t.styles.sync.length; i++) {
              const s = t.styles.sync[i];
              if (!path.isAbsolute(s) && s.indexOf('http') !== 0) {
                t.styles.sync[i] = path.resolve(elementsDir, s);
              }
            }
          }
          if (t.styles.async) {
            for ( let i = 0; i < t.styles.async.length; i++) {
              const s = t.styles.async[i];
              if (!path.isAbsolute(s) && s.indexOf('http') !== 0) {
                t.styles.async[i] = path.resolve(elementsDir, s);
              }
            }
          }
        }
        if (t.scripts) {
          if (t.scripts.inline) {
            for ( let i = 0; i < t.scripts.inline.length; i++) {
              const s = t.scripts.inline[i];
              if (!path.isAbsolute(s)) {
                t.scripts.inline[i] = path.resolve(elementsDir, s);
              }
            }
          }
          if (t.scripts.sync) {
            for ( let i = 0; i < t.scripts.sync.length; i++) {
              const s = t.scripts.sync[i];
              if (!path.isAbsolute(s)) {
                t.scripts.sync[i] = path.resolve(elementsDir, s);
              }
            }
          }
          if (t.scripts.async) {
            for ( let i = 0; i < t.scripts.async.length; i++) {
              const s = t.scripts.async[i];
              if (!path.isAbsolute(s)) {
                t.scripts.async[i] = path.resolve(elementsDir, s);
              }
            }
          }
        }
      }
      return {
        root: path.dirname(elementsFile),
        tags,
      };
  } catch (err) {
      logger.error(`Unable to read and parse the theme:`, err);
  }
  
  return null;
}

// Find and read config and validate it's contents
async function readConfig(configPath: string|null): Promise<Config> {
  const resolvedPath = path.resolve(configPath);
  try {
    await fs.access(resolvedPath);

  } catch(err) {
    throw new Error(`Unable to access config path: ${configPath}.`);
  }

  const configBuffer = await fs.readFile(resolvedPath);
  const configContents = configBuffer.toString();
  try {
    return json5.parse(configContents);
  } catch (err) {
    throw new Error(`Unable to parse the config file: ${err.message}`);
  }
}

export async function getConfig(buildDir: string, configPath: string|null): Promise<{}> {
  if (!configPath) {
    return Object.assign({}, getDefaults(buildDir));
  }

  let userConfig = {};
  if (configPath) {
    userConfig = await readConfig(configPath);
  }

  return userConfig;
}