import { ApiClient } from './openapi/ApiClient.js';
import { GroupsApi } from './openapi/api/GroupsApi.js';
import { UsersApi } from './openapi/api/UsersApi.js';
import { WorldsApi } from './openapi/api/WorldsApi.js'
import { WebPushApi } from './openapi/api/WebPushApi.js';
import { ServerInfoApi } from './openapi/api/ServerInfoApi.js';
import { SketchfabApi } from './openapi/api/SketchfabApi.js';
import { User } from './openapi/model/User.js';

/**
 * Class to execute REST API calls, singleton.
 * By default, we're making API calls to the same server that serves the content.
 * This can be changed by providing different apiBase URL to the constructor.
 * All methods are asynchronous but blocking calls.
 */
export class VRSpaceAPI {
  static instance = null;
  /**
   * @param {string} [apiBase=""] Base URL for all API endpoint, origin (protocol+host) 
   * @param {string} [apiPath="/vrspace/api"] Path component of the API URL  
   */
  constructor(apiBase = "", apiPath = "/vrspace/api") {
    this.base = apiBase + apiPath;
    VRSpaceAPI.instance = this;
    this.apiClient = new ApiClient(apiBase);
    this.endpoint = {
      /** @type {WorldsApi} */
      worlds: new WorldsApi(this.apiClient),
      oauth2: this.base + "/oauth2",
      files: this.base + '/files',
      /** @type {UsersApi} */
      user: new UsersApi(this.apiClient),
      /** @type {GroupsApi} */
      groups: new GroupsApi(this.apiClient),
      /** @type {WebPushApi} */
      webpush: new WebPushApi(this.apiClient),
      /** @type {ServerInfoApi} */
      server: new ServerInfoApi(this.apiClient),
      /** @type {SketchfabApi} */
      sketchfab: new SketchfabApi(this.apiClient)
    }
    // does not work with node, must be imported from html:
    //ScriptLoader.getInstance(apiBase).loadScriptsToDocument(apiBase + '/babylon/js/client/openapi/superagent.js');
  }

  /**
   * Returns VRSpaceAPI instance, creates one if required.
   * @param {String|null} [apiBase] API URL base 
   * @param {String|null} [apiPath] API URL path 
   * @returns {VRSpaceAPI}
   */
  static getInstance(apiBase, apiPath) {
    if (!VRSpaceAPI.instance) {
      new VRSpaceAPI(apiBase, apiPath);
    }
    return VRSpaceAPI.instance;
  }

  /**
   * Verify if given user name is valid, i.e. we can create user with that name.
   * @param {String} name user name
   * @returns {boolean} true if user name is available
   */
  async verifyName(name) {
    return await this.endpoint.user.checkName(name);
    //var validName = await this.getText(this.endpoint.user + "/available?name=" + name);
    //return validName === "true";
  }

  /**
   * Returns current user name associated with the session.
   * @returns {String|null} current user name, or null if user is anonymous (not logged in yet)
   */
  async getUserName() {
    return await this.endpoint.user.userName();
    //var loginName = await this.getText(this.endpoint.user + "/name");
    //console.log("User name: " + loginName);
    //return loginName;
  }

  /**
   * Returns true if the user is authanticated
   * @returns {Promise<boolean>}
   */
  async getAuthenticated() {
    return await this.endpoint.user.authenticated();
    //var isAuthenticated = await this.getText(this.endpoint.user + "/authenticated");
    //console.log("User is authenticated: " + isAuthenticated);
    //return 'true' === isAuthenticated;
  }

  /**
   * Initiates OAuth2 login with the server - opens login form with Oauth provider. 
   * Requires Oauth2 provider id as returned by listOAuthProviders().
   * @param {String} providerId Oauth provider as defined on the server
   * @param {String} userName user name
   * @param {String} [avatarUrl] optional Avatar URL
   */
  async oauth2login(providerId, userName, avatarUrl) {
    console.log("Initiating OAuth2 login with " + providerId + " username " + userName + " and avatar " + avatarUrl);
    if (!providerId || !userName) {
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
   * @returns {Promise< User|null >}
   */
  async getUserObject() {
    let userObject = await this.endpoint.user.userObject();
    console.log("User object ", userObject);
    return userObject;
  }

  /**
   * Create a world from template
   * @returns token required to access the world
   * @param {String} worldName unique world name
   * @param {String|undefined} templateName optional template name, a world with this name must exist on the server
   * @param {boolean} [isPublic=false] false means only invited users (having the token) can enter
   * @param {boolean} [isTemporary=true] true means world is deleted once the last user exits 
   */
  async createWorldFromTemplate(worldName, templateName, isPublic = false, isTemporary = true) {
    let token = await this.endpoint.worlds.createWorld({
      worldName: worldName,
      templateName: templateName,
      token: crypto.randomUUID(),
      public: isPublic,
      temporary: isTemporary
    });
    console.log("Created private world " + worldName + " from template " + templateName + ", access token " + token);
    return token;
  }

  /**
   * Internally used helper method
   * @private
   */
  async getJson(url) {
    // CHECKME await
    let data = await this.getText(url);
    try {
      console.log(url + " returned '" + data + "'");
      if (data) {
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
   * @private
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
   * Upload a file on a position/rotation.
   * @param {File} file Local file object to upload
   * @param position an object containing x,y,z (Vector3)
   * @param rotation an object containing x,y,z (Vector3)
   */
  upload(file, position, rotation) {
    const formData = new FormData();
    formData.append('fileName', file.name);
    if (file.type) {
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

    fetch(this.endpoint.files + '/upload', {
      method: 'PUT',
      body: formData
    });

  }

  /**
   * Internal used by webpushSubscribe
   * @private
   */
  async unregisterSubscription(subscription) {
    window.localStorage.removeItem("vrspace-webpush-vapid-key");
    let webPushSubscription = {
      endpoint: subscription.endpoint,
      key: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
    }

    console.log('unsubscribing', subscription, webPushSubscription);

    await this.endpoint.webpush.unsubscribe(webPushSubscription);
  }

  /**
   * Internal used by webpushSubscribe
   * @private
   */
  registerSubscription(subscription, vapidPublicKey) {
    let webPushSubscription = {
      endpoint: subscription.endpoint,
      key: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
      auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
    }

    console.log('subscribing', subscription, webPushSubscription);

    this.endpoint.webpush.subscribe(webPushSubscription).then(() => {
      window.localStorage.setItem("vrspace-webpush-vapid-key", vapidPublicKey);
    });
  }

  /**
   * Internal used by webpushSubscribe
   * @private
   */
  createSubscription(registration, vapidPublicKey) {
    const convertedVapidKey = this.urlBase64ToUint8Array(vapidPublicKey);
    registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey
    }).then((subscription) => {
      console.log("Registering new subscription");
      this.registerSubscription(subscription, vapidPublicKey);
    }).catch(err => console.log(err));
  }

  /**
   * Internal used by webpushSubscribe
   * @private
   */
  urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Subcribe to web push, if available on the server. Requires existing service worker, 
   * registered in main html file onload function. Fails silently if the registration does not exist.
   * @param {String} clientUrl path to serviceworker.js 
   */
  webpushSubscribe(clientUrl) {
    // service worker is supposed to be registered in main html onload
    navigator.serviceWorker.getRegistration(clientUrl).then(async (registration) => {
      if (typeof registration === "undefined") {
        // Chrome rejects service worker with self-signed cert on localhost
        return;
      }
      console.log("Got serviceworker registration");
      // CHECKME this may not be the right place to ask for permission - dialogue does not pop up in chrome
      Notification.requestPermission().then(status => {
        if (status === 'denied') {
          console.log("Notification permission denied");
        } else if (status === 'granted') {
          console.log("Notification permission granted");
        } else {
          // status is 'default' - the user did not make choice (yet)
          console.log("Notification permission: " + status);
        }
      });
      // this will typically return 404, fail gracefully
      this.endpoint.webpush.getKey().then(async vapidPublicKey => {
        // see https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Tutorials/js13kGames/Re-engageable_Notifications_Push
        console.log('VAPID key: ' + vapidPublicKey);

        let subscription = await registration.pushManager.getSubscription();
        console.log("Got subscription from push manager", subscription);

        if (subscription) {
          // compare subscription keys and unsubscribe/subscribe if needed, or
          // DOMException: A subscription with a different application server key already exists.
          let existingKey = window.localStorage.getItem("vrspace-webpush-vapid-key");
          if (existingKey && existingKey != vapidPublicKey) {
            console.log("Subscription key changed, unsubscribing from ", subscription);
            this.unregisterSubscription(subscription);
            subscription.unsubscribe().then(() => {
              this.createSubscription(registration, vapidPublicKey);
            });
          } else {
            console.log("Registering existing subscription");
            this.registerSubscription(subscription, vapidPublicKey);
          }
        } else {
          this.createSubscription(registration, vapidPublicKey);
        }

      }).catch(err => console.log(err));

    });
  }

  /**
   * Unsubcribe from web push notifications, if available and subscribed. Requires existing service worker, 
   * registered in main html file onload function. Fails silently if the not subscribed.
   * @param {String} clientUrl path to serviceworker.js 
   */
  webpushUnsubscribe(clientUrl) {
    navigator.serviceWorker.getRegistration(clientUrl).then(async (registration) => {
      if (typeof registration === "undefined") {
        // Chrome rejects service worker with self-signed cert on localhost
        return;
      }
      console.log("Got serviceworker registration");

      let subscription = await registration.pushManager.getSubscription();
      console.log("Got subscription from push manager", subscription);

      if (subscription) {
        let existingKey = window.localStorage.getItem("vrspace-webpush-vapid-key");
        if (existingKey) {
          console.log("Unsubscribing from ", subscription);
          this.unregisterSubscription(subscription);
        }
        subscription.unsubscribe();
      }
    });
  }

}