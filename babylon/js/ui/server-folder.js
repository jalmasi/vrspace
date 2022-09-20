/**
A folder with a related file (e.g. thumbnail). 
 */
export class ServerFolder {
  /**
  @param baseUrl parent folder
  @param name folder name
  @param related name of related file in the parent folder, or full path to the file
   */
  constructor( baseUrl, name, related ) {
    /** base url */
    this.baseUrl = baseUrl;
    /** folder name*/
    this.name = name;
    /** related file name */
    this.related = related;
  }
  /** returns full path of the folder */
  url() {
    return this.baseUrl+this.name;
  }
  /** Returns full path of related file */
  relatedUrl() {
    if ( this.related ) {
      if ( this.related.indexOf('/')>=0) {
        // absolute URL
        return this.related;
      }
      return this.baseUrl+this.related;
    }
    return null;
  }
  
}

export class ServerFile extends ServerFolder {
 /** Create new server file from the url*/
  constructor(url, related) {
    super();
    var pos = url.lastIndexOf('/');
    var path = url.substring(0,pos);
    this.file = url.substring(pos+1);
    pos = path.lastIndexOf('/');
    this.baseUrl = path.substring(0,pos+1);
    this.name = path.substring(pos+1);
    this.related = related;
    this.fileUrl = url;
  }
}