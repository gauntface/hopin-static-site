#!/usr/bin/env node

import * as meow from 'meow';
import {buildSite} from './index';

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

buildSite(cli.flags.config);