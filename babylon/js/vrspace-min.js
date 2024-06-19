// minimal imports, VRSpace classes only
export { VRSPACE, VRSpace, SceneEvent, VREvent, EventRecorder, Client, SceneProperties, VRObject, Point, Rotation, ID } from "./client/vrspace.js";
export { VRSpaceAPI } from './client/rest-api.js';

export { ScriptLoader } from "./core/script-loader.js";
export { ServerFolder, ServerFile } from "./core/server-folder.js";
export { World } from "./core/world.js";
export { WorldManager } from "./core/world-manager.js";
export { UnityWorld } from "./core/unity-world.js";
export { MediaStreams, OpenViduStreams } from "./core/media-streams.js";
export { SpeechInput } from "./core/speech-input.js";
export { WorldListener } from "./core/world-listener.js";

export { VRSpaceUI, VRSPACEUI } from "./ui/vrspace-ui.js";
export { LogoRoom } from "./ui/logo-room.js";
export { Portal } from "./ui/portal.js";
export { LoadProgressIndicator } from "./ui/load-progress-indicator.js";
export { RecorderUI } from "./ui/recorder-ui.js";
export { FloorRibbon } from "./ui/floor-ribbon.js";
export { Buttons } from "./ui/buttons.js";
export { Form } from "./ui/form.js";
export { LoginForm } from "./ui/login-form.js";
export { Label } from "./ui/label.js";
export { ChatLog } from './ui/chat-log.js';
export { TextArea } from './ui/text-area.js';
export { TextAreaInput } from './ui/text-area-input.js';
export { ScrollablePanel } from "./ui/scrollable-panel.js";
export { TextureSelector } from "./ui/texture-selector.js";
export { WorldEditor } from "./ui/world-editor.js";
export { SkyboxSelector } from "./ui/skybox-selector.js";
export { DefaultHud } from "./ui/default-hud.js";
export { EmojiParticleSystem } from "./ui/emoji-particle-system.js";
export { Screencast } from "./ui/screencast.js";
export { TerrainEditor } from "./ui/terrain-editor.js";

export { VRHelper } from "./xr/vr-helper.js";
export { ARHelper } from "./xr/ar-helper.js";

export { Avatar } from "./avatar/avatar.js";
export { VideoAvatar } from "./avatar/video-avatar.js";
export { HumanoidAvatar } from "./avatar/humanoid-avatar.js";
export { AvatarController } from "./avatar/avatar-controller.js";

export { Terrain } from "./terrain/terrain.js";
export { Desert } from "./terrain/terrain-desert.js";

export { AvatarSelection } from "../avatar-selection.js";