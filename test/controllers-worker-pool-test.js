import test from 'ava';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as os from 'os';

import {getMarkdownFiles} from '../build/models/markdown-files';
import { WorkerPool } from '../build/controllers/worker-pool';

const processorsPath = path.join(__dirname, 'static', 'processors');

test('new WorkerPool() should throw for 0 number of workers', async (t) => {
	try {
		new WorkerPool({workPoolSize: 0}, {}, ['example']);
	} catch (err) {
		t.true(err.message === 'You must provide a worker pool count of > 0');
	}
});

test('new WorkerPool() should process a single file', async (t) => {
    const pool = new WorkerPool({workPoolSize: 1}, {}, ['example']);
    const results = await pool.start(path.join(processorsPath, 'basic.js'));
    t.deepEqual(results, {
        'example': 'basic-example',
    });
});

test('new WorkerPool() should process multiple files on single pool', async (t) => {
    const pool = new WorkerPool({workPoolSize: 1}, {}, ['example-1', 'example-2']);
    const results = await pool.start(path.join(processorsPath, 'second-delay.js'));
    t.deepEqual(results, {
        'example-1': 'second-delay-example-1',
        'example-2': 'second-delay-example-2',
    });
});

test('new WorkerPool() should handle errors', async (t) => {
    const pool = new WorkerPool({workPoolSize: 1}, {}, ['example-1']);
    const results = await pool.start(path.join(processorsPath, 'error.js'));
    t.deepEqual(results, {
        'example-1': new Error('Example error'),
    });
});

test('new WorkerPool() should handle unknown value', async (t) => {
    const pool = new WorkerPool({workPoolSize: 1}, {}, ['example-1']);
    const results = await pool.start(path.join(processorsPath, 'unknown.js'));
    t.deepEqual(results, {});
});