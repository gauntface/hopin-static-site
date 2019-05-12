import {createHTMLTemplateFromFile, createComponentTemplateFromFile} from '@hopin/render';
import {renderMarkdown} from '@hopin/markdown';
import * as fs from 'fs-extra';
import * as path from 'path';

import { logger } from '../utils/logger';
import { Message, RUN_WITH_DETAILS_MSG } from './worker-pool';
import { Config } from '../models/config';
import {NavNode} from '../models/nav-tree';

async function run(inputPath: string, config: Config, navigation: {[id: string]: Array<NavNode>}): Promise<Message> {
  // TODO: Check files exist first
  try {
    const compTmpl = await createComponentTemplateFromFile(inputPath);

    // Render the original page and run it through the markdown parser
    const compBundle = await compTmpl.render(/*{
        topLevel: {
            navigation,
        }
    }*/);
    const markdownRender = await renderMarkdown(compBundle.renderedTemplate, {
        staticDir: config.staticPath,
    });

    const topLevelTemplate = (compTmpl.yaml as any)['template'] ? (compTmpl.yaml as any)['template'] : 'default.tmpl'
    const themeFile = path.join(config.themePath, topLevelTemplate);
    const wrappingTemplate = await createHTMLTemplateFromFile(themeFile);

    // Wrapping template will be the template that displays the styles etc
    // so copy template styles and scripts over
    wrappingTemplate.styles.prepend(compBundle.styles);
    wrappingTemplate.scripts.add(compBundle.scripts);

    for (const t of markdownRender.tokens) {
      const tokenAssets = config.tokenAssets[t];
      if (!tokenAssets) {
        continue;
      }

      if (tokenAssets.styles) {
        const styles = tokenAssets.styles;
        if (styles.inline) {
            for (const filePath of styles.inline) {
                const buffer = await fs.readFile(filePath);
                wrappingTemplate.styles.inline.add(filePath, buffer.toString());
            }
        }
        if (styles.sync) {
            for (const filePath of styles.sync) {
                wrappingTemplate.styles.sync.add(filePath, filePath);
            }
        }
        if (styles.async) {
          for (const filePath of styles.async) {
            wrappingTemplate.styles.async.add(filePath, filePath);
          }
        }
      }

      if (tokenAssets.scripts) {
        const scripts = tokenAssets.scripts;
        if (scripts.inline) {
            for (const filePath of scripts.inline) {
                const buffer = await fs.readFile(filePath);
                wrappingTemplate.scripts.inline.add(filePath, {
                  src: buffer.toString(),
                  type: path.extname(filePath) === '.mjs' ? 'module' : 'nomodule',
                });
            }
        }
        if (scripts.sync) {
            for (const filePath of scripts.sync) {
                wrappingTemplate.scripts.sync.add(filePath, filePath);
            }
        }
        if (scripts.async) {
          for (const filePath of scripts.async) {
            wrappingTemplate.scripts.async.add(filePath, filePath);
          }
        }
      }
    }

    // Finally render the content in the wrapping template
    const wrappedHTML = await wrappingTemplate.render(compBundle/*, {
        topLevel: {
            content: markdownRender.html,
            navigation,
            page: template.yaml
        },
    }*/);

    const relativePath = path.relative(config.contentPath, inputPath);

    // replace .md with .html
    const relPathPieces = path.parse(relativePath);
    delete relPathPieces.base;
    relPathPieces.ext = '.html';

    const outputPath = path.join(config.outputPath, path.format(relPathPieces));
    await fs.mkdirp(path.dirname(outputPath));
    await fs.writeFile(outputPath, wrappedHTML);

    return {
        result: {
            inputPath,
            outputPath,
        }
    };
  } catch (err) {
    logger.error('File Processor run failed.');
    logger.error(err);
    return {
        error: `Unable to read and parse: ${err.message}`,
    };
  }
}

export async function start(args: Array<string>, config: Config, navigation: {[id: string]: Array<NavNode>} = {}): Promise<Message> {
    if (args.length != 3) {
        logger.warn('Unexpected number of process args passed to file-processor: ', process.argv);
        return {
            error: `Unexpected number of process args: ${JSON.stringify(process.argv)}`,
        };
    }

    return run(args[2], config, navigation);
}

let isRunning = false;
process.on('message', (msg: any) => {
  switch(msg.name) {
    case RUN_WITH_DETAILS_MSG: {
      if (isRunning) {
          logger.warn('File processor already running, ignoring msg: ', msg);
          return;
      }

      isRunning = true;
      start(process.argv, msg.config, msg.navigation).then((msg) => {
        process.send(msg);
        process.exit(0);
      })
      .catch((err) => {
        process.send({error: err});
        process.exit(0);
      })
    }
    default: {
      // NOOP
    }
  }
});

// Ensure we are running within 1s
setTimeout(() => {
    if (isRunning) {
        return;
    }

    process.send({
        error: 'Timed out waiting for config.'
    });
    process.exit(0);
}, 1000);
