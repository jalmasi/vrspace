/**
Script loader
 */
export class ScriptLoader {
  constructor() {
    // script url, loaded false/true
    this.scripts = {};
  }
  
  /** 
  Add a script to load path
  @param script url to load the script from
   */
  add(script) {
    if (typeof this.scripts[script] === 'undefined' ) {
      this.scripts[script] = false;
    }
    return this;
  }
  
  /**
  Load all scripts
  @param parallel default false - wait for each one to load before loading the next one
   */
  async load(parallel = false) {
    for ( var script in this.scripts ) {
      if ( ! this.scripts[script] ) {
        await this.loadScript(script, parallel);
        // debug to confirm scripts load only once
        //console.log("Loaded script "+script);
      }
    }
  }
  
  async loadScript(path, parallel) {
    return new Promise( (resolve, reject) => {
      const script = document.createElement('script');
      script.src = path;
      if (parallel) {
        document.body.appendChild(script);
        this.scripts[path] = true;
        resolve();
      } else {
        script.async = true;
        document.body.appendChild(script);
        script.onload = () => { 
          this.scripts[path] = true;
          resolve(); 
        }
      }
    });
  }
}

