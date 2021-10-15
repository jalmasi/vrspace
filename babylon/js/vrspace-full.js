// used to bundle it all together

// VRSpace classes
export { VRSPACE, VRSpace, SceneEvent, VREvent, EventRecorder, Client, SceneProperties, VRObject, Point, Rotation, ID } from "./vrspace.js";
export { VRSpaceUI, VRSPACEUI, LogoRoom, Portal, ServerFolder, LoadProgressIndicator, RecorderUI, FloorRibbon, Buttons, VRHelper, World, WorldManager, MediaStreams, VideoAvatar } from "./vrspace-ui.js";
export { Avatar } from "./avatar.js";

// required babylonjs libraries
import * as BABYLON from "babylonjs";
import 'babylonjs-loaders';
import 'babylonjs-procedural-textures';
import 'babylonjs-post-process';
import 'babylonjs-materials';
export { BABYLON };
import * as GUI from 'babylonjs-gui';
export {GUI};
