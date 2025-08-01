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
 * The ModelSearchRequest model module.
 * @module model/ModelSearchRequest
 * @version v0
 */
export class ModelSearchRequest {
    /**
     * Constructs a new <code>ModelSearchRequest</code>.
     * Sketchfab model search API parameters, passed to sketchfab as it is. Most  interesting parameters are: q, animated, rigged
     * @alias ModelSearchRequest
     */
    constructor() { 
        
        
        /** q 
         * Space separated keywords
         * @type {String} 
         */
        this.q = undefined;

        /** user 
         * Searches models by a user (sketchfab username)
         * @type {String} 
         */
        this.user = undefined;

        /** tags 
         * @type {Array.<String>} 
         */
        this.tags = undefined;

        /** categories 
         * @type {Array.<String>} 
         */
        this.categories = undefined;

        /** date 
         * Limit search to a specific period only (in days)
         * @type {Number} 
         */
        this.date = undefined;

        /** downloadable 
         * Always true
         * @type {Boolean} 
         */
        this.downloadable = undefined;

        /** animated 
         * @type {Boolean} 
         */
        this.animated = undefined;

        /** staffpicked 
         * @type {Boolean} 
         */
        this.staffpicked = undefined;

        /** min_face_count 
         * @type {Number} 
         */
        this.min_face_count = undefined;

        /** max_face_count 
         * @type {Number} 
         */
        this.max_face_count = undefined;

        /** pbr_type 
         * Filter by PBR type. Set to metalness to search Metalness/Roughness models  only. Set to specular to search Specular/Glossiness models only. Set to true  to search PBR models only. Set to false to search non-PBR models only.
         * @type {String} 
         */
        this.pbr_type = undefined;

        /** rigged 
         * @type {Boolean} 
         */
        this.rigged = undefined;

        /** collection 
         * Searches models by collection (uid)
         * @type {String} 
         */
        this.collection = undefined;

        /** sort_by 
         * How to sort results. When omitted, results are sorted by relevance. One of  likeCount, -likeCount, viewCount, -viewCount, publishedAt, -publishedAt,  processedAt, -processedAt
         * @type {String} 
         */
        this.sort_by = undefined;

        /** file_format 
         * Irrelevant, we always deal with GLTF
         * @type {String} 
         */
        this.file_format = undefined;

        /** license 
         * One of by, by-sa, by-nd, by-nc, by-nc-sa, by-nc-nd, cc0, ed, st
         * @type {String} 
         */
        this.license = undefined;

        /** max_uv_layer_count 
         * @type {Number} 
         */
        this.max_uv_layer_count = undefined;

        /** available_archive_type 
         * @type {String} 
         */
        this.available_archive_type = undefined;

        /** archives_max_size 
         * @type {Number} 
         */
        this.archives_max_size = undefined;

        /** archives_max_face_count 
         * @type {Number} 
         */
        this.archives_max_face_count = undefined;

        /** archives_max_vertex_count 
         * @type {Number} 
         */
        this.archives_max_vertex_count = undefined;

        /** archives_max_texture_count 
         * @type {Number} 
         */
        this.archives_max_texture_count = undefined;

        /** archives_texture_max_resolution 
         * @type {Number} 
         */
        this.archives_texture_max_resolution = undefined;

        /** archives_flavours 
         * If true, returns all archives flavours, listed by archive type, and sorted by  texture resolution (descending). If false, only the texture with the highest  reslution is returned for each archive type.
         * @type {Boolean} 
         */
        this.archives_flavours = undefined;

        /** count 
         * Items displayed per page, seems ignored by sketchfab but returned in paging
         * @type {Number} 
         */
        this.count = undefined;

        /** cursor 
         * Starting item number, used for paging.
         * @type {Number} 
         */
        this.cursor = undefined;

        /** type 
         * Constant, type=models
         * @type {String} 
         */
        this.type = undefined;
        
        
        
        
        ModelSearchRequest.initialize(this);
    }

    /**
     * Initializes the fields of this object.
     * This method is used by the constructors of any subclasses, in order to implement multiple inheritance (mix-ins).
     * Only for internal use.
     */
    static initialize(obj) { 
    }

    /**
     * Constructs a <code>ModelSearchRequest</code> from a plain JavaScript object, optionally creating a new instance.
     * Copies all relevant properties from <code>data</code> to <code>obj</code> if supplied or a new instance if not.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @param {ModelSearchRequest} obj Optional instance to populate.
     * @return {ModelSearchRequest} The populated <code>ModelSearchRequest</code> instance.
     */
    static constructFromObject(data, obj) {
        if (data) {
            obj = obj || new ModelSearchRequest();

            if (data.hasOwnProperty('q')) {
                obj['q'] = ApiClient.convertToType(data['q'], 'String');
            }
            if (data.hasOwnProperty('user')) {
                obj['user'] = ApiClient.convertToType(data['user'], 'String');
            }
            if (data.hasOwnProperty('tags')) {
                obj['tags'] = ApiClient.convertToType(data['tags'], ['String']);
            }
            if (data.hasOwnProperty('categories')) {
                obj['categories'] = ApiClient.convertToType(data['categories'], ['String']);
            }
            if (data.hasOwnProperty('date')) {
                obj['date'] = ApiClient.convertToType(data['date'], 'Number');
            }
            if (data.hasOwnProperty('downloadable')) {
                obj['downloadable'] = ApiClient.convertToType(data['downloadable'], 'Boolean');
            }
            if (data.hasOwnProperty('animated')) {
                obj['animated'] = ApiClient.convertToType(data['animated'], 'Boolean');
            }
            if (data.hasOwnProperty('staffpicked')) {
                obj['staffpicked'] = ApiClient.convertToType(data['staffpicked'], 'Boolean');
            }
            if (data.hasOwnProperty('min_face_count')) {
                obj['min_face_count'] = ApiClient.convertToType(data['min_face_count'], 'Number');
            }
            if (data.hasOwnProperty('max_face_count')) {
                obj['max_face_count'] = ApiClient.convertToType(data['max_face_count'], 'Number');
            }
            if (data.hasOwnProperty('pbr_type')) {
                obj['pbr_type'] = ApiClient.convertToType(data['pbr_type'], 'String');
            }
            if (data.hasOwnProperty('rigged')) {
                obj['rigged'] = ApiClient.convertToType(data['rigged'], 'Boolean');
            }
            if (data.hasOwnProperty('collection')) {
                obj['collection'] = ApiClient.convertToType(data['collection'], 'String');
            }
            if (data.hasOwnProperty('sort_by')) {
                obj['sort_by'] = ApiClient.convertToType(data['sort_by'], 'String');
            }
            if (data.hasOwnProperty('file_format')) {
                obj['file_format'] = ApiClient.convertToType(data['file_format'], 'String');
            }
            if (data.hasOwnProperty('license')) {
                obj['license'] = ApiClient.convertToType(data['license'], 'String');
            }
            if (data.hasOwnProperty('max_uv_layer_count')) {
                obj['max_uv_layer_count'] = ApiClient.convertToType(data['max_uv_layer_count'], 'Number');
            }
            if (data.hasOwnProperty('available_archive_type')) {
                obj['available_archive_type'] = ApiClient.convertToType(data['available_archive_type'], 'String');
            }
            if (data.hasOwnProperty('archives_max_size')) {
                obj['archives_max_size'] = ApiClient.convertToType(data['archives_max_size'], 'Number');
            }
            if (data.hasOwnProperty('archives_max_face_count')) {
                obj['archives_max_face_count'] = ApiClient.convertToType(data['archives_max_face_count'], 'Number');
            }
            if (data.hasOwnProperty('archives_max_vertex_count')) {
                obj['archives_max_vertex_count'] = ApiClient.convertToType(data['archives_max_vertex_count'], 'Number');
            }
            if (data.hasOwnProperty('archives_max_texture_count')) {
                obj['archives_max_texture_count'] = ApiClient.convertToType(data['archives_max_texture_count'], 'Number');
            }
            if (data.hasOwnProperty('archives_texture_max_resolution')) {
                obj['archives_texture_max_resolution'] = ApiClient.convertToType(data['archives_texture_max_resolution'], 'Number');
            }
            if (data.hasOwnProperty('archives_flavours')) {
                obj['archives_flavours'] = ApiClient.convertToType(data['archives_flavours'], 'Boolean');
            }
            if (data.hasOwnProperty('count')) {
                obj['count'] = ApiClient.convertToType(data['count'], 'Number');
            }
            if (data.hasOwnProperty('cursor')) {
                obj['cursor'] = ApiClient.convertToType(data['cursor'], 'Number');
            }
            if (data.hasOwnProperty('type')) {
                obj['type'] = ApiClient.convertToType(data['type'], 'String');
            }
        }
        return obj;
    }

    /**
     * Validates the JSON data with respect to <code>ModelSearchRequest</code>.
     * @param {Object} data The plain JavaScript object bearing properties of interest.
     * @return {boolean} to indicate whether the JSON data is valid with respect to <code>ModelSearchRequest</code>.
     */
    static validateJSON(data) {
        // ensure the json data is a string
        if (data['q'] && !(typeof data['q'] === 'string' || data['q'] instanceof String)) {
            throw new Error("Expected the field `q` to be a primitive type in the JSON string but got " + data['q']);
        }
        // ensure the json data is a string
        if (data['user'] && !(typeof data['user'] === 'string' || data['user'] instanceof String)) {
            throw new Error("Expected the field `user` to be a primitive type in the JSON string but got " + data['user']);
        }
        // ensure the json data is an array
        if (!Array.isArray(data['tags'])) {
            throw new Error("Expected the field `tags` to be an array in the JSON data but got " + data['tags']);
        }
        // ensure the json data is an array
        if (!Array.isArray(data['categories'])) {
            throw new Error("Expected the field `categories` to be an array in the JSON data but got " + data['categories']);
        }
        // ensure the json data is a string
        if (data['pbr_type'] && !(typeof data['pbr_type'] === 'string' || data['pbr_type'] instanceof String)) {
            throw new Error("Expected the field `pbr_type` to be a primitive type in the JSON string but got " + data['pbr_type']);
        }
        // ensure the json data is a string
        if (data['collection'] && !(typeof data['collection'] === 'string' || data['collection'] instanceof String)) {
            throw new Error("Expected the field `collection` to be a primitive type in the JSON string but got " + data['collection']);
        }
        // ensure the json data is a string
        if (data['sort_by'] && !(typeof data['sort_by'] === 'string' || data['sort_by'] instanceof String)) {
            throw new Error("Expected the field `sort_by` to be a primitive type in the JSON string but got " + data['sort_by']);
        }
        // ensure the json data is a string
        if (data['file_format'] && !(typeof data['file_format'] === 'string' || data['file_format'] instanceof String)) {
            throw new Error("Expected the field `file_format` to be a primitive type in the JSON string but got " + data['file_format']);
        }
        // ensure the json data is a string
        if (data['license'] && !(typeof data['license'] === 'string' || data['license'] instanceof String)) {
            throw new Error("Expected the field `license` to be a primitive type in the JSON string but got " + data['license']);
        }
        // ensure the json data is a string
        if (data['available_archive_type'] && !(typeof data['available_archive_type'] === 'string' || data['available_archive_type'] instanceof String)) {
            throw new Error("Expected the field `available_archive_type` to be a primitive type in the JSON string but got " + data['available_archive_type']);
        }
        // ensure the json data is a string
        if (data['type'] && !(typeof data['type'] === 'string' || data['type'] instanceof String)) {
            throw new Error("Expected the field `type` to be a primitive type in the JSON string but got " + data['type']);
        }

        return true;
    }


}





export default ModelSearchRequest;

