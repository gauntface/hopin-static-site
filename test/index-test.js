import * as path from 'path';
import * as fs from 'fs-extra';
import test from 'ava';

import {buildSite} from '../build/index';

const projectPath = path.join(__dirname, 'static', 'projects', 'valid-project');
const projectBuildPath = path.join(projectPath, 'build');

test('buildSite() should successfully build a site', async (t) => {
	await fs.remove(projectBuildPath);
	await buildSite(projectPath);

	const buildFiles = await fs.readdir(projectBuildPath);
	
	t.deepEqual(buildFiles, ['directory', 'index.html', 'page.html', 'scripts', 'styles']);

	t.pass();
});