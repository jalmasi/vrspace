package org.vrspace.server.core;

import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationListener;
import org.springframework.context.event.ContextRefreshedEvent;
import org.springframework.stereotype.Component;
import org.vrspace.server.config.BotConfig;
import org.vrspace.server.config.BotConfig.BotProperties;
import org.vrspace.server.obj.Bot;
import org.vrspace.server.obj.World;

import lombok.extern.slf4j.Slf4j;

/**
 * BotManger component starts right after server startup. For each Bot
 * configured in BotConfig, sets properties, adds it to the world, and starts
 * self test. If it passes, Bot remains in the world as a an active object,
 * otherwise it's marked inactive.
 * 
 * @author joe
 *
 */
@Component
@Slf4j
public class BotManager implements ApplicationListener<ContextRefreshedEvent> {
  /** Configuration bean */
  @Autowired
  BotConfig botConfig;

  @Autowired
  WorldManager worldManager;

  String world = "default";

  private Class<? extends Bot> getBotClass(String className) throws Exception {
    if (className.indexOf('.') < 0) {
      className = "org.vrspace.server.obj." + className;
    }
    @SuppressWarnings("unchecked")
    Class<? extends Bot> cls = (Class<? extends Bot>) Class.forName(className);
    return cls;
  }

  // factory method
  private Bot createBot(String className) throws Exception {
    Class<? extends Bot> cls = getBotClass(className);
    Bot instance = cls.getDeclaredConstructor((Class<?>[]) null).newInstance();
    log.info("Created new " + className);
    return instance;
  }

  @Override
  public void onApplicationEvent(ContextRefreshedEvent event) {
    log.info("BotManager starting");
    for (String botId : botConfig.getBot().keySet()) {
      BotProperties props = botConfig.getBot().get(botId);
      log.info("Intializing bot " + botId + " = " + props);

      String botName = botId;
      if (!StringUtils.isEmpty(props.getName())) {
        botName = props.getName();
      }
      Bot bot = null;

      try {
        bot = worldManager.getClientByName(botName, getBotClass(props.getType()));
        if (bot == null) {
          // make new bot
          bot = createBot(props.getType());
        }
      } catch (Exception e) {
        log.error("Can't load or create bot of type " + props.getType(), e);
        continue;
      }

      bot.setName(botName);
      bot.setUrl(props.getUrl());
      bot.setMesh(props.getMesh());
      bot.setGender(props.getGender());
      bot.setLang(props.getLang());

      log.debug(botName + " parameter map: " + props.getParameterMap());
      bot.setParameterMap(props.getParameterMap());

      if (props.getWorld() != null) {
        World world = worldManager.getOrCreateWorld(props.getWorld());
        bot.setWorldId(world.getId());
      }

      if (props.hasPoint(props.getPosition())) {
        bot.setPosition(props.getPoint(props.getPosition()));
      }
      if (props.hasPoint(props.getRotation())) {
        bot.setRotation(props.getRotation(props.getRotation()));
      }
      if (props.hasPoint(props.getScale())) {
        bot.setScale(props.getPoint(props.getScale()));
      }

      worldManager.login(bot);

      try {
        worldManager.startSession(bot);
      } catch (SessionException e) {
        log.error(bot + " cannot start session ", e);
        continue;
      }

      try {
        bot.selfTest();
      } catch (Exception e) {
        log.error(bot + " failed to initialize, disabled", e);
        bot.setActive(false);
        continue;
      }

      log.info("Intialized " + bot);
    }
  }

}
