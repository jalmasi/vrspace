import { Label } from './label.js';
import { RemoteBrowser } from './remote-browser.js';
import { VRSpaceAPI } from './../../client/rest-api.js'
import { VRSPACEUI } from '../vrspace-ui.js';
import { ServerCapabilities } from '../../client/openapi/model/ServerCapabilities.js';

class Link {
  constructor( text, enterWorld=false ) {
    this.url = text;
    this.enterWorld = enterWorld;
    let pos = text.indexOf("://");
    if ( pos > 0 ) {
      text = text.substring(pos+3);
    } else {
      this.url = "https://"+this.url;
    }
    pos = text.indexOf("/");
    if ( pos > 0 ) {
      this.site = text.substring(0,pos);
    } else {
      this.site = text;
    }
    console.log('new link: '+this.url+" "+this.site);
    this.label = null;
    this.buttons = [];
  }
  openHere(local) {
    if ( local ) {
      console.log("TODO: Enter the world like AvatarSelection.enterWorld does");
      let dest = URL.parse(this.url);
      window.location.href = window.location.pathname + dest.search;
    } else {
      window.location.href = this.url;
    }
  }
  openTab() {
    window.open(this.url, '_blank').focus();    
  }
  dispose() {
    this.label.dispose();
    this.buttons.forEach(b=>b.dispose());
  }
}

export class ButtonStack {
  /** @type {ServerCapabilities} */
  static serverCapablities = null;
  constructor(scene, parent, position, scaling = new BABYLON.Vector3(.02,.02,.02)) {
    this.scene = scene;
    this.parent = parent;
    this.scaling = scaling;
    this.position = position;
    this.capacity = 5;
    this.links = [];
    this.meshes = []; // XR selectables
    this.clickHandler = this.scene.onPointerObservable.add((pointerInfo) => {
      if ( pointerInfo.type == BABYLON.PointerEventTypes.POINTERDOWN
        && pointerInfo.pickInfo.hit
      ) {
        for ( let i = 0; i < this.links.length; i++ ) {
          if ( this.links[i].label.textPlane == pointerInfo.pickInfo.pickedMesh ) {
            this.clicked(this.links[i]);
            break;
          }
        }
      }
    });
    if ( ButtonStack.serverCapablities == null ) {
      VRSpaceAPI.getInstance().endpoint.server.getServerCapabilities().then(c=>ButtonStack.serverCapablities=c);
    }
  }
  
  /**
   * Add a link button to the stack, called when ChatLog finds a link in the chat.
   * @param {string} word A single word to display on the button, e.g. web site name
   * @param {boolean} enterWorld Whether the link points to another world
   */
  addLink(word, enterWorld){
    let link = new Link(word, enterWorld);
    this.scroll();
    
    // add buttons to open in new tab, this tab, optionally internal browser
    if ( enterWorld ) {
      this.addButton(link, "enter", () => link.openHere(enterWorld));
    } else {
      this.addButton(link, "external-link", () => link.openTab());
      if (ButtonStack.serverCapablities.remoteBrowser) {
        this.addButton(link, "play", () => this.openBrowser(link.url));
      }
    }

    let x = this.scaling.x*link.buttons.length+this.position.x+link.site.length/(Label.fontRatio*2)*this.scaling.x;
    let pos = new BABYLON.Vector3(x,this.position.y,this.position.z);
    let label = new Label(link.site,pos,this.parent);
    //label.background = "black";
    label.display();
    label.textPlane.scaling = this.scaling;
    link.label = label;
    
    this.links.push(link);
    this.meshes.push(label.textPlane);
    return link;
  }
  
  /**
   * @param {string} link url
   * @param {string} name Icon under /content/icons to display
   * @param {*} callback function 
   * @private 
   */
  addButton(link, name, callback) {
    let button = BABYLON.GUI.Button.CreateImageOnlyButton(name+"-"+link.site, VRSPACEUI.contentBase+"/content/icons/"+name+".png");
    let buttonPlane = BABYLON.MeshBuilder.CreatePlane(name+"-"+link.site, {height:1,width:1});
    buttonPlane.parent = this.parent;
    buttonPlane.position = new BABYLON.Vector3(this.position.x + this.scaling.x*link.buttons.length,this.position.y,this.position.z);
    buttonPlane.scaling = this.scaling;
    let buttonTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateForMesh(
      buttonPlane,
      128,
      128,
      false // mouse events disabled
    );
    buttonTexture.addControl(button);
    button.onPointerDownObservable.add( () => callback());
    link.buttons.push(buttonPlane);    
    this.meshes.push(buttonPlane);
  }
  
  /**
   * Called on click, opens the link either in a new tab, or internal browser if available
   * @private 
   * @param {Link} link 
   */
  async clicked(link) {
    // process invitations
    console.log("Clicked "+link.url);
    if ( link.enterWorld ) {
      // CHECKME
      link.openHere(true);
    } else if (ButtonStack.serverCapablities.remoteBrowser) {
      this.openBrowser(link.url);
    } else {
      link.openTab();
    }
  }
  
  /** 
   * Opens the URL in internal browser
   * @private
   * @param {string} url link to open 
   */
  openBrowser(url) {
    if ( this.browser ) {
      this.browser.dispose();
    }
    this.browser = new RemoteBrowser(this.scene);
    this.browser.show();
    //this.browser.attachToCamera();
    this.browser.attachToHud();
    if ( url.toLowerCase().endsWith(".jpg") || url.toLowerCase().endsWith(".png") ) {
      this.browser.loadUrl(url);
    } else {
      this.browser.get(url);
    }
  }

  /**
   * Scroll all buttons up to make space for a new one, keeps only this.capacity buttons.
   * @private
   */  
  scroll() {
    if ( this.links.length == this.capacity ) {
      this.links[0].dispose();
      let link = this.links.splice(0,1)[0];
      link.dispose();
    }
    for ( let i = 0; i < this.links.length; i++ ) {
      let label = this.links[i].label;
      let y = label.textPlane.position.y + label.textPlane.scaling.y*1.5;
      label.textPlane.position = new BABYLON.Vector3( label.textPlane.position.x, y, label.textPlane.position.z );
      this.links[i].buttons.forEach(b=>b.position.y = y );
    }
  }

  /**
   * Clean up all resources 
   */  
  dispose() {
    this.scene.onPointerObservable.remove(this.clickHandler);
    this.links.forEach(l=>l.dispose());
    this.meshes = [];
    if ( this.browser ) {
      this.browser.dispose();
    }
  }
  
  /**
   * XR stuff
   */
  isSelectableMesh(mesh) {
    return this.meshes.includes(mesh);
  }
}
