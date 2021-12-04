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
    if ( node._textRows ) {
      for ( var i = 0; i < node._textRows.length; i++ ) {
        var row = node._textRows[i];
        row.mesh.dispose();
        row.parent.dispose();
      }
      delete node._textRows;
    }
  }
  
  async write(node, text, offset = new BABYLON.Vector3(0,0,0)) {
    await this._initWriter();
    if ( text && text.length > 0 ) {
      if ( ! node._textRows ) {
        node._textRows = [];
      }
      var textMesh = new this.Writer( text, this.textProperties );
      var textParent = new BABYLON.TransformNode('textParent');
      textParent.parent = node;
      textParent.position = this.relativePosition.add(offset);
      
      textMesh.getMesh().rotation = this.relativeRotation;
      textMesh.getMesh().parent = textParent;
      
      node._textRows.push( {mesh:textMesh, parent:textParent} );
    }
  }
  
  async writeArray( node, rows ) {
    if ( rows ) {
      var textRows = [];
      for ( var i = 0; i < rows.length; i++ ) {
        var row = this.write(node, rows[i], new BABYLON.Vector3(0,-i*this.writerProperties.scale*this.textProperties["letter-height"],0));
        textRows.push(row);
      }
    }
  }
}