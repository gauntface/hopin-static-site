import {fork, ChildProcess} from 'child_process';

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

    async start(processName: string): Promise<{[key:string]: string}> {
        const jobResults: {[key:string]: string} = {};
        
        const promises: Array<Promise<void>> = [];
        for (let i = 0; i < this.jobs.length; i++) {
            await this.getFreeSpot();
            this.processCount++;
            const job = this.jobs[i];
            promises.push(this.runWorker(processName, job, (result) => {
                jobResults[job] = result;
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

    private async runWorker(processName: string, job: string, cb: (result: string) => void): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const forkedProcess = fork(processName, [job]);
            forkedProcess.on('message', (result: string) => {
                cb(result);
                resolve();
            });
        });
    }
}