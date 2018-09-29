const path = require('path');
const fs = require('fs-extra');
const gulp = require('gulp');
const {setConfig} = require('@hopin/wbt-config');
const tsNode = require('@hopin/wbt-ts-node'); 

const src = path.join(__dirname, 'src');
const dst = path.join(__dirname, 'build');

setConfig(src, dst);

gulp.task('clean',
  gulp.parallel(
    () => fs.remove(dst)
  )
)

gulp.task('build',
  gulp.series(
    'clean',
    () => {
      // TODO: Move to web build tool
      return fs.copy(path.join(__dirname, 'src', 'themes'), path.join(__dirname, 'build', 'themes'));
    },
    tsNode.gulpBuild({
      flags: ['--skipLibCheck'],
    })
  )
);