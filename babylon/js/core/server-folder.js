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
 /** 
  * Create new server file from URL string.
  * URL can be either relative or absolute, and is parsed to find the path of the file.
  */
  constructor(url, related) {
    super();

    /** Original url used to construct the instance */
    this.fileUrl = url; // or this.url.href
    /** Related file url, may be null */
    this.related = related;
    /** Path part of the url, i.e. directory and file, without protocol and host and query */
    this.pathname = null;
    /** File part of this url */
    this.file = null;
    /** Base part of the file name (i.e. without extension) */
    this.baseName = null;
    /** Extension part of the file name (after the dot) */
    this.extension = null;
    
    let start = url.indexOf('://');   
    if ( start == -1 ) {
      // relative url
      this.pathname = url.substring(0);
    } else {
      // absolute, first one is the host
      start = url.indexOf('/',start+1);
      this.pathname = url.substring(start);
    }
    let pos = url.lastIndexOf('/');
    this.file = url.substring(pos+1);

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
    return this.pathname;
  }
}