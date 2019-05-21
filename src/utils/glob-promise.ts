import * as origGlob from 'glob';

// tslint:disable-next-line:no-any
export function glob(pattern: string, opts: any): Promise<string[]> {
  return new Promise((resolve, reject) => {
    origGlob(pattern, opts, (err, files) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(files);
    });
  });
}