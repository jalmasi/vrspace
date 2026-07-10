/**
Text label somewhere in space: text plane with a texture.
When horizontalAlignment is left, and autoAlign is true, display() method attempts to calculate X of the created plane,
to align left edge of the plane to the given position.
Otherwise, the position of the label is center of the text plane.
 */
export class Label {
  /** hack for calculating position/required texture size*/
  static fontRatio = 1.5;
  /**
  @param text label text
  @param position Vector3 to put label at - center of the label, or left point if autoscaling is set.
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
    /** background border thickness, default 0 (no border)*/
    this.border = 0;
    /** background corner radius, default 0 */
    this.cornerRadius = 0;
    //this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    /** horizontal text alignment, default left */
    this.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
    /** vertical text alignment, default top */
    this.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    /** hack for calculating position */
    this.fontRatio = this.constructor.fontRatio;
    /** Automatically align left - can't handle scaling yet*/
    this.autoAlign = true;
  }

  /** Set text after display() */
  setText(text) {
    this.text = text;
    this.textBlock.text = this.text;
  }
  /** Change background color after display() */
  setBackground(string) {
    this.texture.background = string;
  }
  /** Change text color after display() */
  setColor(string) {
    this.textBlock.color = string;
  }
  /**
   * Display the label: create the TextBlock, Plane, AdvancedTexture.
   */
  display() {
    this.textBlock = new BABYLON.GUI.TextBlock();
    this.textBlock.text = this.text;
    this.textBlock.textHorizontalAlignment = this.horizontalAlignment;
    this.textBlock.textVerticalAlignment = this.verticalAlignment;
    this.textBlock.color = this.color;

    this.textPlane = BABYLON.MeshBuilder.CreatePlane("Text-" + this.text, { height: this.height, width: this.text.length / this.fontRatio * this.height });
    this.textPlane.parent = this.parent;
    if (this.autoAlign && this.horizontalAlignment == BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT) {
      // FIXME this fails when scaling is used, see ButtonStack.addLabel()
      let yOffset = 2 / this.height * Label.fontRatio;
      this.textPlane.position = new BABYLON.Vector3(this.position.x + this.text.length / yOffset, this.position.y, this.position.z);
    } else {
      this.textPlane.position = this.position;
    }

    // this works exactly only for proportinal fonts (courrier etc)
    var width = this.textBlock.fontSizeInPixels / this.fontRatio * this.textBlock.text.length;
    var height = this.textBlock.fontSizeInPixels + 2;
    this.texture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      this.textPlane,
      width,
      height,
      false // mouse events disabled
    );
    this.texture.addControl(this.textBlock);

    if (this.background) {
      this.setBackground(this.background);
    }
  }

  dispose() {
    if (this.textBlock) {
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