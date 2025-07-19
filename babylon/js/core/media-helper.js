export class MediaHelper {
  static devices = {};
  static async selectDevice(deviceId, kind = "videoinput") {
    if ( deviceId ) {
      MediaHelper.devices[kind] = deviceId;
    }
    if ( ! MediaHelper.devices[kind] ) {
      try {
        // prompts for permission to use camera
        await navigator.mediaDevices.getUserMedia({video:true});
      } catch(err) {
        console.error("User permission denied ", err);
        return null;
      }
      var devices = await navigator.mediaDevices.enumerateDevices();
      for (var idx = 0; idx < devices.length; ++idx) {
        if (devices[idx].kind === kind) {
          console.log(devices[idx]);
          MediaHelper.devices[kind] = devices[idx].deviceId;
          break;
        }
      }
    }
    return MediaHelper.devices[kind];    
  } 
}