package org.vrspace.server.connect;

import java.io.IOException;
import java.net.http.HttpClient;
import java.net.http.HttpClient.Redirect;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.HttpResponse.BodyHandlers;
import java.time.Duration;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.vrspace.server.connect.sketchfab.ImageInfo;
import org.vrspace.server.connect.sketchfab.ModelCategory;
import org.vrspace.server.connect.sketchfab.ModelSearchList;
import org.vrspace.server.connect.sketchfab.ModelSearchRequest;
import org.vrspace.server.connect.sketchfab.ModelSearchResponse;
import org.vrspace.server.core.VRObjectRepository;
import org.vrspace.server.obj.ContentCategory;
import org.vrspace.server.obj.GltfModel;

import com.fasterxml.jackson.databind.ObjectMapper;

import lombok.extern.slf4j.Slf4j;

@Slf4j
@Component
public class SketchfabConnector {
  @Autowired
  private ObjectMapper objectMapper;
  @Autowired
  private VRObjectRepository db;
  @Autowired(required = false)
  private OllamaConnector ollama;

  public final String loginUrl = "https://sketchfab.com/oauth2/token/";
  public final String searchUrl = "https://api.sketchfab.com/v3/search";

  private Pattern convertUuid = Pattern
      .compile("(\\p{XDigit}{8})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}{4})(\\p{XDigit}+)");
  private Pattern descriptionCleanup = Pattern.compile("\\s+|\\r?\\n");

  public ModelSearchResponse searchModels(ModelSearchRequest params) throws IOException, InterruptedException {
    log.debug("Search: " + params.getQ());
    HttpClient client = HttpClient.newBuilder().followRedirects(Redirect.NORMAL)
        .connectTimeout(Duration.of(10, ChronoUnit.SECONDS)).build();
    HttpRequest request = HttpRequest.newBuilder(params.toURI(searchUrl)).timeout(Duration.of(10, ChronoUnit.SECONDS)).GET()
        .build();

    HttpResponse<String> response = client.send(request, BodyHandlers.ofString());
    String body = response.body();
    // log.debug("Sketchfab response: code=" + response.statusCode() + " body=" +
    // body);
    ModelSearchResponse ret = objectMapper.readValue(body, ModelSearchResponse.class);
    ret.getResults().forEach(modelInfo -> {
      modelInfo.setDescription(descriptionCleanup.matcher(modelInfo.getDescription()).replaceAll(" "));
      modelInfo.setRigged(params.getRigged());

      String uuid = convertUuid.matcher(modelInfo.getUid()).replaceFirst("$1-$2-$3-$4-$5");
      GltfModel model = db.get(GltfModel.class, uuid);
      if (model == null) {
        model = new GltfModel();
        model.setId(uuid);
        model.setAuthor(modelInfo.getUser().getUsername()); // CHECKME: or getDisplayName?
        model.setCategories(updateCategories(modelInfo.getCategories()));
        model.setDescription(modelInfo.getDescription());
        model.setLength(modelInfo.getArchives().getGltf().getSize());
        model.setLicense(modelInfo.getLicense().getLabel());
        model.setName(modelInfo.getName()); // CHECKME: sanitize?
        model.setUid(modelInfo.getUid());
        model.setUri(modelInfo.getUri()); // CHECKME: getViewerUrl?
        model.setAnimated(modelInfo.getAnimationCount() > 0);
        model.setRigged(modelInfo.getRigged());
        model.setProcessed(false);
        // log.debug("Created new GltfFile " + model.getId() + " " + model.getName() + " " + model.getDescription());
        model = db.save(model);
      } else {
        // log.debug("Existing GltfFile " + modelInfo.getName() + " " + modelInfo.getDescription() + " processed: " +
        // model.getProcessed());
        modelInfo.setDescription(model.getDescription()); // CHECKME: interferes with postProcess?
      }
      postProcess(modelInfo, model);
    });
    return ret;
  }

  private void postProcess(ModelSearchList modelInfo, GltfModel model) {
    if (ollama != null) {
      ImageInfo chosen = null;
      for (ImageInfo imageInfo : modelInfo.getThumbnails().getImages()) {
        // we need at least 700x400 pixels for successful recognition
        if ((imageInfo.getHeight() >= 700 && imageInfo.getWidth() >= 400
            || imageInfo.getHeight() >= 400 && imageInfo.getWidth() >= 700)
            && (chosen == null || imageInfo.getHeight() < chosen.getHeight() || imageInfo.getWidth() < chosen.getWidth())) {
          chosen = imageInfo;
        }
      }
      if (chosen == null || chosen.getHeight() < 400 || chosen.getWidth() < 400) {
        log.error("Invalid thumbnail chosen:" + chosen + ", choices: " + modelInfo.getThumbnails());
      }
      model.setThumbnail(chosen.getUrl());
      ollama.updateDescriptionFromThumbnail(model);
    }
  }

  private List<ContentCategory> updateCategories(List<ModelCategory> categories) {
    return categories.stream().map(cat -> cat.getName()).map(catName -> updateCategory(catName)).collect(Collectors.toList());
  }

  // CHECKME cache this?
  public ContentCategory updateCategory(String catName) {
    Optional<ContentCategory> oCat = db.findContentCategoryByName(catName);
    if (oCat.isPresent()) {
      return oCat.get();
    } else {
      ContentCategory cc = new ContentCategory(catName);
      return db.save(cc);
    }
  }

}
