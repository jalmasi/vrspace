module.exports = {
  entry: './index-min.js',
  //entry: './index-full.js',
  //entry: './index-cdn.js',
  mode: 'production',
  experiments: {
    outputModule: true,
  },  
  output: {
    filename: 'vrspace-babylon.js',
    library: {
      type: 'module'
    }
  },
};