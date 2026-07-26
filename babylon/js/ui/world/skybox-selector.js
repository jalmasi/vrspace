import { Skybox } from "../../world/skybox.js";
import { World } from "../../world/world.js";
import { SpeechInput } from '../../core/speech-input.js';
import { Label } from '../widget/label.js';

export class SkyboxSelector {
  /**
   * @param {World} world 
   */
  constructor(world) {
    this.world = world;
    this.boxes = [];
    // add own selection predicate to the world
    this.selectionPredicate = (mesh) => this.isSelectableMesh(mesh);
    world.addSelectionPredicate(this.selectionPredicate);
    //this.enableSpeech = SpeechInput.available();
    this.enableSpeech = SpeechInput.isEnabled();
    this.speechInput = null;
  }

  makeSkyBox(dir) {
    var skybox = new Skybox(this.scene, dir);
    skybox.infiniteDistance = false;
    skybox.size = 1;
    skybox.create();
    return skybox;
  }

  show() {
    var skyboxes = new Set();
    var anchor = new BABYLON.TransformNode("anchor");
    var forwardDirection = VRSPACEUI.hud.camera.getForwardRay(6).direction;
    anchor.position = VRSPACEUI.hud.camera.position.add(forwardDirection);
    anchor.rotation = new BABYLON.Vector3(VRSPACEUI.hud.camera.rotation.x, VRSPACEUI.hud.camera.rotation.y, VRSPACEUI.hud.camera.rotation.z);
    //console.log("Anchor position: ", anchor.position);
    // TODO: this often causes UI elements being below ground level
    // we could cast a ray down and calc position to put the panel on top of ground or whatever is below it

    this.panel = new BABYLON.GUI.CylinderPanel();
    this.panel.margin = .2;
    var manager = VRSPACEUI.guiManager;
    manager.addControl(this.panel);
    this.panel.linkToTransformNode(anchor);

    let index = 0;
    this.speechInput = new SpeechInput();
    VRSPACEUI.listMatchingFiles(VRSPACEUI.contentBase + "/content/skybox/", list => {
      // list is ServerFolder array
      list.forEach(sf => {
        // sf is ServerFolder object
        VRSPACEUI.listDirectory(sf.url(), skyboxDir => {
          skyboxDir.forEach(f => {
            // f is an individual file
            // name is directoryUrl+skyboxName+_axis+.jpg
            var skyboxName = f.substring(f.lastIndexOf("/") + 1, f.lastIndexOf("_"));
            // images not ending with _px, _nx etc (panoramic) do not parse well here, e.g.
            // https://localhost/content/skybox/eso_milkyway/eso0932a.jpg
            // and we get wrong name, e.g. _milkyway/ so just skip them
            if (!skyboxName.startsWith("_")) {
              // and this is what we need to create cubeTexture:
              var skyboxDir = f.substring(0, f.lastIndexOf("_"));
              //console.log(f, skyboxName, skyboxDir);
              if (!skyboxes.has(skyboxDir)) {
                skyboxes.add(skyboxDir);
                var box = this.makeSkyBox(skyboxDir);
                //box.position = new BABYLON.Vector3(skyboxes.size*2, 1, 0);
                var button = new BABYLON.GUI.MeshButton3D(box.skybox, "pushButton-" + skyboxName);
                button.onPointerDownObservable.add(() => this.sendChange(box.dir));
                this.boxes.push(box.skybox);
                this.panel.addControl(button);
                this.addText(button, index++);
              }
            }
          });
          if (this.enableSpeech) {
            //this.speechInput.addNoMatch(what=>console.log(what));
            this.speechInput.start();
          }
        }, ".jpg");
      });
    });
  }
  addText(button, index) {
    //console.log("Adding " + index, button);
    let row = Math.ceil((index+1) / this.panel.columns);
    let col = index % this.panel.columns + 1;
    let text = String.fromCharCode(64 + row)+col;
    let label = new Label(text, new BABYLON.Vector3(0, 0, -0.6), button.mesh);
    label.text = text;
    label.height = 0.2;
    label.display();
    this.speechInput.addCommand(text, () => {
      console.log("Skybox selected: " + text);
      button.onPointerDownObservable.observers.forEach(observer => observer.callback());
    });
  }
  async sendChange(dir) {
    await this.world.createSharedSkybox();
    this.world.worldManager.VRSPACE.sendEvent(this.world.sharedSkybox, { texture: dir });
  }

  hide() {
    if (this.panel) {
      this.panel.dispose();
    }
    this.boxes = [];
    if (World.lastInstance.sharedSkybox) {
      this.world.worldManager.VRSPACE.sendCommand("Activate", { className: "Background", id: World.lastInstance.sharedSkybox.id, active: false });
    }
    if (this.speechInput) {
      this.speechInput.dispose();
    }
  }

  dispose() {
    this.hide();
    this.world.removeSelectionPredicate(this.selectionPredicate);
    this.world.removeListener(this);
  }

  isSelectableMesh(mesh) {
    return this.boxes.includes(mesh);
  }

}