import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

import {getMarkdownFiles} from '../build/models/markdown-files';
import { start } from '../build/controllers/file-processor';

const projectFilesPath = path.join(__dirname, 'static', 'project-files');

test('file-processor.start() should return error for too few values', async (t) => {
    const msg = await start(['', '']);
    t.deepEqual(Object.keys(msg), ['error'])
    t.true(msg.error.indexOf('Unexpected number of process args: ') === 0);
});

test('file-processor.start() should return error message for non-existant file', async (t) => {
    const msg = await start(['', '', path.join(projectFilesPath, 'non-existant-file')]);
    t.deepEqual(Object.keys(msg), ['error'])
    t.true(msg.error.indexOf('Unable to read and parse: ') === 0);
});

test('file-processor.start() should file contents for valid file', async (t) => {
    const msg = await start(['', '', path.join(projectFilesPath, 'valid-file.md')]);
    t.deepEqual(Object.keys(msg), ['result'])
    t.deepEqual(msg.result, 'hello world');
});