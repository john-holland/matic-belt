#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AutomationRunner } from './runner';
import * as path from 'path';

const argv = yargs(hideBin(process.argv))
    .command('run <config>', 'Run an automation configuration', (yargs) => {
        return yargs
            .positional('config', {
                describe: 'Path to the YAML configuration file',
                type: 'string'
            })
            .option('variables', {
                alias: 'v',
                describe: 'Variables to pass to the automation',
                type: 'string'
            });
    })
    .help()
    .argv;

async function main() {
    try {
        const configPath = path.resolve(argv.config as string);
        const runner = new AutomationRunner(configPath);

        // Parse variables if provided
        if (argv.variables) {
            const variables = (argv.variables as string).split(',');
            for (const variable of variables) {
                const [key, value] = variable.split('=');
                if (key && value) {
                    runner.setVariable(key, value);
                }
            }
        }

        console.log('Starting automation...');
        await runner.run();
        console.log('Automation completed successfully');
    } catch (error) {
        console.error('Automation failed:', error);
        process.exit(1);
    }
}

main(); 