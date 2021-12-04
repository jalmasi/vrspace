import {VRSPACEUI} from './vrspace-ui.js';

/**
https://doc.babylonjs.com/extensions/meshWriter
 */
export class TextWriter {
  constructor(scene) {
    this.scene = scene;
    this._initWriter();
    /** Writer properties - scale, default font... */
    this.writerProperties = {scale:.02,defaultFont:"Arial"};
    /** Text properties, size, color etc */
    this.textProperties = {
                            anchor: "center",
                            "letter-height": 8,
                            color: "#1C3870"
                          }
    /** Position relative to parent node, default z -1 */
    this.relativePosition = new BABYLON.Vector3(0,0,-1);
    /** Rotation relative to parent, default x PI/2 */
    this.relativeRotation = new BABYLON.Vector3( -Math.PI/2, 0, 0 );
    /** Billboard mode for the text, default none */
    this.billboardMode = BABYLON.Mesh.BILLBOARDMODE_NONE;

  }
  async _initWriter() {
    if ( ! this.Writer ) {
      await VRSPACEUI.loadScriptsToDocument([ 
        "https://cdn.rawgit.com/BabylonJS/Extensions/master/MeshWriter/meshwriter.min.js"
      ]);
      this.Writer = BABYLON.MeshWriter(this.scene, this.writerProperties);
      console.log("TextWriter loaded");
    }
  }

  clear(node) {
    if ( node._text ) {
      for ( var i = 0; i < node._text.length; i++ ) {
        var row = node._text.rows[i];
        row.dispose();
      }
      node._text.root.dispose();
      delete node._text;
    }
  }
  
  async write(node, text, offset = new BABYLON.Vector3(0,0,0)) {
    await this._initWriter();
    if ( text && text.length > 0 ) {
      if ( ! node._text ) {
        node._text = {
          root: new BABYLON.TransformNode('textParent'),
          rows:[]
        };
        node._text.root.parent = node;
        node._text.root.position = this.relativePosition;
        node._text.root.billboardMode = this.billboardMode;
      }
      var textMesh = new this.Writer( text, this.textProperties );
      textMesh.getMesh().position = textMesh.getMesh().position.add(offset);
      textMesh.getMesh().rotation = this.relativeRotation;
      textMesh.getMesh().parent = node._text.root;
      
      node._text.rows.push( textMesh );
    }
  }
  
  async writeArray( node, rows ) {
    if ( rows ) {
      for ( var i = 0; i < rows.length; i++ ) {
        this.write(node, rows[i], new BABYLON.Vector3(0,-i*this.writerProperties.scale*this.textProperties["letter-height"],0));
      }
    }
  }
  
  dispose() {
    this.clear();
    this.Writer.dispose();
  }
}