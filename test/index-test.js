import * as path from 'path';
import test from 'ava';

import {buildSite} from '../build/index';

const projectPath = path.join(__dirname, 'static', 'projects', 'valid-project');

test('buildSite() should parse, validate and return a valid config object using custom relative values', async (t) => {
	await buildSite(path.join(projectPath));
	t.pass();
});