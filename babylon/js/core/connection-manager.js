import { Client, VRSPACE, Welcome } from '../client/vrspace.js';
import { WorldManager } from './world-manager.js';
import { MediaHelper } from './media-helper.js';
import { VRSPACEUI } from '../ui/vrspace-ui.js';
import { VRSpaceAPI } from '../client/rest-api.js';

/**
 * Component responsible for setting up and mantaining connection to server.
 */
export class ConnectionManager {
  /** @param {WorldManager} worldManager */
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.world = worldManager.world;
    // probably not instantiated at the moment of creation
    this.mediaStreams = worldManager.mediaStreams
    this.api = VRSpaceAPI.getInstance(VRSPACEUI.contentBase);
  }
  
  /**
  Enter the world specified by world.name. If not already connected, 
  first connect to world.serverUrl and set own properties, then start the session.
  World and WorldListeners are notified by calling entered methods. 
  @param {Object} properties own properties to set before starting the session
  @return {Promise<Welcome>} promise resolved after enter
   */
  async enter(properties) {
    const errorListener = VRSPACE.addErrorListener((e) => {
      console.log("Server error:" + e);
      this.worldManager.error = e;
    });
    return new Promise((resolve, reject) => {
      // TODO most of this code needs to go into VRSpace client.
      // TODO it should use async rather than callback functions
      var afterEnter = (welcome) => {
        VRSPACE.removeWelcomeListener(afterEnter);
        this.entered(welcome);
        resolve(welcome);
      };
      var afterConnect = async (welcome) => {
        VRSPACE.removeWelcomeListener(afterConnect);
        this.configureSession(properties);
        // FIXME for the time being, Enter first, then Session
        if (this.world.name) {
          let anotherWelcomeListener = VRSPACE.addWelcomeListener(welcome => {
            VRSPACE.removeWelcomeListener(anotherWelcomeListener);
            VRSPACE.callCommand("Session", () => afterEnter(welcome));
            this.pubSub(welcome.client.User, VRSPACE.me.video);
          });
          VRSPACE.sendCommand("Enter", { world: this.world.name });
        } else {
          // Can't enter anywhere whithout world name, so we're in default world.
          // Untested scenario, not used anywhere in current code base.
          VRSPACE.callCommand("Session", () => {
            this.entered(welcome)
            resolve(welcome);
            // start session in default space
            this.pubSub(VRSPACE.me, VRSPACE.me.video);
          });
        }    
      };
      if (!this.worldManager.isOnline()) {
        VRSPACE.addWelcomeListener(afterConnect);
        if ( !VRSPACE.isConnected() ) {
          // making sure reconnect is handled
          VRSPACE.connect(this.world.serverUrl);
        }
        const connectionListener = VRSPACE.addConnectionListener(async (connected, reconnecting) => {
          console.log('connected:' + connected);
          if (!connected) {
            if ( !this.worldManager.isOnline() ) {
              // initial connection failed
              reject(this);
            } else if (reconnecting) {
              this.trackProgress();
              // connection lost, reconnect in progress
              console.log("Reconnecting, user was authenticated: "+ this.worldManager.authenticated );
            } else {
              console.log("connection lost and NOT reconnecting - return to login screen");
              this.closeProgress();
              window.location.reload();
            }
          } else if (this.worldManager.isOnline()) {
            // reconnect succeeded
            // TODO move this to dedicated cleanup method
            // clear the scene
            this.worldManager.removeAll();
            VRSPACE.removeErrorListener(errorListener);
            // clear audio/video session
            if ( this.mediaStreams ) {
              this.mediaStreams.close();
            }
            // ensure same workflow, sets online to false:
            this.worldManager.setSessionStatus(false);
            // this is going to be set up again
            VRSPACE.removeConnectionListener(connectionListener);
            // authenticated users may need to log in again
            if ( this.worldManager.authenticated ) {
              let authenticated = await this.api.getAuthenticated();
              console.log("Reconnecting, user was/is authenticated: "+ this.worldManager.authenticated+"/"+authenticated );
              if ( ! authenticated ) {
                // no automatic reconnect for authenticated users once authentication expires
                await this.api.oauth2login(this.worldManager.oauth2providerId, properties.name, properties.mesh);
              }
            }
            // restart enter procedure
            this.enter(properties).then(()=>{
              this.worldManager.publishState();
              this.closeProgress();
            });
          }
        });
      } else if (this.world.name) {
        VRSPACE.addWelcomeListener(afterEnter);
        VRSPACE.sendCommand("Enter", { world: this.world.name });
      }
    });
  }

  trackProgress() {
    if ( VRSPACEUI.indicator) {
      VRSPACEUI.indicator.add("Reconnect")
      VRSPACEUI.indicator.animate();
    }
  }
  closeProgress() {
    if ( VRSPACEUI.indicator ) {
      VRSPACEUI.indicator.remove("Reconnect")
    }
  }
  /** Called after user enters a world, calls world and world listener entered() methods wrapped in try/catch */
  entered(welcome) {
    try {
      this.world.entered(welcome);
    } catch (err) {
      console.log("Error in world entered", err);
    }
    this.world.worldListeners.forEach(listener => {
      try {
        if (listener.entered) {
          listener.entered(welcome);
        }
      } catch (error) {
        console.log("Error in world listener", error);
      }
    });
  }

  /**
   * Set up session based on properties and current state.
   * Called after connection is established, and before enter/start session.
   */
  configureSession(properties) {
    // CHECKME SoC
    if (this.worldManager.remoteLogging) {
      this.worldManager.enableRemoteLogging();
    }
    if (this.worldManager.tokens) {
      for (let token in this.worldManager.tokens) {
        VRSPACE.setToken(token, this.worldManager.tokens[token]);
      }
    }
    if (properties) {
      for (var prop in properties) {
        // publish own properties
        VRSPACE.sendMy(prop, properties[prop]);
        // and also set their values locally
        VRSPACE.me[prop] = properties[prop];
      }
    }
    // DO NOT start publishing after connect, but after enter
    // i.e. first make sure user is in the right space
    //this.pubSub(VRSPACE.me, VRSPACE.me.video);
  }
  
  /** 
   * Publish and subscribe audio/video. Expects user object to contain a valid token.
   * @param {Client} user Client object of the local user
   * @param {boolean} autoPublishVideo should webcam video be published as soon as possible
   */
  async pubSub(user, autoPublishVideo) {
    //this.mediaStreams = this.worldManager.mediaStreams // may not be initialized
    console.log("PubSub autoPublishVideo:"+autoPublishVideo, user);
    // CHECKME: should it be OpenVidu or general streaming service name?
    if (this.mediaStreams && user.tokens && user.tokens.OpenViduMain) {
      console.log("Subscribing as User " + user.id + " with token " + user.tokens.OpenViduMain);
      // ask for webcam access permissions, but NOT while in XR
      if ( !this.worldManager.world.inXR() && await MediaHelper.checkVideoPermissions() ) {
        this.mediaStreams.videoSource = undefined;
        this.mediaStreams.startVideo = autoPublishVideo;
      }
      if (await MediaHelper.checkAudioPermissions()) {
        this.mediaStreams.audioSource = undefined;
      } else {
        this.mediaStreams.audioSource = false;        
      }
      
      try {
        await this.mediaStreams.connect(user.tokens.OpenViduMain)
        // TODO use static instance instead
        this.worldManager.avatarLoader.mediaStreams = this.mediaStreams;
        this.worldManager.meshLoader.mediaStreams = this.mediaStreams;
        // we may need to pause/unpause audio publishing during speech input
        // TODO figure out how to use instance
        VRSPACEUI.hud.speechInput.constructor.mediaStreams = this.mediaStreams;
        if ( this.mediaStreams.audioSource == undefined || this.mediaStreams.videoSource == undefined ) {
          // otherwise error
          this.mediaStreams.publish();
        }
      } catch ( exception ) {
        console.error("Streaming connection failure", exception);
      }
    }
  }

  
}