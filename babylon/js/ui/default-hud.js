import { VRSPACE, GroupEvent } from '../client/vrspace.js';
import { VRSPACEUI } from './vrspace-ui.js';
import { MediaStreams } from '../core/media-streams.js';
import { SpeechInput } from '../core/speech-input.js';
import { WorldManager } from '../core/world-manager.js';
import { World } from '../world/world.js';
import { VRSpaceAPI } from '../client/rest-api.js';
import { VRHelper } from '../xr/vr-helper.js';
import { ServerFile } from '../core/server-folder.js';
import { EmojiParticleSystem } from './world/emoji-particle-system.js';
import { Screencast } from './world/screencast.js';
import { Whiteboard } from './world/whiteboard.js';
import { TextArea } from './widget/text-area.js';
import { Sceneshot } from '../world/sceneshot.js';
import { HideAndSeek } from '../games/hide-and-seek.js';
import { GameTag } from '../games/game-tag.js';
import { SoundMixer } from './widget/sound-mixer.js';
import { CameraHelper } from '../core/camera-helper.js';
import { ImageArea } from './widget/image-area.js';
import { UserDirectionMonitor } from './widget/user-direction-monitor.js';
import { MiniMap } from './widget/mini-map.js';
import { GroupsUI } from './groups-ui.js';
import { ChatLog } from './widget/chat-log.js';
import { HumanoidAvatar } from '../avatar/humanoid-avatar.js';
import { VideoAvatar } from '../avatar/video-avatar.js';
/**
 * Adds default holographic buttons to the HUD.
 */
export class DefaultHud {
  constructor(scene) {
    this.scene = scene;
    this.hud = VRSPACEUI.hud;
    this.hud.verticalWeb = -0.15;
    this.contentBase = VRSPACEUI.contentBase;
    this.displayButtons = false;
    /** @type {HumanoidAvatar} */
    this.avatar = null;
    /** @type {VideoAvatar} */
    this.videoAvatar = null;
    this.isAuthenticated = false;
    this.xrMovementChangeEnabled = true;
    this.xrTeleport = true;
    this.portals = {};
    this.state = { webcam: false, speech: SpeechInput.isEnabled() };
    this.movementButton = null;
    this.orientationButton = null;
    this.cameraButton = null;
    this.buttons = [];
    this.emojiParticleSystem = new EmojiParticleSystem(scene);
    this.screencast = null;
    this.whiteboard = null;
    this.creditArea = null;
    this.miniMap = null;
    this.groupsUI = null;
    this.groupEventCount = 0;
    this.groupListener = VRSPACE.addGroupListener(event => this.groupEvent(event));
  }

  init() {
    if (this.miniMap) {
      this.miniMap.dispose();
      this.miniMap = null;
    }
    if (this.groupsUI) {
      this.groupsUI.dispose();
      this.groupsUI = null;
    }
    if (this.settingsButton && this.displayButtons) {
      this.clearRow();
      this.displayButtons = false;
    } else if (!this.settingsButton) {
      this.settingsButton = this.hud.addButton("Settings", this.contentBase + "/content/icons/settings.png", () => this.settings());
      this.toolsButton = this.hud.addButton("Tools", this.contentBase + "/content/icons/tools.png", () => this.tools());
      this.gamesButton = this.hud.addButton("Games", this.contentBase + "/content/icons/gamepad.png", () => this.games(), false);
      this.emojiButton = this.hud.addButton("Emoji", this.contentBase + "/content/icons/emoji.png", () => this.emojis());
      this.shareButton = this.hud.addButton("Share", this.contentBase + "/content/icons/share.png", () => this.share());
      this.helpButton = this.hud.addButton("Help", this.contentBase + "/content/icons/help.png", () => this.help());
      this.hud.enableSpeech(true);
    }
    if (this.isOnline()) {
      this.hud.markEnabled(this.gamesButton);
    } else {
      this.hud.markDisabled(this.gamesButton);
    }
    this.addGroupsButton();
  }

  addGroupsButton() {
    if (!this.groupsButton && this.isOnline() && this.isAuthenticated) {
      this.groupsButton = this.hud.addButton("Groups", this.contentBase + "/content/icons/user-group.png", () => { this.groups() });
    }
  }

  streamingAvailable() {
    // TODO check server capabilities
    // screen sharing unavailable on mobiles
    return this.isOnline() && !VRSPACEUI.hasTouchScreen();
  }

  isOnline() {
    return WorldManager.instance && WorldManager.instance.isOnline();
  }

  settings() {
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.settingsButton);
      this.hud.newRow();

      this.showMobileControls();
      this.showCameraControls();
      // CHECKME: flying through everything, should not be enabled by default
      this.showXRMovementControls();

      /*
      // this is supposed to either change profile, or allow user to activate some avatar animation
      this.avatarButton = this.hud.addButton("Avatar", this.contentBase + "/content/icons/user-avatar.png", () => this.changeAvatar());
      this.avatarButton.isVisible = (this.avatar != null);
      this.avatarButton.tooltipText = "TODO";
      */

      this.soundButton = this.hud.addButton("Sound", this.contentBase + "/content/icons/sound.png", () => this.soundMixer(), false);
      this.soundButton.tooltipText = "Sound Mixer";

      this.micButton = this.hud.addButton("Microphone", this.contentBase + "/content/icons/microphone-off.png", () => this.toggleMic(), false);
      this.micButton.tooltipText = "Toggle Microphone";
      this.displayMic();

      this.webcamButton = this.hud.addButton("Camera", this.contentBase + "/content/icons/webcam-off.png", () => this.toggleWebcam(), false);
      this.webcamButton.tooltipText = "Toggle Webcam";
      this.toggleWebcam(this.state.webcam);

      this.speechButton = this.hud.addButton("Voice", this.contentBase + "/content/icons/voice-recognition-off.png", () => this.speech(), false);
      this.speechButton.tooltipText = "Voice Commands";
      this.speech(this.state.speech);

      this.hud.enableSpeech(true);
    } else {
      this.clearRow();
    }
  }

  tools() {
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.toolsButton);
      this.hud.newRow();

      this.minimapButton = this.hud.addButton("Mini map", this.contentBase + "/content/icons/map.png", () => this.toggleMiniMap(), false);
      this.minimapButton.tooltipText = "Show mini map";
      if (this.miniMap) {
        this.hud.markActive(this.minimapButton, true);
      }

      this.compassButton = this.hud.addButton("Positions", this.contentBase + "/content/icons/location-indicator.png", () => this.compass(), false);
      this.compassButton.tooltipText = "Show positions";
      if (!UserDirectionMonitor.isEnabled()) {
        this.hud.markDisabled(this.compassButton, true);
      } else if (UserDirectionMonitor.instance) {
        this.hud.markActive(this.compassButton, true);
      }

      this.saveButton = this.hud.addButton("Save", this.contentBase + "/content/icons/save.png", () => this.save(), false);
      this.saveButton.tooltipText = "Save&Download";

      this.authorsButton = this.hud.addButton("Credits", this.contentBase + "/content/icons/copyleft.png", () => this.credits(), false);
      this.authorsButton.tooltipText = "Authors";

      this.hud.enableSpeech(true);

    } else {
      this.clearRow();
    }
  }

  compass() {
    if (UserDirectionMonitor.instance) {
      UserDirectionMonitor.instance.dispose();
      this.hud.markEnabled(this.compassButton, true);
    } else {
      new UserDirectionMonitor().start();
      this.hud.markActive(this.compassButton, true);
    }
  }

  toggleMiniMap() {
    if (this.miniMap) {
      this.miniMap.dispose();
      this.miniMap = null;
      this.hud.markEnabled(this.minimapButton, true);
    } else {
      this.miniMap = new MiniMap(this.scene);
      this.hud.markActive(this.minimapButton, true);
    }
  }

  clearRow() {
    this.hud.clearRow();
    if (this.orientationButton) {
      this.orientationButton.dispose();
      this.orientationButton = null;
    }
    if (this.cameraButton) {
      this.cameraButton.dispose();
      this.cameraButton = null;
    }
    if (this.movementButton) {
      this.movementButton.dispose();
      this.movementButton = null;
    }
    if (this.screencastButton) {
      this.screencastButton.dispose();
      this.whiteboardButton.dispose();
      this.fileButton.dispose();
      this.screencastButton = null;
      this.whiteboardButton = null;
      this.fileButton = null;
    }
    if (this.creditArea) {
      this.creditArea.dispose();
      this.creditArea = null;
    }
    this.buttons.forEach(b => b.dispose());
    this.buttons = [];
    this.hud.showButtons(true);
  }

  emojis() {
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.emojiButton);
      this.hud.newRow();
      // FIXME: synchronize this
      VRSPACEUI.listDirectory(this.contentBase + "/content/emoji", emojis => {
        console.log(emojis);
        emojis.forEach(url => {
          let sf = new ServerFile(url);
          // do not use full url here, use only path and file
          let button = this.hud.addButton(sf.baseName, sf.getPath(), () => this.playEmoji(sf.getPath()), false);
          button.backMaterial.alpha = 1;
          button.plateMaterial.disableLighting = true;
          button.plateMaterial.emissiveColor = new BABYLON.Color3(0.3, 0.3, 0.3);
          button.onPointerUpObservable.add(() => this.stopEmoji());
          this.buttons.push(button);
        });
      });
    } else {
      this.clearRow();
    }
  }

  playEmoji(url) {
    console.log("Playing emoji " + url);

    this.stopEmoji();
    if (this.isOnline()) {
      // online, bind to camera in 1st person and to avatar in 3rd person view
      if (World.lastInstance.inThirdPerson()) {
        this.emojiParticleSystem.init(url, World.lastInstance.avatarController.avatar).start();
      } else {
        this.emojiParticleSystem.init(url).start();
      }
      // start remote emoji here
      WorldManager.instance.publishChanges([{ field: 'emoji', value: url }]);
    } else if (this.avatar) {
      // offline, avatar chosen
      this.emojiParticleSystem.init(url, this.avatar, -5).start();
    } else if (this.videoAvatar) {
      this.emojiParticleSystem.init(url, this.videoAvatar, -5).start();
    } else {
      // offline, no avatar yet
      this.emojiParticleSystem.init(url).start();
    }
  }

  stopEmoji() {
    console.log("Stopping emoji");
    this.emojiParticleSystem.stop();
    // stop remote emoji here
    if (this.isOnline()) {
      WorldManager.instance.publishChanges([{ field: 'emoji', value: null }]);
    }
  }

  setAvatar(avatar) {
    if (this.avatarButton) {
      this.avatarButton.isVisible = (avatar != null);
      // we can't stream to avatar anyway, not yet
      this.toggleWebcam(false);
    }
    this.avatar = avatar;
  }

  changeAvatar() {
    // TODO
  }

  setAuthenticated(arg = false) {
    this.isAuthenticated = arg;
    if (!this.displayButtons && this.isAuthenticated && !this.worldButton) {
      // add these buttons only once, to the first row along with settings button
      this.worldButton = this.hud.addButton("World", this.contentBase + "/content/icons/world-add.png", () => { this.showWorldTemplates() });
      this.addGroupsButton();
    }
  }

  showMobileControls() {
    if (VRSPACEUI.hasTouchScreen() && !World.lastInstance.inXR()) {
      if (!this.orientationButton) {
        this.orientationButton = this.hud.addButton("Rotation", VRSPACEUI.contentBase + "/content/icons/rotate-hand.png", () => this.toggleOrientation());
      }
      if (CameraHelper.getInstance(this.scene).mobileOrientationEnabled) {
        this.orientationButton.imageUrl = VRSPACEUI.contentBase + "/content/icons/rotate-hand.png";
        this.orientationButton.tooltipText = "3rd Person";
      } else {
        this.orientationButton.imageUrl = VRSPACEUI.contentBase + "/content/icons/rotate-screen.png";
        this.orientationButton.tooltipText = "1st Person";
      }
    }
  }

  toggleOrientation() {
    CameraHelper.getInstance(this.scene).enableMobileOrientation(!CameraHelper.getInstance(this.scene).mobileOrientationEnabled);
    this.showMobileControls();
  }

  showCameraControls() {
    if (World.lastInstance.camera3p && World.lastInstance.camera1p) {
      if (!this.cameraButton) {
        this.cameraButton = this.hud.addButton("View", VRSPACEUI.contentBase + "/content/icons/camera-1st-person.png", () => this.toggleCamera());
      }
      if (this.scene.activeCamera == World.lastInstance.camera1p) {
        this.cameraButton.imageUrl = VRSPACEUI.contentBase + "/content/icons/camera-3rd-person.png";
        this.cameraButton.tooltipText = "3rd Person";
      } else if (this.scene.activeCamera == World.lastInstance.camera3p) {
        this.cameraButton.imageUrl = VRSPACEUI.contentBase + "/content/icons/camera-1st-person.png";
        this.cameraButton.tooltipText = "1st Person";
      }
    }
  }

  toggleCamera() {
    if (World.lastInstance.camera3p && World.lastInstance.camera1p) {
      if (this.scene.activeCamera == World.lastInstance.camera1p) {
        World.lastInstance.thirdPerson();
      } else if (this.scene.activeCamera == World.lastInstance.camera3p) {
        World.lastInstance.firstPerson();
      }
      this.showCameraControls();
    }
  }

  showXRMovementControls() {
    if (this.scene.activeCamera.getClassName() == 'WebXRCamera') {
      if (!this.movementButton) {
        this.movementButton = this.hud.addButton("Movement", VRSPACEUI.contentBase + "/content/icons/man-run.png.png", () => this.toggleXRMovement());
      }
      if (this.xrTeleport) {
        VRHelper.getInstance().enableTeleportation();
        this.movementButton.imageUrl = VRSPACEUI.contentBase + "/content/icons/man-run.png";
        this.movementButton.tooltipText = "Slide";
      } else {
        VRHelper.getInstance().enableSliding();
        this.movementButton.imageUrl = VRSPACEUI.contentBase + "/content/icons/man-jump.png";
        this.movementButton.tooltipText = "Teleport";
      }
    }
  }

  toggleXRMovement() {
    this.xrTeleport = !this.xrTeleport;
    this.showXRMovementControls();
  }

  displayMic() {
    if (MediaStreams.instance) {
      if (MediaStreams.instance.publishingAudio) {
        this.micButton.imageUrl = this.contentBase + "/content/icons/microphone.png";
      } else {
        this.micButton.imageUrl = this.contentBase + "/content/icons/microphone-off.png";
      }
    } else {
      this.hud.markDisabled(this.micButton);
    }
  }

  toggleMic(enabled = !MediaStreams.instance.publishingAudio) {
    if (MediaStreams.instance) {
      MediaStreams.instance.publishAudio(enabled);
      this.displayMic();
    }
  }

  toggleWebcam(enable = !this.state.webcam, videoAvatar) {
    console.log("Webcam: " + enable);
    if (videoAvatar) {
      this.videoAvatar = videoAvatar;
      this.hud.markEnabled(this.webcamButton);
    }
    // this may be called before webcamButton is created
    if (this.webcamButton) {
      if (!this.isOnline() && (!this.videoAvatar || !this.videoAvatar.isEnabled())) {
        // entry screen, video avatar not created or not selected
        this.hud.markDisabled(this.webcamButton);
        return;
      }
      if (enable) {
        this.webcamButton.imageUrl = this.contentBase + "/content/icons/webcam.png";
        // enabling video avatar online
        if (this.isOnline() && MediaStreams.instance) {
          if (!this.videoAvatar) {
            // user entered a space without selecting video avatar, create one
            this.videoAvatar = WorldManager.instance.avatarLoader.avatarFactory(VRSPACE.me, true, true);
            if (!this.videoAvatar.selectDevice()) {
              this.hud.markDisabled(this.webcamButton);
              return;
            }
          }
          // handle 3rd person cases
          if (World.lastInstance.inThirdPerson()) {
            if (this.avatar && this.videoAvatar) {
              // switch from existing 3d avatar to video avatar
              this.avatar.hide();
              this.videoAvatar.show();
            } else {
              // video avatar only, just start video
              this.videoAvatar.displayVideo();
            }
          } else {
            // in 1st person, show the avatar and attach to camera
            this.videoAvatar.show();
            this.videoAvatar.attachToCamera();
          }
          World.lastInstance.setAvatar(this.videoAvatar);
        } else if (this.videoAvatar && this.videoAvatar.isEnabled()) {
          // offline, just show the video
          this.videoAvatar.displayVideo();
        }
      } else {
        this.webcamButton.imageUrl = this.contentBase + "/content/icons/webcam-off.png";
        if (this.isOnline() && MediaStreams.instance) {
          if (this.avatar) {
            // switch from video avatar to existing 3d avatar
            if (World.lastInstance.inThirdPerson()) {
              this.avatar.show();
            }
            World.lastInstance.setAvatar(this.avatar);
          }
          if (this.videoAvatar) {
            // in both 1st and 3rd person view, remove video avatar
            this.videoAvatar.dispose();
          }
        } else if (this.videoAvatar && this.videoAvatar.isEnabled()) {
          // offline, just display image/name
          this.videoAvatar.displayAlt();
        }
      }
      if (this.isOnline() && MediaStreams.instance) {
        WorldManager.instance.sendMy({ video: enable });
        MediaStreams.instance.publishVideo(enable);
      }
    }
    this.state.webcam = enable;
  }

  speech(enable = !this.state.speech) {
    if (SpeechInput.available()) {
      this.state.speech = enable;
      SpeechInput.enabled = enable;
      this.hud.enableSpeech(enable);
      if (this.state.speech) {
        this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition.png";
      } else {
        this.speechButton.imageUrl = this.contentBase + "/content/icons/voice-recognition-off.png";
      }
    } else {
      this.hud.markDisabled(this.speechButton);
    }
  }

  credits() {
    let assets = VRSPACEUI.assetLoader.assetInfos();
    if (this.creditArea) {
      this.hud.markEnabled(this.authorsButton, true);
      this.creditArea.dispose();
      this.creditArea = null;
      return;
    }
    if (Object.keys(assets).length > 0) {
      this.hud.markActive(this.authorsButton, true);
      this.creditArea = new TextArea(this.scene, "CreditsTextArea");
      let rows = Math.floor(Object.keys(assets).length / 4) + 1;
      this.creditArea.width = 1024;
      this.creditArea.height = 512 * rows;
      this.creditArea.text = "Credits:";
      this.creditArea.attachToHud();
      this.creditArea.size = 1;
      this.creditArea.position = new BABYLON.Vector3(0, .2, .5);
      this.creditArea.show();
      this.creditArea.detach(2);
      this.creditArea.group.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
      for (let url in assets) {
        this.creditArea.writeln();
        this.creditArea.writeln(url);
        let info = assets[url];
        if (info) {
          for (let data in info) {
            this.creditArea.println(data + ": " + info[data]);
          }
        } else {
          this.creditArea.writeln('No author information available');
        }
      }
    }
  }

  help() {
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.helpButton);
      this.hud.newRow();
      this.helpPCButton = this.hud.addButton("PC", this.contentBase + "/content/icons/device-pc.png", () => this.helpImage("help-pc.jpg"));
      this.helpMobileButton = this.hud.addButton("Mobile", this.contentBase + "/content/icons/device-mobile.png", () => this.helpImage("help-mobile.jpg"));
      this.helpGamepadButton = this.hud.addButton("Gamepad", this.contentBase + "/content/icons/gamepad.png", () => this.helpImage("help-gamepad.jpg"));
      this.helpGamepadButton = this.hud.addButton("VR", this.contentBase + "/content/icons/device-goggles.png", () => this.helpImage("help-vr.jpg"));
    } else {
      if (this.helpImageArea) {
        this.helpImageArea.dispose();
        this.helpImageArea = null;
      }
      this.clearRow();
      this.helpPCButton.dispose();
      this.helpMobileButton.dispose();
      //this.helpPCButton = null;
    }
  }

  helpImage(file) {
    if (this.helpImageArea) {
      this.helpImageArea.dispose();
    }
    this.helpImageArea = new ImageArea(this.scene, "help image");
    this.helpImageArea.size = 1;
    this.helpImageArea.width = 1024;
    this.helpImageArea.height = 512;
    this.helpImageArea.position = new BABYLON.Vector3(0, .5, 0);
    this.helpImageArea.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
    this.helpImageArea.show();
    this.helpImageArea.detach(2);
    this.helpImageArea.loadUrl(this.contentBase + "/content/images/" + file);
  }

  showWorldTemplates() {
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.worldButton);
      this.hud.newRow();

      for (let name in this.portals) {
        let p = this.portals[name];
        let button = this.hud.addButton(p.name, p.imageUrl, () => { this.createWorld(p) });
        this.buttons.push(button);
      }
    } else {
      this.clearRow();
    }
  }

  async createWorld(portal) {
    console.log("TODO: creating new world from " + portal.name);
    const userName = this.avatar && this.avatar.name ? this.avatar.name : this.videoAvatar.name;
    const worldName = userName + "'s world";
    const token = await VRSpaceAPI.getInstance().createWorldFromTemplate(worldName, portal.name);
    const href = window.location.href + "?worldName=" + worldName + "&worldToken=" + token + "&worldThumbnail=" + portal.name;
    const shareData = {
      title: worldName,
      text: "Join " + worldName,
      url: href
    };
    if (ChatLog.activeInstance) {
      // share the world with current chat group (groups-ui listens)
      ChatLog.activeInstance.notifyListeners(worldName, { content: worldName, link: href });
    }
    if (typeof navigator.canShare === "function") {
      try {
        await navigator.share(shareData);
      } catch (exception) {
        console.error("Can't share world - " + exception);
      }
    }
    // give it some time to propagate
    setTimeout(() => window.location.href = href, 200);
    // TODO: instead, we should do what AvatarSelection.enterWorld does
  }

  share() {
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.shareButton);
      this.hud.newRow();
      this.screencastButton = this.hud.addButton("Share screen", this.contentBase + "/content/icons/share-screen.png", () => this.shareScreen(), false);
      this.whiteboardButton = this.hud.addButton("Whiteboard", this.contentBase + "/content/icons/whiteboard.png", () => this.toggleWhiteboard(), false);
      this.imageButton = this.hud.addButton("Share image", this.contentBase + "/content/icons/sky.png", () => this.shareImage(), false);
      this.videoButton = this.hud.addButton("Share video", this.contentBase + "/content/icons/video.png", () => this.shareVideo(), false);
      this.fileButton = this.hud.addButton("Share file", this.contentBase + "/content/icons/file.png", () => this.shareFile(), false);
      this.modelButton = this.hud.addButton("Share model", this.contentBase + "/content/icons/cube.png", () => this.shareModel(), false);
      if (this.streamingAvailable()) {
        this.hud.markEnabled(this.screencastButton);
      } else {
        this.hud.markDisabled(this.screencastButton);
      }
      if (this.whiteboard) {
        this.hud.markActive(this.whiteboardButton);
      } else {
        this.hud.markEnabled(this.whiteboardButton);
      }
      if (this.isOnline()) {
        this.hud.markEnabled(this.fileButton);
        this.hud.markEnabled(this.imageButton);
        this.hud.markEnabled(this.videoButton);
        this.hud.markEnabled(this.modelButton);
      } else {
        this.hud.markDisabled(this.fileButton);
        this.hud.markDisabled(this.imageButton);
        this.hud.markDisabled(this.videoButton);
        this.hud.markDisabled(this.modelButton);
      }
      if (this.isOnline()) {
        WorldManager.instance.world.addListener(this);
      }
    } else {
      if (this.isOnline()) {
        WorldManager.instance.world.removeListener(this);
      }
      this.clearRow();
    }
  }

  shareScreen() {
    if (!this.streamingAvailable()) {
      return;
    }
    if (this.screencast) {
      this.hud.markEnabled(this.screencastButton)
      this.screencast.dispose();
      this.screencast = null;
      return;
    }
    this.hud.markActive(this.screencastButton)
    let world = WorldManager.instance.world;
    let camera = this.scene.activeCamera;
    this.screencast = new Screencast(world);
    this.screencast.position = camera.position.add(camera.getForwardRay(1).direction);
    // CHECKME: Web3d camera uses quaternion, some others may
    if (!camera.rotationQuaternion) {
      // assuming user is facing the audience, share is also facing the audience
      this.screencast.rotation = new BABYLON.Vector3(0, camera.rotation.y + Math.PI, 0);
    }
    this.screencast.size = 1;
    this.screencast.callback = state => {
      // callback may be executed after screencast was disposed above 
      if (!state && this.screencast) {
        this.hud.markEnabled(this.screencastButton);
        this.screencast.dispose();
        this.screencast = null;
      }
    };
    this.screencast.init();
    this.screencast.startSharing();
  }

  toggleWhiteboard() {
    if (this.whiteboard) {
      this.hud.markEnabled(this.whiteboardButton)
      WorldManager.instance.world.removeListener(this.whiteboard);
      this.whiteboard.dispose();
      this.whiteboard = null;
      return;
    }
    let camera = this.scene.activeCamera;
    this.whiteboard = new Whiteboard(this.scene, "Whiteboard-" + WorldManager.myId());
    this.whiteboard.size = 1;
    this.whiteboard.position = camera.position.add(camera.getForwardRay(1).direction.scale(2));
    this.whiteboard.show();
    this.hud.markActive(this.whiteboardButton)
    this.whiteboard.closeCallback = () => {
      this.hud.markEnabled(this.whiteboardButton)
      this.whiteboard = null;
    }
    if (this.isOnline()) {
      WorldManager.instance.world.addListener(this.whiteboard);
      this.whiteboard.startSharing();
    }
    World.lastInstance.addSelectionPredicate(this.whiteboard.selectionPredicate);
  }

  shareImage() {
    this.shareFile(".jpg,.jpeg,.png");
  }

  shareVideo() {
    this.shareFile(".mp4,.webm,.ogv");
  }

  shareModel() {
    this.shareFile(".glb,.zip");
  }

  shareFile(accept) {
    if (!this.isOnline()) {
      return;
    }
    let input = document.createElement("input");
    input.setAttribute('type', 'file');
    input.setAttribute('style', 'display:none');
    if (accept) {
      input.setAttribute('accept', accept);
    }
    document.body.appendChild(input);
    input.addEventListener("change", () => this.upload(input), false);
    input.addEventListener("cancel", () => this.upload(input), false);
    input.click();
  }

  upload(input) {
    console.log("Files: ", input.files);
    // we load only one, but still
    for (let i = 0; i < input.files.length; i++) {
      const file = input.files[i];
      console.log("Uploading ", file);
      let camera = this.scene.activeCamera;
      let pos = camera.position.add(camera.getForwardRay(1).direction);

      VRSpaceAPI.getInstance().upload(file, pos, camera.rotation);
    };
    document.body.removeChild(input);
  }

  /** World LoadListener interface */
  loaded(vrObject) {
    console.log("Loaded ", vrObject);
    // FIXME this is going to resize any loaded object
    // supposed to resize only one(s) loaded via file() method here
    // CHECKME what happens with world editor then?
    if (vrObject.container) {
      setTimeout(() => {
        let rootMesh = vrObject.container.meshes[0];
        var scale = 1 / WorldManager.instance.bBoxMax(rootMesh);
        //var scale = 1/this.worldManager.bBoxMax(this.worldManager.getRootNode(vrObject));
        VRSPACE.sendEvent(vrObject, { scale: { x: scale, y: scale, z: scale } });
      }, 100);
    }
  }

  /**
   * Save the current view of the world as HTML file.
   */
  save() {
    Sceneshot.saveHtml();
  }

  games() {
    if (!this.isOnline()) {
      return;
    }
    this.displayButtons = !this.displayButtons;
    if (this.displayButtons) {
      this.hud.showButtons(false, this.gamesButton);
      this.hud.newRow();
      this.playHideButton = this.hud.addButton("Hide And Seek", this.contentBase + "/content/icons/eye.png", () => this.hideAndSeek(), false);
      this.playTagButton = this.hud.addButton("Tag!", this.contentBase + "/content/icons/man-run.png", () => this.playTag(), false);
      this.checkAvailableGames();
    } else {
      this.clearRow();
    }
  }

  checkAvailableGames() {
    if (HideAndSeek.instance) {
      this.hud.markActive(this.playHideButton);
      this.hud.markDisabled(this.playTagButton);
    } else if (GameTag.instance) {
      this.hud.markDisabled(this.playHideButton);
      this.hud.markActive(this.playTagButton);
    } else {
      this.hud.markEnabled(this.playHideButton);
      this.hud.markEnabled(this.playTagButton);
    }
  }

  hideAndSeek() {
    if (!GameTag.instance) {
      HideAndSeek.createOrJoinInstance((startStop) => {
        this.checkAvailableGames();
      });
    }
  }

  playTag() {
    if (!HideAndSeek.instance) {
      GameTag.createOrJoinInstance((startStop) => {
        this.checkAvailableGames();
      });
    }
  }

  soundMixer() {
    if (SoundMixer.instance) {
      SoundMixer.getInstance(this.scene).dispose();
      VRSPACEUI.hud.clearRow();
      VRSPACEUI.hud.showButtons(true);
    } else {
      VRSPACEUI.hud.showButtons(false, this.soundButton);
      VRSPACEUI.hud.newRow();
      SoundMixer.getInstance(this.scene).show();
    }
  }

  groups() {
    this.displayButtons = !this.displayButtons;
    this.groupEventCount = 0;
    this.groupsButton.text = "Groups";
    if (this.groupsUI) {
      this.groupsUI.hide();
      this.groupsUI = null;
    } else {
      this.groupsUI = new GroupsUI(this.scene);
      this.groupsUI.show(this.groupsButton);
    }
  }

  /** @param {GroupEvent} event  */
  groupEvent(event) {
    console.log("Group event", event);
    if (!this.displayButtons) {
      if (event.message) {
        let chatlog = ChatLog.findInstance(event.message.group.name, "ChatLog:" + event.message.group.name);
        if (chatlog) {
          // chatlog displays messages
          return;
        }
      }
      this.groupEventCount++;
      this.groupsButton.text = "Groups:" + this.groupEventCount;
      this.groupsButton.pointerEnterAnimation();
      setTimeout(() => {
        if (!this.displayButtons) this.groupsButton.pointerOutAnimation()
      }, 500);
    }
  }
}