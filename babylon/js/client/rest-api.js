/**
 * Class to execute REST API calls.
 * By default, we're making API calls to the same server that serves the content.
 * This can be changed by providing different apiBase URL to the constructor.
 * All methods are asynchronous but blocking calls.
 */
export class VRSpaceAPI {
  /**
   * @param apiBase Base URL for all API endpoint, defaults to /vrspace/api
   */
  constructor(apiBase = "/vrspace/api") {
    this.base = apiBase;

    this.endpoint = {
      worlds: this.base + "/worlds",
      user: this.base + "/user",
      oauth2: this.base + "/oauth2"
    }
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
   * Returns User object of the current user
   */
  async getUserObject() {
    var userObject = await this.getJson(this.endpoint.user + "/object");
    console.log("User object ", userObject);
    return userObject.User;
  }

  /**
   * Internally used helper method
   */
  async getJson(url) {
    // CHECKME await
    let data = await this.getText(url);
    try {
      console.log(url + ' returned ' + data);
      return JSON.parse(data);
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

}