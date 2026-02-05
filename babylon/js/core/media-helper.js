export class MediaHelper {
  static devices = {};
  static async checkPermissions(permissionObject) {
    try {
      // prompts for permission to use camera/mic
      await navigator.mediaDevices.getUserMedia(permissionObject);
      return true;
    } catch(err) {
      console.error("User permission denied ",permissionObject, err);
      return false;
    }
  }
  static async checkAudioPermissions() {
    return await MediaHelper.checkPermissions({audio:true});
  }  
  static async checkVideoPermissions() {
    return await MediaHelper.checkPermissions({video:true});
  }  
  
  // FIXME this can return device with empty ID 
  static async selectDevice(deviceId, kind) {
    if ( deviceId ) {
      MediaHelper.devices[kind] = deviceId;
    }
    if ( ! MediaHelper.devices[kind] ) {
      try {
        var devices = await navigator.mediaDevices.enumerateDevices();
        for (var idx = 0; idx < devices.length; ++idx) {
          if (devices[idx].kind === kind) {
            console.log(devices[idx]);
            MediaHelper.devices[kind] = devices[idx].deviceId;
            break;
          }
        }
      } catch ( err ) {
        console.error(err);
      }
    }
    return MediaHelper.devices[kind];
  }
  
  static async selectVideoInput(deviceId) {
    if (await MediaHelper.checkPermissions({video:true})) {
      return await MediaHelper.selectDevice(deviceId, "videoinput");
    }
    return null;
  }
  static async selectAudioInput(deviceId) {
    if(await MediaHelper.checkPermissions({audio:true})) {
      return await MediaHelper.selectDevice(deviceId, "audioinput");
    }
    return null;
  }
}