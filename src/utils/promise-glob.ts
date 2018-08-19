import * as origGlob from 'glob';

export function glob(pattern: string, opts: any): Promise<Array<string>> {
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