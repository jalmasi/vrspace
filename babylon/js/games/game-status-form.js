import { Form } from '../ui/widget/form.js';
import { HorizontalSliderPanel } from "../ui/widget/slider-panel.js";

/**
 * Simple form that allows players to join or quit the game, and game owner to set the delay and start the game.
 * Also shows number of players currently in the game. 
 */
export class GameStatusForm extends Form {
  /**
   * @param {boolean} isMine Is this created by game owner?
   * @param {Function} callback executed on user action, passed true for start or false for quit  
   */
  constructor(isMine, callback) {
    super();
    this.text = "Players joined: ";
    this.delayText = "Count";
    this.delayMin = 10;
    this.delayMax = 30;
    this.callback = callback;
    this.isMine = isMine;
    this.gameStarted = false;
  }  
  
  init() {
    this.verticalPanel = true;
    this.createPanel();
    this.label = this.textBlock(this.text+"0");
    this.addControl(this.label);
    this.padding = 8;
    if (this.isMine && ! this.gameStarted) {
      this.sliderPanel = new HorizontalSliderPanel(.5,this.delayText,this.delayMin,this.delayMax,this.delayMin);
      this.sliderPanel.decimals = 0;
      this.addControl(this.sliderPanel.panel);
      let startButton = this.textButton("Start", () => this.callback(true));
      this.addControl(startButton);
    }
    let quitButton = this.textButton("Quit", () => this.callback(false), VRSPACEUI.contentBase+"/content/icons/close.png", "red");
    this.addControl(quitButton);

    VRSPACEUI.hud.addForm(this,512,256);
  }
  
  /** Set number of players */
  numberOfPlayers(num) {
    this.label.text = this.text+num;
  }
  /** Returns current delay value */
  getDelay() {
    if ( this.sliderPanel ) {
      return this.sliderPanel.slider.value;
    }
    return 0;
  }
}