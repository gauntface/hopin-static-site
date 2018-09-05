import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

import {getMarkdownFiles} from '../build/models/markdown-files';
import { start } from '../build/controllers/file-processor';

const projectFilePath = path.join(__dirname, 'static', 'projects', 'valid-project');
const contentFilesPath = path.join(projectFilePath, 'content');

test('file-processor.start() should return error for too few values', async (t) => {
    const msg = await start(['', '']);
    t.deepEqual(Object.keys(msg), ['error'])
    t.true(msg.error.indexOf('Unexpected number of process args: ') === 0);
});

test('file-processor.start() should return error message for non-existant file', async (t) => {
    const msg = await start(['', '', path.join(contentFilesPath, 'non-existant-file')]);
    t.deepEqual(Object.keys(msg), ['error'])
    t.true(msg.error.indexOf('Unable to read and parse: ') === 0);
});

test('file-processor.start() should render file contents for valid file', async (t) => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-processor-test'));
    const inputPath = path.join(contentFilesPath, 'index.md');
    const msg = await start(['', '', inputPath], {
        contentPath: contentFilesPath,
        outputPath: tmpDir, 
        defaultHTMLTmpl: path.join(projectFilePath, 'templates', 'default.tmpl'),
        tokenAssets: {
            h1: {
                styles: {
                    inline: '.h1-inline{}',
                    sync: '/styles/h1-sync.css',
                    async: '/styles/h1-async.css',
                },
            }
        },
    });
    t.falsy(msg.error);
    t.deepEqual(Object.keys(msg), ['result'])
    t.deepEqual(msg.result, {
        inputPath: inputPath,
        outputPath: path.join(tmpDir, 'index.md'),
    });
    const buffer = await fs.readFile(msg.result.outputPath);
    t.deepEqual(buffer.toString(), `<html class="default">
<style>.inline{}</style>
<style>.index-inline{}</style>
<style>.h1-inline{}</style>
<link rel="stylesheet" type="text/css" href="/styles/sync.css" />
<link rel="stylesheet" type="text/css" href="/styles/index-sync.css" />
<link rel="stylesheet" type="text/css" href="/styles/h1-sync.css" />
<h1>HTML</h1>

<h1 id="md">MD</h1>
<script>console.log('inline');</script>
<script>console.log('index-inline');</script>
<script src="/scripts/sync.js"></script>
<script src="/scripts/index-sync.js"></script>
<script src="/scripts/async.js" async defer></script>
<script src="/scripts/index-async.js" async defer></script>
<script>
window.addEventListener('load', function() {
var __hopin_async_styles = ['/styles/async.css','/styles/index-async.css','/styles/h1-async.css'];
for(var i = 0; i < __hopin_async_styles.length; i++) {
var lT = document.createElement('link');
lT.rel = 'stylesheet';
lT.href = __hopin_async_styles[i];
document.head.appendChild(lT);
}
});
</script>
</html>`);
});