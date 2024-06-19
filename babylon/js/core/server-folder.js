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
    this.url = new URL(url);

    this.fileUrl = url; // or this.url.href
    this.related = related;
    
    let pos = this.url.pathname.lastIndexOf('/');
    this.file = this.url.pathname.substring(pos+1);
    pos = this.file.indexOf('.');
    this.baseName = this.file.substring(0,pos);
    this.extension = this.file.substring(pos+1);
    
    // CHECKME: this is done only for compatibility with ServerFolder; is it used anywhere?
    pos = url.lastIndexOf('/');
    let path = url.substring(0,pos);
    pos = path.lastIndexOf('/');
    this.baseUrl = path.substring(0,pos+1);
    this.name = path.substring(pos+1);
    
  }
  getPath() {
    return this.url.pathname;
  }
}