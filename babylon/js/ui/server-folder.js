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

