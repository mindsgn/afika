module.exports = {
  // type check typrscript  files
  '**/*.(ts|tsx)': () => 'yarn tsc --noEmit',

  //lint & prettier TS and JS files
  '**/*.(ts|tsx|js)': filenames => [
    `yarn eslint ${filenames.join(' ')}`,
    `yarn prettier --write ${filename.join(' ')}`
  ],
  '**/*.(md|json)': filenames => `yarn prettier --write ${filenames.join(' ')}`
};
