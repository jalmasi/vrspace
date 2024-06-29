// minimal imports, VRSpace classes only
export { VRSPACE, VRSpace, SceneEvent, VREvent, EventRecorder, Client, SceneProperties, VRObject, Point, Rotation, ID } from "./client/vrspace.js";
export { VRSpaceAPI } from './client/rest-api.js';

export { ScriptLoader } from "./core/script-loader.js";
export { ServerFolder, ServerFile } from "./core/server-folder.js";
export { WorldManager } from "./core/world-manager.js";
export { MediaStreams, OpenViduStreams } from "./core/media-streams.js";
export { SpeechInput } from "./core/speech-input.js";

export { World } from "./world/world.js";
export { WorldListener } from "./world/world-listener.js";
export { UnityWorld } from "./world/unity-world.js";

export { VRSpaceUI, VRSPACEUI } from "./ui/vrspace-ui.js";
export { HUD } from "./ui/hud.js";
export { DefaultHud } from "./ui/default-hud.js";
export { LoadProgressIndicator } from "./ui/load-progress-indicator.js";

export { LogoRoom } from "./ui/world/logo-room.js";
export { Portal } from "./ui/world/portal.js";
export { RecorderUI } from "./ui/world/recorder-ui.js";
export { FloorRibbon } from "./ui/world/floor-ribbon.js";
export { EmojiParticleSystem } from "./ui/world/emoji-particle-system.js";
export { Screencast } from "./ui/world/screencast.js";
export { SharedScreencast } from "./ui/world/shared-screencast.js";
export { Whiteboard } from "./ui/world/whiteboard.js";
export { ScrollablePanel } from "./ui/world/scrollable-panel.js";
export { TextureSelector } from "./ui/world/texture-selector.js";
export { SkyboxSelector } from "./ui/world/skybox-selector.js";
export { TerrainEditor } from "./ui/world/terrain-editor.js";
export { WorldEditor } from "./ui/world/world-editor.js";

export { Buttons } from "./ui/widget/buttons.js";
export { ColorPickerPanel } from './ui/widget/colorpicker-panel.js';
export { Form } from "./ui/widget/form.js";
export { LoginForm } from "./ui/widget/login-form.js";
export { Label } from "./ui/widget/label.js";
export { ChatLog } from './ui/widget/chat-log.js';
export { ImageArea } from './ui/widget/image-area.js';
export { TextArea } from './ui/widget/text-area.js';
export { TextAreaInput } from './ui/widget/text-area-input.js';

export { VRHelper } from "./xr/vr-helper.js";
export { ARHelper } from "./xr/ar-helper.js";

export { Avatar } from "./avatar/avatar.js";
export { VideoAvatar } from "./avatar/video-avatar.js";
export { HumanoidAvatar } from "./avatar/humanoid-avatar.js";
export { AvatarController } from "./avatar/avatar-controller.js";

export { Terrain } from "./terrain/terrain.js";
export { Desert } from "./terrain/terrain-desert.js";

export { AvatarSelection } from "../avatar-selection.js";