import {fork, ChildProcess} from 'child_process';

import { logger } from '../utils/logger';
import { Config } from '../models/config';
import { getNavTree,NavNode } from '../models/nav-tree';

export const RUN_WITH_DETAILS_MSG = 'run-with-details';

type FileProcessorResult = {
    inputPath: string
    outputPath: string
};

export type Message =  {
    result?: FileProcessorResult
    error?: string
};

export class WorkerPool {
    private config: Config;
    private jobs: string[];
    private processCount: number;

    constructor(config: Config, jobs: string[]) {
        if (config.workPoolSize <= 0) {
            throw new Error('You must provide a worker pool count of > 0');
        }

        this.config = config;
        this.jobs = jobs;
        this.processCount = 0;
    }

    async start(processName: string): Promise<{[key:string]: FileProcessorResult|Error}> {
        const navigation = await getNavTree(this.config);

        const jobResults: {[key:string]: FileProcessorResult|Error} = {};

        const promises: Array<Promise<void>> = [];
        for (let i = 0; i < this.jobs.length; i++) {
            await this.getFreeSpot();
            this.processCount++;
            const job = this.jobs[i];
            promises.push(this.runWorker(processName, job, navigation, (msg: Message) => {
                if (msg.result) {
                    jobResults[job] = msg.result;
                } else if (msg.error) {
                    jobResults[job] = new Error(msg.error);
                } else {
                    logger.error(`Unkown worker pool message: ${msg}`);
                }

                this.processCount--;
            }));
        }

        await Promise.all(promises);

        return jobResults;
    }

    private async getFreeSpot(): Promise<void> {
        let wait = true;
        while(wait) {
            if (this.processCount < this.config.workPoolSize) {
                wait = false;
                continue;
            }

            await new Promise((resolve) => {
                setTimeout(resolve, 400);
            });
        }
    }

    private async runWorker(processName: string, job: string, navigation: {[id: string]: NavNode[]}, cb: (msg: Message) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const forkedProcess = fork(processName, [job]);
            forkedProcess.send({
                name: RUN_WITH_DETAILS_MSG,
                config: this.config,
                navigation,
            });
            forkedProcess.on('message', (msg: Message) => {
                cb(msg);
                resolve();
            });
        });
    }
}