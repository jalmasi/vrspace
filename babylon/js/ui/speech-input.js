/** experimental speech input, uses annyang library */
export class SpeechInput {
  constructor() {
    this.commands = {};
    this.noMatch = null;
    this.onlyLetters = true;
    this.lowercase = true;
  }
  addCommand(command, callback) {
    this.commands[command] = (text) => this.callback(text, callback);   
  }
  callback(text, callback) {
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
        annyang.addCallback('resultNoMatch', (phrases) => {
          this.noMatch(phrases);
        });
      }
      // Start listening. You can call this here, or attach this call to an event, button, etc.
      annyang.start();
    } else {
      console.log("Speech recognition unavailable");
    }
  }
  stop() {
    if ( annyang ) {
      annyang.stop();
    }
  }
  dispose() {
    if (annyang) {
      // CHECKME what if we have multiple components using different voice inputs?
      annyang.stop();
      if ( this.commands ) {
        annyang.removeCommands(this.commands);
      }
      if ( this.noMatch ) {
        annyang.removeCallback('resultNoMatch', this.noMatch);
      }
    }
  }
}