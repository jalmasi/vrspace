import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { VRSPACE } from '../client/vrspace.js';

export class GamepadHelper {
  /**
   * @type {GamepadHelper}
   */
  static instance = null;
  static getInstance(scene) {
    if (!GamepadHelper.instance) {
      GamepadHelper.instance = new GamepadHelper(scene);
    }
    return GamepadHelper.instance;
  }

  constructor(scene) {
    this.scene = scene;
    this.gamepadState = {};
    this.connectListeners = [];
    this.axisListeners = [];
    this.trackGamepad();
  }

  /**
   * Main point of gamepad support. Once the browser emits gamepadconnected event,
   * installs tracker function into main rendering loop, to track states that
   * rotate the camera, teleport, and fire gamepad button events.
   */
  trackGamepad() {
    // https://forum.babylonjs.com/t/no-gamepad-support-in-webxrcontroller/15147/2
    let gamepadTracker = () => {
      const gamepad = navigator.getGamepads()[this.gamepadState.index];
      for (let i = 0; i < gamepad.buttons.length; i++) {
        let buttonState = gamepad.buttons[i].value > 0 || gamepad.buttons[i].pressed || gamepad.buttons[i].touched;
        if (this.gamepadState.buttons[i] != buttonState) {
          this.gamepadState.buttons[i] = buttonState;
          this.gamepadButton(i, buttonState);
        }
      }
      let treshold = 0.5;
      for (let i = 0; i < gamepad.axes.length; i++) {
        if (this.gamepadState.axes[i] != gamepad.axes[i]) {
          let val = gamepad.axes[i];
          this.gamepadState.axes[i] = val;
          //console.log(i+" "+this.gamepadState.axes[i]);
          if (i == 0 || i == 2) {
            // left-right
            if (val < -treshold) {
              if (!this.gamepadState.left) {
                this.gamepadState.left = true;
                this.notifyListeners(this.axisListeners, 'left');
              }
            } else if (val > treshold) {
              if (!this.gamepadState.right) {
                this.gamepadState.right = true;
                this.notifyListeners(this.axisListeners, 'right');
              }
            } else {
              this.notifyListeners(this.axisListeners, 'none');
              this.gamepadState.left = false;
              this.gamepadState.right = false;
            }
          }
          if (i == 1 || i == 3) {
            // forward-back
            if (val < -treshold) {
              if (!this.gamepadState.forward) {
                this.gamepadState.forward = true;
                this.notifyListeners(this.axisListeners, 'forward');
              }
            } else if (val > treshold) {
              if (!this.gamepadState.back) {
                this.gamepadState.back = true;
                this.notifyListeners(this.axisListeners, 'back');
              }
            } else {
              this.gamepadState.forward = false;
              this.gamepadState.back = false;
              this.notifyListeners(this.axisListeners, 'none');
            }
          }
        }
      }
    }

    window.addEventListener("gamepaddisconnected", (e) => {
      console.log("Gamepad disconnected ", e.gamepad.id);
      this.scene.unregisterBeforeRender(gamepadTracker);
      this.notifyListeners(this.connectListeners, false);
    });

    window.addEventListener("gamepadconnected", (e) => {
      console.log("Gamepad " + e.gamepad.index + " connected " + e.gamepad.id);
      this.gamepadState = {
        index: e.gamepad.index,
        id: e.gamepad.id,
        buttons: [],
        axes: [],
        forward: false,
        back: false,
        left: false,
        right: false
      }
      e.gamepad.buttons.forEach(b => {
        let state = b.value > 0 || b.pressed || b.touched;
        //console.log('button state: '+state);
        this.gamepadState.buttons.push(state);
      });
      e.gamepad.axes.forEach(a => {
        //console.log('axis state: '+a);
        this.gamepadState.axes.push(a);
      });
      this.scene.registerBeforeRender(gamepadTracker);
      console.log("gamepad state initialized");

      this.notifyListeners(this.connectListeners, true);
    });
  }

  /**
   * Gamepad button event handler. Buttons left/right/up/down are forwarded to the HUD.
   * Trigger button and select button events are forwarded either to HUD, or to the scene, as appropriate.
   * @param index button index, see https://github.com/alvaromontoro/gamecontroller.js/blob/master/public/gamepad.svg
   * @param state true/false for pressed/released
   */
  gamepadButton(index, state) {
    // triggers: left 4, 6, right 5, 7
    // select 8, start 9
    // left right down up: right 2 1 0 3 (X B A Y) left 14 15 13 12
    // stick: left 10 right 11 
    //console.log(index+" "+state);
    try {
      if (index == 8 || index == 6 || index == 7 || index == 4 || index == 5) {
        console.log('activate ' + index + ' scene: ' + (this.pickInfo != null));
        // select, triggers
        if (VRSPACEUI.hud && VRSPACEUI.hud.canProcessGamepadEvent()) {
          // hud event takes precedence
          if (state) {
            // only process button down
            VRSPACEUI.hud.activate();
          }
        } else if (this.pickInfo) {
          // scene event
          if (state) {
            this.world.scene.simulatePointerDown(this.pickInfo);
          } else {
            this.world.scene.simulatePointerUp(this.pickInfo);
          }
        }
      } else if (state && VRSPACEUI.hud) {
        if (index == 2 || index == 14) {
          VRSPACEUI.hud.left();
        } else if (index == 1 || index == 15) {
          VRSPACEUI.hud.right();
        } else if (index == 0 || index == 13) {
          VRSPACEUI.hud.down();
        } else if (index == 3 || index == 12) {
          VRSPACEUI.hud.up();
        }
      }
    } catch (error) {
      console.error("Error:", error.stack);
    }
  }

  notifyListeners(listeners, event) {
    listeners.forEach(listener => listener(event));
  }

  addAxisListener(callback) {
    VRSPACE.addListener(this.axisListeners, callback);
  }

  removeAxisListener(callback) {
    VRSPACE.removeListener(this.axisListeners, callback);
  }

  addConnectListener(callback) {
    VRSPACE.addListener(this.connectListeners, callback);
  }

  removeConnectListener(callback) {
    VRSPACE.removeListener(this.connectListeners, callback);
  }


}