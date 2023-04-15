/** experimental speech input, uses annyang library */
export class SpeechInput {
  static instances = [];
  constructor() {
    this.commands = {};
    this.noMatch = null;
    this.onlyLetters = true;
    this.lowercase = true;
    this.constructor.instances.push(this);
  }
  addCommand(command, callback) {
    this.commands[command] = (text) => this.callback(text, callback);   
  }
  callback(text, callback) {
    //console.log("Executing "+text, callback);
    if ( text ) {
      if (this.lowercase) {
        text = text.toLowerCase();
      }
      if (this.onlyLetters) {
        text = text.replace(/[^a-zA-Z ]/g, "");
      }
    }
    callback(text);
  }
  addNoMatch(callback) {
    this.noMatch = callback;
  }
  start() {
    if (annyang) {
      // Add our commands to annyang
      if ( this.commands ) {
        annyang.addCommands(this.commands);
      }
      if ( this.noMatch ) {
        annyang.addCallback('resultNoMatch', this.noMatch);
      }
      // Start listening. You can call this here, or attach this call to an event, button, etc.
      annyang.start();
      console.log("Speech recognition started: "+annyang.isListening(), this.commands);
    } else {
      console.log("Speech recognition unavailable");
    }
  }
  stop() {
    if ( annyang ) {
      if ( this.constructor.instances.length > 0 ) {
        console.log("speech recognition paused");
        annyang.pause();
      } else {
        console.log("speech recognition stopped");
        annyang.abort();
      }
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
        // this doesn't work, old commands remain:
        // apparently annyang expects array of phrases as argument
        //annyang.removeCommands(this.commands);
        annyang.removeCommands();
      }
      if ( this.noMatch ) {
        annyang.removeCallback('resultNoMatch', this.noMatch);
      }
    }
    this.commands = null;
  }
}