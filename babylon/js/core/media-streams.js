/**
WebRTC video/audio streaming support, intended to be overridden by implementations.
Provides interface to WorldManager, that manages all clients and their streams.
 */

import { VRSPACE, Client } from '../client/vrspace.js';
import { SessionData } from '../client/vrspace.js';

export class MediaStreams {
  /** There can be only one @type { MediaStreams }*/
  static instance;
  static defaultDistance = 50;
  /** Default values for streaming sound, see https://doc.babylonjs.com/typedoc/interfaces/BABYLON.ISoundOptions */
  static soundProperties = {
    maxDistance: MediaStreams.defaultDistance,
    volume: 1,
    panningModel: "equalpower", // or "HRTF"
    distanceModel: "linear", // or inverse, or exponential
    maxDistance: 50, // default 50, babylon default 100, used only when linear
    rolloffFactor: 1, // default 1, used only when exponential
    refDistance: 1 // default 1, used only when exponential
  }
  /**
  @param scene Babylonjs scene
  @param {string} htmlElementName
   */
  constructor(scene, htmlElementName, streamingServerUrl) {
    if (MediaStreams.instance) {
      throw "MediaStreams already instantiated: " + MediaStreams.instance;
    }
    MediaStreams.instance = this;
    this.scene = scene;
    // CHECKME null check that element?
    /** @type {HTMLElement} */
    this.htmlElementName = htmlElementName;
    this.streamingServerUrl = streamingServerUrl;
    /** Function to play video of a client, passed client and stream. Defaults to uknownStream method.*/
    this.playStream = (client, mediaStream) => this.unknownStream(client, mediaStream);
    /** Auto start audio? Default true. @type {boolean} */
    this.startAudio = true;
    /** Auto start video? Default false. @type {boolean} */
    this.startVideo = false;
    /** Verbose WebRTC? Default false. @type {boolean} */
    this.debug = false;
    /** Audio source to use, default undefined (auto). @type {boolean|undefined} */
    this.audioSource = undefined;
    /** Video source to use, default false (disabled). @type {boolean|undefined} */
    this.videoSource = false;
    // state variables:
    this.publisher = null;
    /** Currently publishing video? @type {boolean} */
    this.publishingVideo = false;
    /** Currently publishing audio? @type {boolean} */
    this.publishingAudio = false;
    // this is to track/match clients and streams:
    /** Currently tracked clients, maintained externally (e.g. by calling streamToMesh method) @type {Array.<Client>} */
    this.clients = [];
    /** Currently tracked streams, maintained by this class (e.g. streaminStart) .*/
    this.subscribers = [];
    /** Stream listeners, currently used only for screen sharing */
    this.streamListeners = {};
  }

  /**
  Initialize streaming and attach event listeners. Intended to be overridden, default implementation throws error.
  @param callback executed when new subscriber starts playing the stream
   */
  async init(callback) {
    throw "implement me!";
  }

  /**
   * Parse the passed token
   * @param {string} token 
   */
  parseToken(token) {
    const ret = token.replaceAll('&amp;', '&');
    console.log('token: ' + token);
    return ret;
  }

  /**
  Connect to server with given parameters, calls init with callback to streamingStart method.
  @param {string} token whatever is needed to connect and initialize the session
   */
  async connect(token) {
    await this.init((subscriber, playing) => this.streamingStart(subscriber, playing));
    // FIXME: this may throw (or just log?) this.connection is undefined
    // seems to be caused by participantEvicted event
    return this.session.connect(this.parseToken(token));
  }

  /**
  Start publishing local video/audio
  FIXME opevidu implementation
  @param {string|undefined} htmlElement needed only for local feedback (testing)
   */
  publish(htmlElementName) {
    this.publisher = this.OV.initPublisher(htmlElementName, {
      videoSource: this.videoSource,     // The source of video. If undefined default video input
      audioSource: this.audioSource,     // The source of audio. If undefined default audio input
      publishAudio: this.startAudio,   // Whether to start publishing with your audio unmuted or not
      publishVideo: this.startVideo    // Should publish video?
    });

    this.publishingVideo = this.startVideo;
    this.publishingAudio = this.startAudio;

    // this is only triggered if htmlElement is specified
    this.publisher.on('videoElementCreated', e => {
      console.log("Publisher created video element:");
      console.log(e.element);
      e.element.muted = true; // mute altogether
    });

    // in test mode subscribe to remote stream that we're sending
    if (htmlElementName) {
      this.publisher.subscribeToRemote();
    }
    // publish own sound
    this.session.publish(this.publisher);
    // id of this connection can be used to match the stream with the avatar
    console.log("Publishing to connection " + this.publisher.stream.connection.connectionId);
    console.log(this.publisher);
  }

  /**
   * Share screen - subclasses need to implement it
   */
  async shareScreen(endCallback) {
    throw "implement me!";
  }

  /**
   * Stop sharing screen - subclasses need to implement it
   */
  stopSharingScreen() {
    throw "implement me!";
  }

  /**
  Enable/disable video
  @param {boolean} enabled 
   */
  publishVideo(enabled) {
    if (this.publisher) {
      console.log("Publishing video: " + enabled);
      this.publisher.publishVideo(enabled);
      this.publishingVideo = enabled;
    }
  }

  /**
  Enable/disable (mute) audio
  @param {boolean} enabled 
   */
  publishAudio(enabled) {
    if (this.publisher) {
      this.publisher.publishAudio(enabled);
      console.log("Publishing audio: " + enabled + " stream audio: " + this.publisher.stream.audioActive);
      this.publishingAudio = enabled;
    }
  }

  /**
   * Returns session data embedded in the session, used internally.
   * @returns {SessionData}
   */
  getClientData(subscriber) {
    return new SessionData(subscriber.stream.connection.data);
  }

  /**
  Retrieve VRSpace Client id from WebRTC subscriber data
  @returns {number}
   */
  getClientId(subscriber) {
    let data = this.getClientData(subscriber);
    return data.clientId;
  }

  /**
  Retrieve MediaStream from subscriber data
  @returns {MediaStream}
   */
  getStream(subscriber) {
    return subscriber.stream.getMediaStream();
  }

  /** 
   * Remove a client, called when client leaves the space
   * @param {number} clientId 
   */
  removeClient(clientId) {
    for (var i = 0;i < this.clients.length;i++) {
      if (this.clients[i].id == clientId) {
        this.clients.splice(i, 1);
        console.log("Removed client " + clientId);
        break;
      }
    }
    var oldSize = this.subscribers.length;
    // one client can have multiple subscribers, remove them all
    this.subscribers = this.subscribers.filter(subscriber => this.getClientId(subscriber) != clientId);
    console.log("Removed " + (oldSize - this.subscribers.length) + " subscribers, new size " + this.subscribers.length);
  }

  /**
   * @param {SessionData} data 
   */
  findClient(data) {
    for (var i = 0;i < this.clients.length;i++) {
      const client = this.clients[i];
      // FIXME this implies that the streamToMesh is called before streamingStart
      // this seems to always be the case, but is not guaranteed
      if (client.id == data.clientId) {
        // matched
        if (!client.streamToMesh) {
          console.log("Ignoring null streaming mesh for client " + client.id);
          continue;
        }
        return client;
      }
    }
    return null;
  }

  /** 
  Called when a new stream is received, set up  as callback in default connect and init method.
  Tries to find an existing client, and if found, calls attachAudioStream and attachVideoStream.
  @param {*} subscriber
  @param {boolean} playing false if stream is created but not yet playing, true when starts playing 
   */
  streamingStart(subscriber, playing) {
    console.log("streamingStart " + playing, subscriber);
    if (!playing) {
      // stream is created but not playing, just return for backwards compatibility
      return;
    }
    var data = this.getClientData(subscriber);
    console.log("streamingStart " + playing, data);
    if ("main" == data.type) {
      console.log("Stream started for client", data);
      const client = this.findClient(data);
      if (client) {
        this.attachAudioStream(client.streamToMesh, this.getStream(subscriber));
        //this.clients.splice(i,1); // too eager, we may need to keep it for another stream
        console.log("Audio/video stream started for avatar of client ", data);
        this.attachVideoStream(client, subscriber);
      }
      this.subscribers.push(subscriber);
    } else if ("screen" == data.type) {
      if (this.streamListeners[data.clientId]) {
        console.log("Stream started for share", data);
        this.streamListeners[data.clientId](this.getStream(subscriber));
      } else {
        console.log("No stream listeners found", data);
      }
    } else {
      console.log("Unknown stream type", data);
    }
  }

  /** 
  Called when a new client enters the space (in WorldManager). 
  Tries to find an existing stream, and if found, calls attachAudioStream and attachVideoStream.
  @param {Client} client
  @param {*} mesh babylonjs mesh
   */
  streamToMesh(client, mesh) {
    if (client.streamToMesh) {
      console.log("Already streaming to avatar of client " + client.id + " - stream ignored");
      return;
    }
    console.log("Streaming to avatar of client " + client.id + " of " + this.subscribers.length, mesh);
    if (!mesh) {
      throw "Null mesh";
    }
    client.streamToMesh = mesh;
    for (let i = 0;i < this.subscribers.length;i++) {
      let subscriber = this.subscribers[i];
      let data = this.getClientData(subscriber);
      console.log(data);
      if (client.id == data.clientId) {
        // matched
        let mediaStream = this.getStream(subscriber);
        if (mediaStream) {
          this.attachAudioStream(mesh, mediaStream);
          this.attachVideoStream(client, subscriber);
          //this.subscribers.splice(i,1);
          console.log("Audio/video stream connected to avatar of client ", data);
          //break; // don't break, there may be multiple streams
        } else {
          console.log("Streaming not yet started, delaying ", data);
        }
      }
    }
    this.clients.push(client);
  }

  /**
  Creates babylon Sound object from the stream with default parameters, and attaches it to the mesh (e.g. avatar).
  Called internally by streamToMesh.
  @param mesh babylon mesh to attach to
  @param mediaStream MediaStream to attach
  @param options custom sound options, defaults to soundProperties, see https://doc.babylonjs.com/typedoc/interfaces/BABYLON.ISoundOptions
  @returns created babylon Sound object, or null if stream contains no audio tracks
   */
  attachAudioStream(mesh, mediaStream, options = MediaStreams.soundProperties) {
    let audioTracks = mediaStream.getAudioTracks();
    if (audioTracks && audioTracks.length > 0) {
      //console.log("Attaching audio stream to mesh "+mesh.id, audioTracks[0]);
      let properties = {
        loop: false,
        autoplay: true,
        spatialSound: true,
        streaming: true
      }
      for (let p of Object.keys(options)) {
        properties[p] = options[p];
      }

      let name = "stream:" + mesh.name;
      if (typeof mesh.VRObject != "undefined" && typeof mesh.VRObject.getNameOrId == "function") {
        name = "voice:" + mesh.VRObject.getNameOrId();
      }
      let voice = new BABYLON.Sound(
        name,
        mediaStream,
        this.scene,
        null, // callback 
        properties
      );
      voice.attachToMesh(mesh); // sets voice._connectedTransformNode = mesh

      // all sounds go here:
      //console.log("Scene main sound track", scene.mainSoundTrack, mesh); // and scene.mainSoundTrack.soundColection array contains all sounds

      // not used:
      //console.log("Scene sound tracks", scene.soundTracks);
      //console.log("Scene sounds", scene.sounds);
      return voice;
    }
    return null;
  }

  /**
  Attaches a videoStream to a VideoAvatar. Also attaches video properties change event handler, to display video/alt text.
  Called internally by streamToMesh.
  @param {Client} client Client that streams
   */
  attachVideoStream(client, subscriber) {
    var mediaStream = subscriber.stream.getMediaStream();
    // CHECKME: this doesn't always trigger
    // maybe use getVideoTracks() instead?
    if (client.video && client.avatar.video) {
      // optional: also stream video as diffuseTexture
      if (subscriber.stream.hasVideo && subscriber.stream.videoActive) {
        console.log("Streaming video texture")
        client.avatar.displayStream(mediaStream);
      }
    } else {
      this.playStream(client, mediaStream);
    }
  }

  /**
   * Default play stream implementation - logs error message.
   */
  unknownStream(client, mediaStream) {
    console.log("Can't attach video stream to " + client.id + " - not a video avatar");
  }

  addStreamListener(clientId, listener) {
    this.streamListeners[clientId] = listener;
  }

  removeStreamListener(clientId) {
    delete this.streamListeners[clientId];
  }

  /**
   * Close the session and clean up all resources - subclasses need to implement it
   */
  close() {
    throw "implement me!";
  }
}

/**
OpenVidu implementation of MediaStreams.
@extends MediaStreams
 */
export class OpenViduStreams extends MediaStreams {

  /** @returns {OpenViduStreams} */
  static getInstance(scene, htmlElementName, streamingServerUrl) {
    if (!MediaStreams.instance) {
      MediaStreams.instance = new OpenViduStreams(scene, htmlElementName, streamingServerUrl);
    }
    return MediaStreams.instance;
  }

  /**
   * Method connects calls init
   * @param {*} callback function that gets called when stream is created (subscriber,false), starts playing (subscriber,true), and is destroyed (SessionData, undefined)
   */
  async init(callback) {
    this.OV = new OpenVidu();
    if (!this.debug) {
      this.OV.enableProdMode(); // Disable logging
    }
    this.session = this.OV.initSession();
    /*
    // hack session to work with reverse proxy
    // not required, may be handy for troubleshooting
    if (this.streamingServerUrl) {
        this.session.originalProcessToken = this.session.processToken;
        this.session.processToken = (token) => {
            this.session.originalProcessToken(token);
            console.log("wsUri: " + this.OV.wsUri);
            // replace host/port from token with real server host/port
            const url = new URL(this.streamingServerUrl);
            let portPart = "";
            if (url.port) {
                portPart = ":" + url.port;
            }
            this.OV.wsUri = "wss://" + url.hostname + portPart + "/openvidu";
            this.OV.httpUri = "https://" + url.hostname + portPart;
            console.log("wsUri: " + this.OV.wsUri);
        };
    }
    */
    this.session.on('streamCreated', (event) => {
      // client id can be used to match the stream with the avatar
      // server sets the client id as connection user data
      console.log("New stream " + event.stream.connection.connectionId + " for " + event.stream.connection.data)
      console.log(event);
      var subscriber = this.session.subscribe(event.stream, this.htmlElementName);
      subscriber.on('videoElementCreated', e => {
        console.log("Subscriber created video element:");
        console.log(e.element);
        e.element.muted = true; // mute altogether
      });
      subscriber.on('streamPlaying', event => {
        console.log('remote stream playing');
        console.log(event);
        if (callback) {
          // stream is playing
          callback(subscriber, true);
        }
      });
      subscriber.on('streamPropertyChanged', event => {
        // "videoActive", "audioActive", "videoDimensions" or "filter"
        console.log('Stream property changed: ');
        console.log(event);
        if (event.changedProperty === 'videoActive') {
          const sessionData = new SessionData(event.stream.connection.data);
          const client = this.findClient(sessionData);
          if (client && client.avatar.video) {
            const mediaStream = event.stream.connection.stream.mediaStream;
            if (event.newValue && event.stream.hasVideo) {
              client.avatar.displayStream(mediaStream);
            } else {
              client.avatar.displayAlt();
            }
          } else {
            console.log("Cannot activate video for client - not a video avatar", client);
          }
        }
      });
      if (callback) {
        // stream is created but not playing
        callback(subscriber, false);
      }
    });

    // On every new Stream destroyed...
    this.session.on('streamDestroyed', (event) => {
      // TODO remove from the scene
      console.log("Stream destroyed! TODO clean up");
      //event.stream.connection.data contains the client
      console.log(event);
      const sessionData = new SessionData(event.stream.connection.data);
      this.removeClient(sessionData.clientId);
      if (callback) {
        callback(sessionData);
      }
    });
  }

  /**
   * Close the session and clean up all resources
   */
  close() {
    if (this.session) {
      try {
        this.session.disconnect();
      } catch (err) {
        console.error(err);
      }
    }
    if (this.screenSession) {
      try {
        this.screenSession.disconnect();
      } catch (err) {
        console.error(err);
      }
    }
  }

  /**
   * Share screen implementation
   * @param {*} endCallback function called when screen sharing stops
   */
  async shareScreen(endCallback) {
    let token = await VRSPACE.startStreaming();
    this.screenOV = new OpenVidu();
    if (!this.debug) {
      this.screenOV.enableProdMode(); // Disable logging
    }
    this.screenSession = this.screenOV.initSession();

    this.screenPublisher = this.screenOV.initPublisher(this.htmlElementName, {
      videoSource: "screen",
      // allows share screen audio in Chrome/Edge 
      audioSource: "screen"
      //publishAudio: true
    });

    await this.screenSession.connect(token);

    return new Promise((resolve, reject) => {

      this.screenPublisher.once('accessAllowed', (event) => {
        this.screenPublisher.stream.getMediaStream().getVideoTracks()[0].addEventListener('ended', () => {
          console.log('User pressed the "Stop sharing" button');
          this.screenPublisher = null;
          // CHECKME: this may be too aggressive:
          //VRSPACE.stopStreaming();
          if (endCallback) {
            endCallback();
          }
        });
        this.screenPublisher.on('videoElementCreated', e => {
          resolve(this.screenPublisher.stream.getMediaStream());
        });
        this.screenSession.publish(this.screenPublisher);
        console.log("Publishing screen to connection " + this.screenPublisher.stream.connection.connectionId);
        console.log(this.screenPublisher);
      });

      this.screenPublisher.once('accessDenied', (event) => {
        console.warn('ScreenShare: Access Denied');
        this.screenPublisher = null;
        reject(event);
      });

    });
  }

  /**
   * Stops the sharing.
   */
  stopSharingScreen() {
    if (this.screenPublisher) {
      // FIXME: The associated Connection object of this Publisher is null
      // happens when shared window is closed?
      try {
        this.screenSession.unpublish(this.screenPublisher);
      } catch (error) {
        console.error(error);
      }
      this.screenPublisher = null;
    }
  }

}
