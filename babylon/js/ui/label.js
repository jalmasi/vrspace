/**
Text label somewhere in space.
CHECKME position of the label is actually center of the text plane
 */
export class Label {
  /**
  @param text label text
  @param position Vector3 to put label at - center of the label!
  @param parent optional parent node
   */
  constructor(text, position, parent) {
    /** Label text */
    this.text = text;
    /** Label position */
    this.position = position;
    /** Parent node */
    this.parent = parent;
    /** text color, default white */
    this.color = "white";
    /** Label height, default 1 */
    this.height = 1;
    /** default none (null), may be "transparent", "white", "rgba(50,50,200,0.5)" etc */
    this.background = null;
    /** hack for calculating background width */
    this.fontRatio=1.8;
    /** background border thickness, default 0 (no border)*/
    this.border = 0;
    /** background corner radius, default 0 */
    this.cornerRadius = 0;
    //this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    /** horizontal text alignment, default left */
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    /** vertical text alignment, default top */
    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  }

  display() {
    this.textBlock = new BABYLON.GUI.TextBlock();
    this.textBlock.text = this.text;
    this.textBlock.textHorizontalAlignment = this.horizontalAlignment;
    this.textBlock.textVerticalAlignment = this.verticalAlignment;
    this.textBlock.color = this.color;

    this.textPlane = BABYLON.MeshBuilder.CreatePlane("Text-"+this.text, {height:this.height,width:this.text.length*this.height});
    this.textPlane.parent = this.parent;
    //this.textPlane.position = new BABYLON.Vector3(this.text.length/2,this.spacing*2,0);
    this.textPlane.position = this.position;

    // this works exactly only for proportinal fonts (courrier etc)
    var width = this.textBlock.fontSizeInPixels * this.textBlock.text.length;
    var height = this.textBlock.fontSizeInPixels+2;
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      this.textPlane,
      width,
      height,
      false // mouse events disabled
    );
    this.texture.addControl(this.textBlock);
    
    if ( this.background ) {
      var back = new BABYLON.GUI.Rectangle("Background-" + this.text);
      back.horizontalAlignment = this.horizontalAlignment;
      back.background = this.background;
      back.height = (height)+"px";
      back.width = (width/this.fontRatio)+"px";
      back.cornerRadius = this.cornerRadius;
      back.thickness = this.border;
      this.texture.addControl(back); 
    }
  }
  
  dispose() {
    if ( this.textBlock ) {
      this.textBlock.dispose();
      this.textPlane.material.dispose();
      this.textPlane.dispose();
      this.texture.dispose();
      delete this.textBlock;
      delete this.textPlane;
      delete this.texture;
    }
  }
}