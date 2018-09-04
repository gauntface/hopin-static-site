import test from 'ava';
import * as path from 'path';

import {getConfig} from '../build/models/config';

const configsPath = path.join(__dirname, 'static', 'configs');

test('getConfig() should throw for non-existant file', async (t) => {
	try {
		await getConfig('non-existant-file');
	} catch (err) {
		t.deepEqual(err.message, 'Unable to access config path: non-existant-file.');
	}
});

test('getConfig() should throw for bad json file', async (t) => {
	try {
		await getConfig(path.join(configsPath, 'invalid-json.json'));
	} catch (err) {
		t.true(err.message.indexOf('Unable to parse the config file:') === 0);
	}
});

test('getConfig() should throw for an array json file', async (t) => {
	try {
		await getConfig(path.join(configsPath, 'array.json'));
	} catch (err) {
		t.deepEqual(err.message, 'Invalid Config, expected an object. Parsed config is: []');
	}
});

test('getConfig() should handle a null config path and return a valid config object using default values', async (t) => {
	const config = await getConfig();
	t.deepEqual(config, {
		contentPath: path.join(process.cwd(), 'content', path.sep),
		outputPath: path.join(process.cwd(), 'build', path.sep),
		markdownExtension: 'md',
		workPoolSize: 10,
		tokenAssets: {},
	});
});

test('getConfig() should parse, validate and return a valid config object using default values', async (t) => {
	const config = await getConfig(path.join(configsPath, 'valid-empty-config.json'));
	t.deepEqual(config, {
		contentPath: path.join(process.cwd(), 'content', path.sep),
		outputPath: path.join(process.cwd(), 'build', path.sep),
		markdownExtension: 'md',
		workPoolSize: 10,
		tokenAssets: {},
	});
});

test('getConfig() should parse, validate and return a valid config object using custom relative values', async (t) => {
	const config = await getConfig(path.join(configsPath, 'valid-relative-config.json'));
	t.deepEqual(config, {
		contentPath: path.join(configsPath, 'custom-content-path', path.sep),
		outputPath: path.join(configsPath, 'custom-output-path', path.sep),
		markdownExtension: 'markdown',
		workPoolSize: 20,
		tokenAssets: {
			h1: {
				styles: {
					inline: '.inline{}',
					sync: '/styles/sync.css',
					async: '/styles/async.css',
				}
			},
		},
	});
});