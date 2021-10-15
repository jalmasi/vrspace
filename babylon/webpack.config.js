module.exports = {
  entry: './js/vrspace-min.js',
  //entry: './vrspace-full.js',
  //entry: './vrspace-cdn.js',
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