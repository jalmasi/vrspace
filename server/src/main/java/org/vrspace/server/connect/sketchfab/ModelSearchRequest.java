package org.vrspace.server.connect.sketchfab;

import java.lang.reflect.Field;
import java.net.URI;
import java.util.List;

import org.springframework.web.util.UriComponentsBuilder;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonInclude.Include;

import lombok.Data;

/**
 * Sketchfab model search API parameters, passed to sketchfab as it is. Most
 * interesting parameters are: q, animated, rigged
 * 
 * @author joe
 *
 */
@Data
@JsonInclude(Include.NON_EMPTY)
public class ModelSearchRequest {
  /** Space separated keywords */
  String q;
  /** Searches models by a user (sketchfab username) */
  String user;
  List<String> tags;
  List<String> categories;
  /** Limit search to a specific period only (in days) */
  Integer date;
  /** Always true */
  boolean downloadable = true;
  Boolean animated;
  Boolean staffpicked;
  Integer min_face_count;
  Integer max_face_count;
  /**
   * Filter by PBR type. Set to metalness to search Metalness/Roughness models
   * only. Set to specular to search Specular/Glossiness models only. Set to true
   * to search PBR models only. Set to false to search non-PBR models only.
   */
  String pbr_type;
  Boolean rigged;
  /** Searches models by collection (uid) */
  String collection;
  /**
   * How to sort results. When omitted, results are sorted by relevance. One of
   * likeCount, -likeCount, viewCount, -viewCount, publishedAt, -publishedAt,
   * processedAt, -processedAt
   */
  String sort_by;
  /**
   * Irrelevant, we always deal with GLTF, but this seems to specify original file
   */
  String file_format;
  /** One of by, by-sa, by-nd, by-nc, by-nc-sa, by-nc-nd, cc0, ed, st */
  String license;
  Integer max_uv_layer_count;
  /**
   * We set this to gltf. Always available, and allows for search limit by size
   */
  String available_archive_type = "gltf";
  Integer archives_max_size;
  Integer archives_max_face_count;
  Integer archives_max_vertex_count;
  Integer archives_max_texture_count;
  Integer archives_texture_max_resolution;
  /**
   * If true, returns all archives flavours, listed by archive type, and sorted by
   * texture resolution (descending). If false, only the texture with the highest
   * reslution is returned for each archive type.
   */
  Boolean archives_flavours;
  /**
   * Items displayed per page, seems ignored by sketchfab but returned in paging
   */
  Integer count;
  /** Starting item number, used for paging. */
  Integer cursor;
  /** Constant, type=models */
  String type = "models";

  public URI toURI(String url) {
    UriComponentsBuilder builder = UriComponentsBuilder.fromHttpUrl(url);
    for (Field field : getClass().getDeclaredFields()) {
      try {
        Object val = field.get(this);
        if (val != null) {
          builder.queryParam(field.getName(), val);
        }
      } catch (Exception e) {
        throw new RuntimeException("Error getting " + field.getName(), e);
      }
    }
    return builder.build().toUri();
  }
}
