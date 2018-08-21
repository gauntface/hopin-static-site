import * as fs from 'fs-extra';

import { Message } from './worker-pool';
import { logger } from '../utils/logger';

async function run(filePath: string): Promise<Message> {
    try {
        const fileBuffer = await fs.readFile(filePath);
        const fileContents = fileBuffer.toString();

        // Parse yaml

        // Process markdown

        // Process template

        return {
            result: fileContents,
        };
    } catch (err) {
        return {
            error: `Unable to read and parse: ${err.message}`,
        };
    }
}

export async function start(args: Array<string>): Promise<Message> {
    if (args.length != 3) {
        logger.warn('Unexpected number of process args passed to file-processor: ', process.argv);
        return {
            error: `Unexpected number of process args: ${JSON.stringify(process.argv)}`,
        };
    } else {
        return run(args[2]);
    }
}

start(process.argv).then((msg) => process.send(msg))
