import {fork, ChildProcess} from 'child_process';
import {logger} from '../utils/logger';

export type Message =  {
    result?: string
    error?: string
}

export class WorkerPool {
    private numOfWorkers: number
    private jobs: Array<string>
    private processCount: number

    constructor(numOfWorkers: number, jobs: Array<string>) {
        if (numOfWorkers <= 0) {
            throw new Error('You must provide a worker pool count of > 0');
        }
        
        this.numOfWorkers = numOfWorkers;
        this.jobs = jobs;
        this.processCount = 0;
    }

    async start(processName: string): Promise<{[key:string]: string|Error}> {
        const jobResults: {[key:string]: string|Error} = {};
        const errors: {[key:string]: Error} = {};
        
        const promises: Array<Promise<void>> = [];
        for (let i = 0; i < this.jobs.length; i++) {
            await this.getFreeSpot();
            this.processCount++;
            const job = this.jobs[i];
            promises.push(this.runWorker(processName, job, (msg: Message) => {
                if (msg.result) {
                    jobResults[job] = msg.result;
                } else if (msg.error) {
                    jobResults[job] = new Error(msg.error);
                } else {
                    logger.error(`Unkown worker pool message: ${msg}`)
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
            if (this.processCount < this.numOfWorkers) {
                wait = false;
                continue;
            }

            await new Promise((resolve) => {
                setTimeout(resolve, 400);
            });
        }
    }

    private async runWorker(processName: string, job: string, cb: (msg: Message) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const forkedProcess = fork(processName, [job]);
            forkedProcess.on('message', (msg: Message) => {
                cb(msg);
                resolve();
            });
        });
    }
}