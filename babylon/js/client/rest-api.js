/**
 * Class to execute REST API calls, singleton.
 * By default, we're making API calls to the same server that serves the content.
 * This can be changed by providing different apiBase URL to the constructor.
 * All methods are asynchronous but blocking calls.
 */
export class VRSpaceAPI {
  static instance = null;
  /**
   * @param apiBase Base URL for all API endpoint, defaults to /vrspace/api
   */
  constructor(apiBase = "/vrspace/api") {
    this.base = apiBase;
    VRSpaceAPI.instance = this;
    this.endpoint = {
      worlds: this.base + "/worlds",
      user: this.base + "/user",
      oauth2: this.base + "/oauth2",
      files: this.base+'/files'
    }
  }

  /**
   * Returns VRSpaceAPI instance, creates one if required.
   */
  static getInstance(apiBase) {
    if ( !VRSpaceAPI.instance ) {
      new VRSpaceAPI(apiBase);
    }
    return VRSpaceAPI.instance;
  }
  
  /**
   * Verify if given user name is valid, i.e. we can create user with that name.
   * @param name user name
   * @returns true if user name is available
   */
  async verifyName(name) {
    var validName = await this.getText(this.endpoint.user + "/available?name=" + name);
    return validName === "true";
  }

  /**
   * Returns current user name associated with the session.
   * @returns current user name, or null if user is anonymous (not logged in yet)
   */
  async getUserName() {
    var loginName = await this.getText(this.endpoint.user + "/name");
    console.log("User name: " + loginName);
    return loginName;
  }

  /**
   * Returns true if the user is authanticated
   */
  async getAuthenticated() {
    var isAuthenticated = await this.getText(this.endpoint.user + "/authenticated");
    console.log("User is authenticated: " + isAuthenticated);
    return 'true' === isAuthenticated;
  }

  /**
   * Initiates OAuth2 login with the server - opens login form with Oauth provider. 
   * Requires Oauth2 provider id as returned by listOAuthProviders().
   * @param providerId Oauth provider as defined on the server
   * @param userName user name
   * @param avatarUrl optional Avatar URL
   */
  async oauth2login(providerId, userName, avatarUrl) {
    console.log("Initiating OAuth2 login with "+providerId+" username "+userName+" and avatar "+avatarUrl);
    if ( !providerId || !userName ) {
      throw "Both providerId and userName are mandatory parameters";
    }
    window.open(this.endpoint.oauth2 + '/login?name=' + userName + '&provider=' + providerId + '&avatar=' + avatarUrl, '_top');
  }

  /** Returns object of provider id: name (e.g. github: GitHub) */
  async listOAuthProviders() {
    return this.getJson(this.endpoint.oauth2 + '/providers');    
  }
  
  /**
   * Returns User object of the current user, or null for anonymous users
   */
  async getUserObject() {
    var userObject = await this.getJson(this.endpoint.user + "/object");
    console.log("User object ", userObject);
    if (userObject) {
      return userObject.User;
    }
    return null;
  }

  /**
   * Create a world from template
   * @returns token required to access the world
   * @param worldName unique world name
   * @param templateName optional template name, a world with this name must exist on the server
   * @param isPublic default false, i.e. only invited users (having the token) can enter
   * @param isTemporary default true, i.e. world is deleted once the last user exits
   */
  async createWorldFromTemplate(worldName, templateName, isPublic=false, isTemporary=true) {
    /*
    // CHECKME: DTO?
    const params = {
      worldName: worldName,
      templateWorldName: templateName,
      isPublic: isPublic,
      isTemporary: isTemporary
    };
    */
    // FIXME: error handling
    const rawResponse = await fetch(this.endpoint.worlds+"/create?worldName="+worldName+"&templateWorldName="+templateName
    +"&isPublic="+isPublic+"&isTemporary="+isTemporary, {
      method: 'POST'//,
      //body: JSON.stringify(params)
    });
    const token = await rawResponse.text();
    console.log("Created private world "+worldName+" from template "+templateName+", access token "+token);
    return token;
  }
  
  /**
   * Internally used helper method
   */
  async getJson(url) {
    // CHECKME await
    let data = await this.getText(url);
    try {
      console.log(url + " returned '" + data + "'");
      if ( data ) {
        return JSON.parse(data);        
      } else {
        return null;
      }
    } catch (err) {
      console.log("JSON error: ", err);
    }
  }

  /**
   * Internally used helper method
   */
  async getText(url) {
    // CHECKME await
    let data = await (fetch(url)
      .then(res => {
        return res.text();
      })
      .catch(err => {
        console.log("Fetch error: ", err);
      })
    );
    return data;
  }

  /**
   * Upload a file.
   * @param file File object
   * @param position an object containing x,y,z (Vector3)
   * @param rotation an object containing x,y,z (Vector3)
   */
  upload( file, position, rotation) {
    const formData  = new FormData();
    formData.append('fileName', file.name);
    if ( file.type ) {
      formData.append('contentType', file.type);
    } else if (file.name.toLowerCase().endsWith('.glb')) {
      formData.append('contentType', 'model/gltf-binary');
    }
    formData.append('x', position.x);
    formData.append('y', position.y);
    formData.append('z', position.z);
    formData.append('rotX', rotation.x);
    formData.append('rotY', rotation.y);
    formData.append('rotZ', rotation.z);
    formData.append('fileData', file);

    fetch(this.endpoint.files+'/upload', {
      method: 'PUT',
      body: formData
    });

  }
}