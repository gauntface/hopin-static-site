import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

import {getMarkdownFiles} from '../build/models/markdown-files';

const projectsPath = path.join(__dirname, 'static', 'projects');

test('getMarkdownFiles() should throw for non-existant path', async (t) => {
	try {
		await getMarkdownFiles({
      contentPath: path.join(__dirname, 'static', 'non-existant'),
      markdownExtension: 'md',
    });
	} catch (err) {
		t.true(err.message.indexOf('Unable to access content directory:') === 0);
	}
});

test('getMarkdownFiles() should return no files for empty directory', async (t) => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'hopin-static-site-gen'))
  const files = await getMarkdownFiles({
    contentPath: tmpDir,
    markdownExtension: 'md',
  });
  t.deepEqual(files, []);
});

test('getMarkdownFiles() should return expected files valid directory', async (t) => {
  const contentPath = path.join(projectsPath, 'valid-project', 'content');
  const files = await getMarkdownFiles({
    contentPath: contentPath,
    markdownExtension: 'md',
  });
  t.deepEqual(files.sort(), [
    path.join(contentPath, 'iframe.md'),
    path.join(contentPath, 'index.md'),
    path.join(contentPath, 'page.md'),
    path.join(contentPath, 'directory', 'nested-page.md'),
    path.join(contentPath, 'directory', 'directory-2', 'nested-page-2.md'),
  ].sort());
});

test('getMarkdownFiles() should filter files based on config markdown extension', async (t) => {
  const contentPath = path.join(projectsPath, 'valid-project', 'content');
  const files = await getMarkdownFiles({
    contentPath: contentPath,
    markdownExtension: 'txt',
  });
  t.deepEqual(files.sort(), [
    path.join(contentPath, 'ignore.txt'),
  ].sort());
});