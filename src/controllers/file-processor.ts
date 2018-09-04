import {createTemplateFromFile} from '@hopin/render';
import {renderMarkdown} from '@hopin/markdown';

import { Message } from './worker-pool';
import { logger } from '../utils/logger';
import { Config } from '../models/config';

async function run(filePath: string, wrappingTmplPath: string, config: Config): Promise<Message> {
    // TODO: Check files exist first
    try {
        const template = await createTemplateFromFile(filePath);
        const wrappingTemplate = await createTemplateFromFile(wrappingTmplPath);

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
        });
        return {
            result: wrappedHTML,
        };
    } catch (err) {
        return {
            error: `Unable to read and parse: ${err.message}`,
        };
    }
}

export async function start(args: Array<string>, config: Config): Promise<Message> {
    if (args.length != 4) {
        logger.warn('Unexpected number of process args passed to file-processor: ', process.argv);
        return {
            error: `Unexpected number of process args: ${JSON.stringify(process.argv)}`,
        };
    }

    return run(args[2], args[3], config);
}

let isRunning = false;
process.on('message', (msg) => {
  switch(msg.name) {
    case 'run-with-config': {
      if (isRunning) {
          console.log('File processor already running, ignoring msg: ', msg);
          return;
      }

      isRunning = true;
      start(process.argv, msg.config).then((msg) => {
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
