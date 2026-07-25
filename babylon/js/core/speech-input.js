import { MediaStreams } from './media-streams.js';
/** 
 * Experimental speech input, uses annyang library.
 * Seems to work well on chrome and edge on PC.
 * Kind of works on android chrome, with limitations, but WebRTC disables it for good, thus, disabled if MediaStreams are enabled.  
 * */
export class SpeechInput {
  static instances = [];
  static enabled = true;
  static active = false;
  static android = (typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().indexOf('android') > -1);
  static touchListener = null;
  constructor() {
    this.commands = {};
    this.callbacks = {};
    this.noMatch = null;
    this.onlyLetters = false;
    this.lowercase = true;
    this.removePeriod = true;
    /** android hack: numbers less than 10 are recognized as words, so, convert to numbers */
    this.convertNumbers = true;
    this.numberMap = {
      "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
      "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9"
    };
    this.numberWords = {
      "0": "zero", "1": "one", "2": "two", "3": "three", "4": "four",
      "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine"
    };
    this.spoke = false;
    this.publishingAudio = false;
    this.constructor.instances.push(this);
    // this should go to static block but then jsdoc fails:
    if (!this.constructor.touchListener) {
      this.constructor.touchListener = (e) => {
        this.continue();
      }
      document.addEventListener('touchstart', this.constructor.touchListener);
    }
  }
  continue() {
    if (this.constructor.active && this.constructor.android && !MediaStreams.instance) {
    //if (this.constructor.active && this.constructor.android) {
      //console.log("Android speech recognition (re) starting");
      if (MediaStreams.instance) {
        this.publishingAudio = MediaStreams.instance.publishingAudio;
        MediaStreams.instance.publishAudio(false);
      }
      annyang.start({ autoRestart: false, continuous: true });
    }
  }
  /**
   * Add a voice command.
   * @param {string} command
   * @param {*} callback function to call on command
   * @param {string} [arg] arbitrary argument to the command, passed to callback
   */
  addCommand(command, callback, arg) {
    command = command.trim();
    if (arg) {
      var text = " " + arg.trim();
    } else {
      var text = "";
    }
    if (this.callbacks[command]) {
      // adding another callback to existing command
      //console.log("Callback added to " + command+" "+arg);
    } else {
      this.callbacks[command] = [];
    }
    this.callbacks[command].push((text) => callback(text));

    this.commands[command + text] = (text) => this.callback(command, text);
    // microsoft apparently attempts to add punctuation
    this.commands[command + '.' + text] = (text) => this.callback(command, text);
    this.commands[command + ',' + text] = (text) => this.callback(command, text);
    if (this.convertNumbers) {
      let words = command.split(' ');
      let addCommand = false;
      for (let i = 0;i < words.length;i++) {
        if (this.numberWords[words[i]]) {
          words[i] = this.numberWords[words[i]];
          addCommand = true;
        }
      }
      if (addCommand) {
        this.commands[words.join(' ') + text] = (text) => this.callback(command, text);
      }
    }
  }

  /**
   * Called after speech, to process text, according to lowercase, onlyLetters, removePeriod, convertNumbers flags, 
   * and then call user provided callback functions.
   */
  callback(command, text) {
    console.log("Executing " + command + " " + text);
    if (text) {
      if (this.lowercase) {
        text = text.toLowerCase();
      }
      if (this.onlyLetters) {
        text = text.replace(/[^a-zA-Z ]/g, "");
      }
      if (this.removePeriod && text.endsWith(".")) {
        text = text.substring(0, text.length - 1);
      }
      if (this.convertNumbers) {
        let number = this.numberMap[text];
        if (number) {
          text = number;
        }
      }
    }
    this.spoke = true;
    console.log("Spoke: " + command + " " + text, this.callbacks[command]);
    this.callbacks[command].forEach(callback => {
      try {
        callback(text);
      } catch (error) {
        console.error(error);
      }
    });
  }

  callNoMatch(phrases) {
    this.spoke = true;
    //console.log("Spoke:"+ phrases);
    if (this.noMatch) {
      this.noMatch(phrases);
    }
  }
  addNoMatch(callback) {
    this.noMatch = callback;
  }
  endCallback() {
    //console.log("Speech recognition ended, spoke: "+this.spoke+" active:"+this.constructor.active);
    if (this.spoke) {
      this.spoke = false;
      this.continue();
    } else {
      // silence/stop
      //console.log("Speech recognition ended in silence");
      if (MediaStreams.instance) {
        MediaStreams.instance.publishAudio(this.publishingAudio);
      }
    }
  }

  static available() {
    return typeof (annyang) != 'undefined' && annyang;
  }

  static isEnabled() {
    return SpeechInput.enabled && SpeechInput.available();
  }

  start() {
    if (SpeechInput.enabled && SpeechInput.available()) {
      let index = this.constructor.instances.indexOf(this);
      if (index < 0) {
        // this instance might have been disposed, kept elsewhere, and restarted
        this.constructor.instances.push(this);
      }
      // Add our commands to annyang
      if (this.commands) {
        annyang.addCommands(this.commands);
        //console.log(this.commands);
      }
      if (this.noMatch) {
        this.noMatchCallback = (phrases) => this.callNoMatch(phrases);
        annyang.addCallback('resultNoMatch', this.noMatchCallback);
      }
      if (this.constructor.android && !this.end) {
        this.end = () => this.endCallback();
        annyang.addCallback('end', this.end);
      }
      // Start listening. You can call this here, or attach this call to an event, button, etc.
      if (this.constructor.android) {
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
    if (annyang) {
      //console.log("speech recognition stopped");
      annyang.abort();
      this.constructor.active = false;
    }
  }
  dispose() {
    let index = this.constructor.instances.indexOf(this);
    if (index >= 0) {
      // index could be -1 if dispose is called more than once
      this.constructor.instances.splice(index, 1);
      if (this.constructor.instances.length > 0) {
        this.constructor.instances[this.constructor.instances.length - 1].start();
      }
    }
    if (typeof annyang !== 'undefined' && annyang) {
      this.stop();
      if (this.commands) {
        // annyang expects array of phrases as argument
        annyang.removeCommands(Object.keys(this.commands));
        //console.log(' disabled commands:', Object.keys(this.commands));
        this.callbacks = null;
      }
      if (this.noMatch) {
        annyang.removeCallback('resultNoMatch', this.noMatchCallback);
      }
      if (this.end) {
        annyang.removeCallback('end', this.end);
        delete this.end;
      }
    }
  }
}