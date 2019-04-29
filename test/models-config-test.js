import test from 'ava';
import * as path from 'path';

import {getConfig, validateConfig} from '../build/models/config';

const configsPath = path.join(__dirname, 'static', 'configs');

test('getConfig() should throw for non-existant file', async (t) => {
	try {
		await getConfig('.', 'non-existant-file');
	} catch (err) {
		t.deepEqual(err.message, 'Unable to access config path: non-existant-file.');
	}
});

test('getConfig() should throw for bad json file', async (t) => {
	try {
		await getConfig(configsPath, path.join(configsPath, 'invalid-json.json'));
	} catch (err) {
		t.true(err.message.indexOf('Unable to parse the config file:') === 0);
	}
});

test('getConfig() should throw for an array json file', async (t) => {
	try {
		const relPath = path.join(configsPath, 'array.json');
		const config = await getConfig(configsPath, relPath);
		await validateConfig(config, relPath);
	} catch (err) {
		t.deepEqual(err.message, 'Invalid Config, expected an object. Parsed config is: []');
	}
});

test('getConfig() should handle a null config path and return a valid config object using default values', async (t) => {
	const buildDir = path.join(path.sep, 'example')
	let config = await getConfig(buildDir);
	config = await validateConfig(config, buildDir);
	t.deepEqual(config, {
		contentPath: path.join(buildDir, 'content'),
		outputPath: path.join(buildDir, 'build'),
		staticPath: '/example/static/',
		themePath: path.join(__dirname, '..', 'build', 'themes', 'default'),
		navigationFile: path.join(buildDir, 'content', 'navigation.json'),
		markdownExtension: 'md',
		workPoolSize: 10,
		origin: '',
		tokenAssets: {},
	});
});

test('getConfig() should parse, validate and return a valid config object using default values for empty config file', async (t) => {
	const buildDir = path.join(path.sep, 'example')
	let config = await getConfig(buildDir, path.join(configsPath, 'valid-empty-config.json'));
	config = await validateConfig(config, buildDir);
	t.deepEqual(config, {
		contentPath: path.join(buildDir, 'content', path.sep),
		outputPath: path.join(buildDir, 'build', path.sep),
		staticPath: '/example/static/',
		themePath: path.join(__dirname, '..', 'build', 'themes', 'default'),
		navigationFile: path.join(buildDir, 'content', 'navigation.json'),
		markdownExtension: 'md',
		workPoolSize: 10,
		origin: '',
		tokenAssets: {},
	});
});

test('getConfig() should parse, validate and return a valid config object using custom relative values', async (t) => {
	const buildDir = path.join(path.sep, 'example')
	let config = await getConfig(buildDir, path.join(configsPath, 'valid-relative-config.json'));
	config = await validateConfig(config, buildDir);
	t.deepEqual(config, {
		contentPath: path.join(buildDir, 'custom-content-path'),
		outputPath: path.join(buildDir, 'custom-output-path'),
		themePath: path.join(buildDir, 'custom-theme'),
		staticPath: './custom-static/',
		navigationFile: path.join(buildDir, 'custom-nav-path', 'nav.json'),
		markdownExtension: 'markdown',
		workPoolSize: 20,
		origin: "https://example.com",
		tokenAssets: {
			h1: {
				styles: {
					inline: [path.join(buildDir, '..', 'projects', 'valid-project', 'theme', 'static', 'styles', 'inline.css')],
					sync: ['/styles/sync.css'],
					async: ['/styles/async.css'],
				}
			},
		},
	});
});