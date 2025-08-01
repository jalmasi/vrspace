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
import { Cursors } from './Cursors.js';
import { ModelSearchList } from './ModelSearchList.js';

/**
 * The ModelSearchResponse model module.
 * @module model/ModelSearchResponse
 * @version v0
 */
export class ModelSearchResponse {
    /**
     * Constructs a new <code>ModelSearchResponse</code>.
     * Model search response, returned as received from sketchfab
     * @alias ModelSearchResponse
     */
    constructor() { 
        
        
        /** next 
         * @type {String} 
         */
        this.next = undefined;

        /** previous 
         * @type {String} 
         */
        this.previous = undefined;

        /** cursors 
         * @type {Cursors} 
         */
        this.cursors = undefined;

        /** results 
         * @type {Array.<ModelSearchList>} 
         */
        this.results = undefined;
        
        
        
        
        ModelSearchResponse.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>ModelSearchResponse</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {ModelSearchResponse} obj Optional instance to populate.
     * @return {ModelSearchResponse} The populated <code>ModelSearchResponse</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new ModelSearchResponse();

            if (data.hasOwnProperty('next')) {
                obj['next'] = ApiClient.convertToType(data['next'], 'String');
            }
            if (data.hasOwnProperty('previous')) {
                obj['previous'] = ApiClient.convertToType(data['previous'], 'String');
            }
            if (data.hasOwnProperty('cursors')) {
                obj['cursors'] = Cursors.constructFromObject(data['cursors']);
            }
            if (data.hasOwnProperty('results')) {
                obj['results'] = ApiClient.convertToType(data['results'], [ModelSearchList]);
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>ModelSearchResponse</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>ModelSearchResponse</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['next'] && !(typeof data['next'] === 'string' || data['next'] instanceof String)) {
            throw new Error("Expected the field `next` to be a primitive type in the JSON string but got " + data['next']);
        }
        // ensure the json data is a string
        if (data['previous'] && !(typeof data['previous'] === 'string' || data['previous'] instanceof String)) {
            throw new Error("Expected the field `previous` to be a primitive type in the JSON string but got " + data['previous']);
        }
        // validate the optional field `cursors`
        if (data['cursors']) { // data not null
          Cursors.validateJSON(data['cursors']);
        }
        if (data['results']) { // data not null
            // ensure the json data is an array
            if (!Array.isArray(data['results'])) {
                throw new Error("Expected the field `results` to be an array in the JSON data but got " + data['results']);
            }
            // validate the optional field `results` (array)
            for (const item of data['results']) {
                ModelSearchList.validateJSON(item);
            };
        }

        return true;
    }


}





export default ModelSearchResponse;

