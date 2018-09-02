import {createTemplateFromFile} from '@hopin/render';
import {renderMarkdown} from '@hopin/markdown';

import { Message } from './worker-pool';
import { logger } from '../utils/logger';

async function run(filePath: string, wrappingTmplPath: string): Promise<Message> {
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

export async function start(args: Array<string>): Promise<Message> {
    if (args.length != 4) {
        logger.warn('Unexpected number of process args passed to file-processor: ', process.argv);
        return {
            error: `Unexpected number of process args: ${JSON.stringify(process.argv)}`,
        };
    } else {
        return run(args[2], args[3]);
    }
}

start(process.argv).then((msg) => process.send(msg))
