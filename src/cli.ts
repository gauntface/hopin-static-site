#!/usr/bin/env node

import * as meow from 'meow';
import {buildSiteFromFile} from './index';
import {logger} from './utils/logger';

const cli = meow(`
	Usage
	  $ hopin-static-site

	Options
	  --config The path to the configuration file to use
`, {
	flags: {
		config: {
			type: 'string'
		},
	}
});

async function run() {
	try {
		await buildSiteFromFile(cli.flags.config);
	} catch (err) {
		logger.error('❌ Unable to build site.');
		logger.error(err);
		process.exit(1);
	}
}

run();