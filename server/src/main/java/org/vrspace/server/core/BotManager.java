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

@Component
@Slf4j
public class BotManager implements ApplicationListener<ContextRefreshedEvent> {
  // @Value("${org.vrspace.server.bot}")
  @Autowired
  BotConfig botConfig;

  @Autowired
  WorldManager worldManager;

  String world = "default";

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
      Bot bot = worldManager.getClientByName(botName, Bot.class);

      if (bot == null) {
        // make new bot
        bot = new Bot();
      }

      bot.setName(botName);
      bot.setUrl(props.getUrl());
      bot.setMesh(props.getMesh());

      if (props.getWorld() != null) {
        World world = worldManager.getOrCreateWorld(props.getWorld());
        bot.setWorld(world);
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
