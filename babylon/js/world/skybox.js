/**
 * Utility class to create babylon skybox.
 */
export class Skybox {
  /**
  * @param {BABYLON.Scene} scene
  * @param {String} dir URL of the directory containing box images, babylonjs format
  * @param {number} [environmentIntensity=0] intensity of environment texture
  */
  constructor(scene,dir, environmentIntensity=0) {
    this.scene = scene;
    this.dir = dir;
    this.size = 1000;
    this.environmentIntensity = environmentIntensity;
    this.rotation = new BABYLON.Vector3(0,0,0);
    this.infiniteDistance = true;
  }
  /**
   * Create a skybox
   * 
   * @param {BABYLON.Scene} scene
   * @param {String} dir URL of the directory containing box images, babylonjs format
   * @returns mesh of the box reated
   */
  create() {
    this.skybox = BABYLON.Mesh.CreateBox("skyBox-"+this.dir, this.size, this.scene);
    this.skybox.rotation = this.rotation;
    let skyboxMaterial = new BABYLON.StandardMaterial("skyBox-"+this.dir, this.scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.disableLighting = true;
    this.skybox.material = skyboxMaterial;
    this.skybox.infiniteDistance = this.infiniteDistance;
    skyboxMaterial.reflectionTexture = new BABYLON.CubeTexture(this.dir, this.scene);
    skyboxMaterial.reflectionTexture.coordinatesMode = BABYLON.Texture.SKYBOX_MODE;

    if ( this.environmentIntensity > 0 ) {

      this.environmentTexture = new BABYLON.CubeTexture(this.dir, this.scene);
      this.environmentTexture.rotationY = this.skybox.rotation.y;
      this.scene.environmentTexture = this.environmentTexture
      this.scene.environmentIntensity = this.environmentIntensity;
      
    }
    return this;
  }
  
  setTexture(texture) {
    this.skybox.material.reflectionTexture = texture;
  }
  
  getTexture() {
    return this.skybox.material.reflectionTexture;
  }
  
  dispose() {
    if ( this.skybox ) {
      this.skybox.dispose();
    }
    // CHECKME: scene environment texture is better left as it is
  }
}