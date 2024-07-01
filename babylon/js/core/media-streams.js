/**
WebRTC video/audio streaming support, intended to be overridden by implementations.
Provides interface to WorldManager, that manages all clients and their streams.
 */
export class MediaStreams {
  /** There can be only one */
  static instance;
  /**
  @param scene
  @param htmlElementName
   */
  constructor(scene, htmlElementName) {
    if ( MediaStreams.instance ) {
      throw "MediaStreams already instantiated: "+instance;
    }
    MediaStreams.instance = this;
    this.scene = scene;
    // CHECKME null check that element?
    this.htmlElementName = htmlElementName;
    /** function to play video of a client */
    this.playStream = ( client, mediaStream ) => this.unknownStream( client, mediaStream );
    this.startAudio = true;
    this.startVideo = false;
    // state variables:
    this.audioSource = undefined; // use default
    this.videoSource = false;     // disabled
    this.publisher = null;
    this.publishingVideo = false;
    this.publishingAudio = false;
    // this is to track/match clients and streams:
    this.clients = [];
    this.subscribers = [];
    this.streamListeners = {};
  }
  
  /**
  Initialize streaming and attach event listeners. Intended to be overridden, default implementation throws error.
  @param callback executed when new subscriber starts playing the stream
   */
  async init( callback ) {
    throw "implement me!";
  }

  /**
  Connect to server with given parameters, calls init.
  @param token whatever is needed to connect and initialize the session
   */  
  async connect(token) {
    token = token.replaceAll('&amp;','&');
    console.log('token: '+token);
    await this.init((subscriber) => this.streamingStart(subscriber));
    return this.session.connect(token);
  }
  
  /**
  Start publishing local video/audio
  @param htmlElement needed only for local feedback (testing)
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
      console.log("Video element created:");
      console.log(e.element);
      e.element.muted = true; // mute altogether
    });

    // in test mode subscribe to remote stream that we're sending
    if ( htmlElementName ) {
      this.publisher.subscribeToRemote(); 
    }
    // publish own sound
    this.session.publish(this.publisher);
    // id of this connection can be used to match the stream with the avatar
    console.log("Publishing to connection "+this.publisher.stream.connection.connectionId);
    console.log(this.publisher);
  }

  async shareScreen(endCallback) {
    // do NOT share audio with the screen - already shared
    var screenPublisher = this.OV.initPublisher(this.htmlElementName, { 
      videoSource: "screen", 
      audioSource: false, 
      publishAudio: false
    });
    
    return new Promise( (resolve, reject) => {
    
      screenPublisher.once('accessAllowed', (event) => {
          screenPublisher.stream.getMediaStream().getVideoTracks()[0].addEventListener('ended', () => {
              console.log('User pressed the "Stop sharing" button');
              if ( endCallback ) {
                endCallback();
              }
          });
          this.session.unpublish(this.publisher);
          this.publisher = screenPublisher;
          this.publisher.on('videoElementCreated', e => {
            resolve(this.publisher.stream.getMediaStream());
          });
          this.session.publish(this.publisher);
      });
  
      screenPublisher.once('accessDenied', (event) => {
          console.warn('ScreenShare: Access Denied');
          reject(event);
      });
    
    });
  }
  
  stopSharingScreen() {
    this.session.unpublish(this.publisher);
    this.publish();
  }
  
  /**
  Enable/disable video
   */
  publishVideo(enabled) {
    if ( this.publisher ) {
      console.log("Publishing video: "+enabled);
      this.publisher.publishVideo(enabled);
      this.publishingVideo = enabled;
    }
  }

  /**
  Enable/disable (mute) audio
   */
  publishAudio(enabled) {
    if ( this.publisher ) {
      console.log("Publishing audio: "+enabled);
      this.publisher.publishAudio(enabled);
      this.publishingAudio = enabled;
    }
  }
  
  /**
  Retrieve VRSpace Client id from WebRTC subscriber data
   */
  getClientId(subscriber) {
    return parseInt(subscriber.stream.connection.data,10);
  }
  
  /**
  Retrieve MediaStream from subscriber data
   */
  getStream(subscriber) {
    return subscriber.stream.getMediaStream();
  }

  /** Remove a client, called when client leaves the space */
  removeClient( client ) {
    for ( var i = 0; i < this.clients.length; i++) {
      if ( this.clients[i].id == client.id ) {
        this.clients.splice(i,1);
        console.log("Removed client "+client.id);
        break;
      }
    }
    var oldSize = this.subscribers.length;
    // one client can have multiple subscribers, remove them all
    this.subscribers = this.subscribers.filter(subscriber => this.getClientId(subscriber) != client.id);
    console.log("Removed "+(oldSize-this.subscribers.length)+" subscribers, new size "+this.subscribers.length);
  }
  
  /** 
  Called when a new stream is received. 
  Tries to find an existing client, and if found, calls attachAudioStream and attachVideoStream.
   */
  streamingStart( subscriber ) {
    var id = this.getClientId(subscriber);
    console.log("Stream started for client "+id)
    for ( var i = 0; i < this.clients.length; i++) {
      var client = this.clients[i];
      if ( client.id == id ) {
        // matched
        this.attachAudioStream(client.streamToMesh, this.getStream(subscriber));
        //this.clients.splice(i,1); // too eager, we may need to keep it for another stream
        console.log("Audio/video stream started for avatar of client "+id)
        this.attachVideoStream(client, subscriber);
        break;
      }
    }
    this.subscribers.push(subscriber);
  }
  
  /** 
  Called when a new client enters the space. 
  Tries to find an existing stream, and if found, calls attachAudioStream and attachVideoStream.
   */
  streamToMesh(client, mesh) {
    console.log("Loaded avatar of client "+client.id)
    client.streamToMesh = mesh;
    for ( var i = 0; i < this.subscribers.length; i++) {
      var subscriber = this.subscribers[i];
      var id = this.getClientId(subscriber);
      if ( client.id == id ) {
        // matched
        this.attachAudioStream(mesh, this.getStream(subscriber));
        this.attachVideoStream(client, subscriber);
        //this.subscribers.splice(i,1);
        console.log("Audio/video stream connected to avatar of client "+id)
        //break; // don't break, there may be multiple streams
      }
    }
    this.clients.push(client);
  }

  /**
  Attaches an audio stream to a mesh (e.g. avatar)
   */
  attachAudioStream(mesh, mediaStream) {
    var audioTracks = mediaStream.getAudioTracks();
    if ( audioTracks && audioTracks.length > 0 ) {
      // console.log("Attaching audio stream to mesh "+mesh.id);
      var voice = new BABYLON.Sound(
        "voice",
        mediaStream,
        this.scene, null, {
          loop: false,
          autoplay: true,
          spatialSound: true,
          streaming: true,
          distanceModel: "linear",
          maxDistance: 50, // default 100, used only when linear
          panningModel: "equalpower" // or "HRTF"
        });
      voice.attachToMesh(mesh);
    }
  }
  
  /**
  Attaches a videoStream to a VideoAvatar
  @param client Client that streams
   */
  attachVideoStream(client, subscriber) {
    var mediaStream = subscriber.stream.getMediaStream();
    // CHECKME: this doesn't always trigger
    if ( client.video ) {
      // optional: also stream video as diffuseTexture
      if ( subscriber.stream.hasVideo && subscriber.stream.videoActive) {
        console.log("Streaming video texture")
        client.video.displayStream(mediaStream);
      }
      subscriber.on('streamPropertyChanged', event => {
        // "videoActive", "audioActive", "videoDimensions" or "filter"
        console.log('Stream property changed: ');
        console.log(event);
        if ( event.changedProperty === 'videoActive') {
          if ( event.newValue && event.stream.hasVideo ) {
            client.video.displayStream(mediaStream);
          } else {
            client.video.displayAlt();
          }
        }
      });
    } else if (this.streamListeners[client.id]) {
      this.streamListeners[client.id](mediaStream);
    } else {
      this.playStream(client, mediaStream );
    }
  }
  
  unknownStream( client, mediaStream ) {
    console.log("Can't attach video stream to "+client.id+" - not a video avatar");
  }

  addStreamListener(clientId, listener) {
    this.streamListeners[clientId] = listener;
  }
  
  removeStreamListener(clientId) {
    delete this.streamListeners[clientId];
  }
}

/**
OpenVidu implementation of MediaStreams.
@extends MediaStreams
 */
export class OpenViduStreams extends MediaStreams {
  async init(callback) {
    // CHECKME: utilize CDN
    //await import(/* webpackIgnore: true */ 'https://cdn.jsdelivr.net/npm/openvidu-browser@2.17.0/lib/index.min.js');
    await import(/* webpackIgnore: true */ '../lib/openvidu-browser-2.17.0.min.js');
    this.OV = new OpenVidu();
    this.OV.enableProdMode(); // Disable logging
    this.session = this.OV.initSession();
    this.session.on('streamCreated', (event) => {
      // client id can be used to match the stream with the avatar
      // server sets the client id as connection user data
      console.log("New stream "+event.stream.connection.connectionId+" for "+event.stream.connection.data)
      console.log(event);
      var subscriber = this.session.subscribe(event.stream, this.htmlElementName);
      subscriber.on('videoElementCreated', e => {
        console.log("Video element created:");
        console.log(e.element);
        e.element.muted = true; // mute altogether
      });
      subscriber.on('streamPlaying', event => {
        console.log('remote stream playing');
        console.log(event);
        if ( callback ) {
          callback( subscriber );
        }
      });
    });
  
    // On every new Stream destroyed...
    this.session.on('streamDestroyed', (event) => {
      // TODO remove from the scene
      console.log("Stream destroyed!")
      console.log(event);
    });
  }  
}
