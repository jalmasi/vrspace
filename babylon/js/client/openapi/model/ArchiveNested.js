/**
 * OpenAPI definition
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: v0
 * 
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 *
 */

import {ApiClient} from '../ApiClient.js';

/**
 * The ArchiveNested model module.
 * @module model/ArchiveNested
 * @version v0
 */
export class ArchiveNested {
    /**
     * Constructs a new <code>ArchiveNested</code>.
     * @alias ArchiveNested
     */
    constructor() { 
        
        
        /** textureCount 
         * @type {Number} 
         */
        this.textureCount = undefined;

        /** size 
         * @type {Number} 
         */
        this.size = undefined;

        /** type 
         * @type {String} 
         */
        this.type = undefined;

        /** textureMaxResolution 
         * @type {Number} 
         */
        this.textureMaxResolution = undefined;

        /** faceCount 
         * @type {Number} 
         */
        this.faceCount = undefined;

        /** vertexCount 
         * @type {Number} 
         */
        this.vertexCount = undefined;
        
        
        
        
        ArchiveNested.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>ArchiveNested</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {ArchiveNested} obj Optional instance to populate.
     * @return {ArchiveNested} The populated <code>ArchiveNested</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new ArchiveNested();

            if (data.hasOwnProperty('textureCount')) {
                obj['textureCount'] = ApiClient.convertToType(data['textureCount'], 'Number');
            }
            if (data.hasOwnProperty('size')) {
                obj['size'] = ApiClient.convertToType(data['size'], 'Number');
            }
            if (data.hasOwnProperty('type')) {
                obj['type'] = ApiClient.convertToType(data['type'], 'String');
            }
            if (data.hasOwnProperty('textureMaxResolution')) {
                obj['textureMaxResolution'] = ApiClient.convertToType(data['textureMaxResolution'], 'Number');
            }
            if (data.hasOwnProperty('faceCount')) {
                obj['faceCount'] = ApiClient.convertToType(data['faceCount'], 'Number');
            }
            if (data.hasOwnProperty('vertexCount')) {
                obj['vertexCount'] = ApiClient.convertToType(data['vertexCount'], 'Number');
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>ArchiveNested</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>ArchiveNested</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['type'] && !(typeof data['type'] === 'string' || data['type'] instanceof String)) {
            throw new Error("Expected the field `type` to be a primitive type in the JSON string but got " + data['type']);
        }

        return true;
    }


}





export default ArchiveNested;

