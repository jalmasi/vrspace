/** 
 * experimental speech input, uses annyang library 
 * */
export class SpeechInput {
  static instances = [];
  static enabled = true;
  static active = false;
  static android = (navigator.userAgent.toLowerCase().indexOf('android') > -1);
  static touchListener = null;
  constructor() {
    this.commands = {};
    this.noMatch = null;
    this.onlyLetters = true;
    this.lowercase = true;
    this.removePeriod = true;
    this.spoke = false;
    this.constructor.instances.push(this);
    // this should go to static block but then jsdoc fails:
    if ( ! this.constructor.touchListener ) {
      this.constructor.touchListener = (e) => {
        this.continue();
      }
      document.addEventListener('touchstart', this.constructor.touchListener);
    }
  }
  continue() {
    if ( this.constructor.active && this.constructor.android) {
      //console.log("Android speech recognition (re) starting");
      annyang.start({autoRestart:false, continuous:true});
    }
  }
  addCommand(command, callback) {
    this.commands[command] = (text) => this.callback(command, text, callback);
    // microsoft apparently attempts to add punctuation
    this.commands[command+'.'] = (text) => this.callback(command, text, callback);
  }
  callback(command, text, callback) {
    //console.log("Executing "+text, callback);
    if ( text ) {
      if (this.lowercase) {
        text = text.toLowerCase();
      }
      if (this.onlyLetters) {
        text = text.replace(/[^a-zA-Z ]/g, "");
      }
      if (this.removePeriod && text.endsWith(".")) {
        text = text.substring(0,text.length-1);
      }
    }
    this.spoke=true;
    //console.log("Spoke:"+ command+" "+text);
    callback(text);
  }
  callNoMatch(phrases) {
    this.spoke=true;
    //console.log("Spoke:"+ phrases);
    if ( this.noMatch ) {
      this.noMatch(phrases);
    }
  }
  addNoMatch(callback) {
    this.noMatch = callback;
  }
  endCallback() {
    //console.log("Speech recognition ended, spoke: "+this.spoke+" active:"+this.constructor.active);
    if ( this.spoke ) {
      this.spoke = false;
      this.continue();
    } else {
      // silence/stop
      //console.log("Speech recognition ended in silence");
    }
  }
  start() {
    if (this.constructor.enabled && annyang) {
      let index = this.constructor.instances.indexOf(this);
      if ( index < 0 ) {
        // this instance might have been disposed, kept elsewhere, and restarted
        this.constructor.instances.push(this);
      }
      // Add our commands to annyang
      if ( this.commands ) {
        annyang.addCommands(this.commands);
      }
      if ( this.noMatch ) {
        annyang.addCallback('resultNoMatch', (phrases)=>this.callNoMatch(phrases));
      }
      if ( this.constructor.android && ! this.end ) {
        this.end = () => this.endCallback();
        annyang.addCallback('end', this.end );
      }
      // Start listening. You can call this here, or attach this call to an event, button, etc.
      if ( this.constructor.android ) {
        //console.log("Speech recognition will start on touch, to prevent annoying beeping on android");
      } else {
        annyang.start();
        //console.log("Speech recognition started: "+annyang.isListening(), this.commands);
      }
      this.constructor.active = true;
    } else {
      console.log("Speech recognition unavailable");
    }
  }
  stop() {
    if ( annyang ) {
      //console.log("speech recognition stopped");
      annyang.abort();
      this.constructor.active = false;
    }
  }
  dispose() {
    let index = this.constructor.instances.indexOf(this);
    if ( index >= 0 ) {
      // index could be -1 if dispose is called more than once
      this.constructor.instances.splice(index,1);
      if ( this.constructor.instances.length > 0 ) {
        this.constructor.instances[this.constructor.instances.length -1].start();
      }
    }
    if (annyang) {
      this.stop();
      if ( this.commands ) {
        // annyang expects array of phrases as argument
        annyang.removeCommands(Object.keys(this.commands));
        //console.log(' disabled commands:', Object.keys(this.commands));
      }
      if ( this.noMatch ) {
        annyang.removeCallback('resultNoMatch', this.noMatch);
      }
      if ( this.end ) {
        annyang.removeCallback('end', this.end);
        delete this.end;
      }
    }
  }
}