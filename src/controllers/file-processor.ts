import {createTemplateFromFile} from '@hopin/render';
import {renderMarkdown} from '@hopin/markdown';
import * as fs from 'fs-extra';
import * as path from 'path';
import { logger } from '@hopin/logger';

import { Message, RUN_WITH_DETAILS_MSG } from './worker-pool';
import { Config } from '../models/config';

async function run(inputPath: string, config: Config): Promise<Message> {
    // TODO: Check files exist first
    try {
        const template = await createTemplateFromFile(inputPath);
        // TODO: Make this configurable in markdown file itself
        const wrappingTemplate = await createTemplateFromFile(path.join(config.themePath, 'default.tmpl'));

        // Wrapping template will be the template that displays the styles etc
        // so copy template styles and scripts over
        wrappingTemplate.styles.add(template.styles);
        wrappingTemplate.scripts.add(template.scripts);

        // Render the original page and run it through the markdown parser
        const plainPage = await template.render();
        const markdownRender = await renderMarkdown(plainPage);

        // TODO Add the markdown token styles to the wrapping template
        for (const t of markdownRender.tokens) {
          const tokenAssets = config.tokenAssets[t];
          if (!tokenAssets) {
            continue;
          }

          if (tokenAssets.styles) {
            const styles = tokenAssets.styles;
            if (styles.inline) {
              wrappingTemplate.styles.inline.add(styles.inline, styles.inline);
            }
            if (styles.sync) {
              wrappingTemplate.styles.sync.add(styles.sync, styles.sync);
            }
            if (styles.async) {
              wrappingTemplate.styles.async.add(styles.async, styles.async);
            }
          }
        }

        // Finally render the content in the wrapping template
        const wrappedHTML = await wrappingTemplate.render({
            content: markdownRender.html,
            yaml: template.yaml,
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

export async function start(args: Array<string>, config: Config, navTree: {}): Promise<Message> {
    if (args.length != 3) {
        logger.warn('Unexpected number of process args passed to file-processor: ', process.argv);
        return {
            error: `Unexpected number of process args: ${JSON.stringify(process.argv)}`,
        };
    }

    return run(args[2], config);
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
      start(process.argv, msg.config, msg.navTree).then((msg) => {
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
