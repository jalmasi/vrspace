export class VRSpaceAPI {
  base = VRSPACEUI.contentBase + "/vrspace/api";
  endpoint = {
    worlds: this.base + "/worlds",
    user: this.base + "/user",
    oauth2: this.base + "/oauth2"
  }

  async verifyName(name) {
    var validName = await this.getText(this.endpoint.user + "/available?name=" + name);
    return validName === "true";
  }

  async getUserName() {
    var loginName = await this.getText(this.endpoint.user + "/name");
    console.log("User name: " + loginName);
    return loginName;
  }

  async getAuthenticated() {
    var isAuthenticated = await this.getText(this.endpoint.user + "/authenticated");
    console.log("User is authenticated: " + isAuthenticated);
    return 'true' === isAuthenticated;
  }

  async oauth2login(providerId, providerName) {
    if (this.oauth2enabled) {
      console.log(providerId, providerName);
      window.open(this.api.endpoint.oauth2 + '/login?name=' + this.userName + '&provider=' + providerId + '&avatar=' + this.avatarUrl(), '_top');
    }
  }

  async getUserObject() {
    var userObject = await this.getJson(this.endpoint.user + "/object");
    console.log("User object ", userObject);
    return userObject.User;
  }

  async getJson(url) {
    let data = await this.getText(url);
    try {
      console.log(url + ' returned ' + data);
      return JSON.parse(data);
    } catch (err) {
      console.log("JSON error: ", err);
    }
  }

  async getText(url) {
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