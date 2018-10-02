import {createTemplateFromFile} from '@hopin/render';
import {renderMarkdown} from '@hopin/markdown';
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '@hopin/logger';

import { Message, RUN_WITH_DETAILS_MSG } from './worker-pool';
import { Config } from '../models/config';
import {NavNode} from '../models/nav-tree';

async function run(inputPath: string, config: Config, navigation: Array<NavNode>): Promise<Message> {
    // TODO: Check files exist first
    try {
        const template = await createTemplateFromFile(inputPath);

        // Render the original page and run it through the markdown parser
        const plainPage = await template.render({
            topLevel: {
                navigation,
            }
        });
        const markdownRender = await renderMarkdown(plainPage);

        const themeFile = path.join(config.themePath, 'default.tmpl');
        const wrappingTemplate = await createTemplateFromFile(themeFile);

        // Wrapping template will be the template that displays the styles etc
        // so copy template styles and scripts over
        wrappingTemplate.styles.add(template.styles);
        wrappingTemplate.scripts.add(template.scripts);

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
        }

        // Finally render the content in the wrapping template
        const wrappedHTML = await wrappingTemplate.render({
            topLevel: {
                content: markdownRender.html,
                navigation,
                page: template.yaml
            },
        });

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

export async function start(args: Array<string>, config: Config, navigation: Array<NavNode> = []): Promise<Message> {
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
          console.log('File processor already running, ignoring msg: ', msg);
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
