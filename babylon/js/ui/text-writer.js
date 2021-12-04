import {VRSPACEUI} from './vrspace-ui.js';

export class TextWriter {
  constructor(scene) {
    this.scene = scene;
    this._initWriter();
  }
  // https://doc.babylonjs.com/extensions/meshWriter
  async _initWriter() {
    if ( ! this.Writer ) {
      await VRSPACEUI.loadScriptsToDocument([ 
        "https://cdn.rawgit.com/BabylonJS/Extensions/master/MeshWriter/meshwriter.min.js"
      ]);
      this.Writer = BABYLON.MeshWriter(this.scene, {scale:.02,defaultFont:"Arial"});
      console.log("TextWriter loaded");
    }
  }
  
  async write(node, text) {
    await this._initWriter();
    if ( node.textMesh ) {
      node.textMesh.dispose();
      node.textParent.dispose();
      delete node.textMesh;
      delete node.textParent;
    }
    if ( text && text.length > 0 ) {
      node.textMesh = new this.Writer(
                          text,
                          {
                              anchor: "center",
                              "letter-height": 8,
                              color: "#1C3870"
                          }
                      );
      node.textParent = new BABYLON.TransformNode('textParent');
      node.textParent.parent = node.node; // CHECKME
      node.textParent.position.z = -1;
      
      node.textMesh.getMesh().rotation.x = -Math.PI/2;
      node.textMesh.getMesh().parent = node.textParent;
    }
  }
}