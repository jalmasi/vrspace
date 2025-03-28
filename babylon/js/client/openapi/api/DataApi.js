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


import {ApiClient} from "../ApiClient.js";
import { UserData } from '../model/UserData.js';

/**
* Data service.
* @module api/DataApi
* @version v0
*/
export class DataApi {

    /**
    * Constructs a new DataApi. 
    * @alias module:api/DataApi
    * @class
    * @param {module:ApiClient} [apiClient] Optional API client implementation to use,
    * default to {@link module:ApiClient#instance} if unspecified.
    */
    constructor(apiClient) {
        this.apiClient = apiClient || ApiClient.instance;
    }



    /**
     * @return {Promise} a {@link https://www.promisejs.org/|Promise}, with an object containing HTTP response
     */
    clearUserDataWithHttpInfo() {
      let postBody = null;

      let pathParams = {
      };
      let queryParams = {
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = [];
      let accepts = [];
      let returnType = null;
      return this.apiClient.callApi(
        '/vrspace/api/user-data', 'DELETE',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null
      );
    }

    /**
     * @return {Promise} a {@link https://www.promisejs.org/|Promise}
     */
    clearUserData() {
      return this.clearUserDataWithHttpInfo()
        .then(function(response_and_data) {
          return response_and_data.data;
        });
    }


    /**
     * @param {String} key 
     * @return {Promise} a {@link https://www.promisejs.org/|Promise}, with an object containing HTTP response
     */
    deleteUserDataWithHttpInfo(key) {
      let postBody = null;
      // verify the required parameter 'key' is set
      if (key === undefined || key === null) {
        throw new Error("Missing the required parameter 'key' when calling deleteUserData");
      }

      let pathParams = {
        'key': key
      };
      let queryParams = {
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = [];
      let accepts = [];
      let returnType = null;
      return this.apiClient.callApi(
        '/vrspace/api/user-data/{key}', 'DELETE',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null
      );
    }

    /**
     * @param {String} key 
     * @return {Promise} a {@link https://www.promisejs.org/|Promise}
     */
    deleteUserData(key) {
      return this.deleteUserDataWithHttpInfo(key)
        .then(function(response_and_data) {
          return response_and_data.data;
        });
    }


    /**
     * @param {String} key 
     * @return {Promise< UserData >} a {@link https://www.promisejs.org/|Promise}, with an object containing data of type {@link UserData} and HTTP response
     */
    getUserDataWithHttpInfo(key) {
      let postBody = null;
      // verify the required parameter 'key' is set
      if (key === undefined || key === null) {
        throw new Error("Missing the required parameter 'key' when calling getUserData");
      }

      let pathParams = {
        'key': key
      };
      let queryParams = {
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = [];
      let accepts = ['*/*'];
      let returnType = UserData;
      return this.apiClient.callApi(
        '/vrspace/api/user-data/{key}', 'GET',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null
      );
    }

    /**
     * @param {String} key 
     * @return {Promise< UserData >} a {@link https://www.promisejs.org/|Promise}, with data of type {@link UserData}
     */
    getUserData(key) {
      return this.getUserDataWithHttpInfo(key)
        .then(function(response_and_data) {
          return response_and_data.data;
        });
    }


    /**
     * @return {Promise< Array.<UserData> >} a {@link https://www.promisejs.org/|Promise}, with an object containing data of type {@link Array.<UserData>} and HTTP response
     */
    listUserDataWithHttpInfo() {
      let postBody = null;

      let pathParams = {
      };
      let queryParams = {
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = [];
      let accepts = ['*/*'];
      let returnType = [UserData];
      return this.apiClient.callApi(
        '/vrspace/api/user-data', 'GET',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null
      );
    }

    /**
     * @return {Promise< Array.<UserData> >} a {@link https://www.promisejs.org/|Promise}, with data of type {@link Array.<UserData>}
     */
    listUserData() {
      return this.listUserDataWithHttpInfo()
        .then(function(response_and_data) {
          return response_and_data.data;
        });
    }


    /**
     * @param {UserData} userData 
     * @return {Promise} a {@link https://www.promisejs.org/|Promise}, with an object containing HTTP response
     */
    setUserDataWithHttpInfo(userData) {
      let postBody = userData;
      // verify the required parameter 'userData' is set
      if (userData === undefined || userData === null) {
        throw new Error("Missing the required parameter 'userData' when calling setUserData");
      }

      let pathParams = {
      };
      let queryParams = {
      };
      let headerParams = {
      };
      let formParams = {
      };

      let authNames = [];
      let contentTypes = ['application/json'];
      let accepts = [];
      let returnType = null;
      return this.apiClient.callApi(
        '/vrspace/api/user-data', 'POST',
        pathParams, queryParams, headerParams, formParams, postBody,
        authNames, contentTypes, accepts, returnType, null
      );
    }

    /**
     * @param {UserData} userData 
     * @return {Promise} a {@link https://www.promisejs.org/|Promise}
     */
    setUserData(userData) {
      return this.setUserDataWithHttpInfo(userData)
        .then(function(response_and_data) {
          return response_and_data.data;
        });
    }


}
