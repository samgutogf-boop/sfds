// ========== ПОЛНЫЙ КОД БОТА "ТВОЙ ДЕД" ДЛЯ CLOUDFLARE WORKERS ==========

// ========== КОНСТАНТЫ ==========
const ACHIEVEMENTS = {
  water_first: {
    name: '💧 ПЕРВАЯ ВОДА',
    desc: 'Выпил воду впервые',
    how_to_get: 'Выпей стакан воды и отметь это в боте',
    emoji: '💧'
  },
  water_3_days: {
    name: '💪 ВОДНЫЙ БАЛАНС',
    desc: 'Пил воду 3 дня подряд',
    how_to_get: 'Отмечай воду каждый день 3 дня подряд',
    emoji: '💪'
  },
  sleep_5: {
    name: '😴 5 НОЧЕЙ',
    desc: 'Проснулся 5 раз',
    how_to_get: 'Используй трекер сна 5 раз',
    emoji: '😴'
  },
  workout_3: {
    name: '🔥 ТРИ ТРЕНИРОВКИ',
    desc: 'Выполнил 3 тренировки',
    how_to_get: 'Заверши 3 тренировки',
    emoji: '🔥'
  },
  veteran: {
    name: '⭐ ВЕТЕРАН',
    desc: 'Пользуешься ботом 30 дней',
    how_to_get: 'Используй бота 30 дней',
    emoji: '⭐'
  }
};

const TRAINING_PLANS = {
  beginner: {
    name: '👶 НАЧАЛЬНЫЙ',
    description: 'Для новичков, 3 раза в неделю',
    monday: '🏋️ ГРУДЬ + ТРИЦЕПС\n• Жим штанги: 3×10\n• Жим гантелей: 3×12',
    wednesday: '🏋️ СПИНА + БИЦЕПС\n• Тяга блока: 3×12\n• Тяга гантели: 3×12',
    friday: '🏋️ НОГИ + ПЛЕЧИ\n• Приседания: 3×12\n• Жим ногами: 3×15'
  },
  intermediate: {
    name: '🔥 СРЕДНИЙ',
    description: 'Для опытных, 4 раза в неделю',
    monday: '💪 ГРУДЬ\n• Жим штанги: 4×8\n• Жим гантелей: 4×10',
    tuesday: '💪 СПИНА\n• Становая тяга: 4×6\n• Тяга штанги: 4×8',
    thursday: '💪 ПЛЕЧИ\n• Жим сидя: 4×8\n• Махи: 4×12',
    friday: '💪 НОГИ\n• Приседания: 4×8\n• Румынская тяга: 4×8'
  },
  advanced: {
    name: '⚡ ПРОДВИНУТЫЙ',
    description: 'Для профи, 5 раз в неделю',
    monday: '🔥 ГРУДЬ\n• Жим штанги: 5×5\n• Жим гантелей: 4×8',
    tuesday: '🔥 СПИНА\n• Становая тяга: 5×5\n• Тяга штанги: 4×8',
    wednesday: '🔥 НОГИ\n• Приседания: 5×5\n• Жим ногами: 4×10',
    friday: '🔥 ПЛЕЧИ\n• Армейский жим: 5×5\n• Махи: 4×12',
    saturday: '🔥 РУКИ\n• Подтягивания: 4×8\n• Бицепс: 4×10'
  }
};

const ADVICE = [
  "Сон и питание — 70% успеха. 💪",
  "Техника важнее веса. 🏋️",
  "Прогрессия нагрузки — ключ к росту. 🔥",
  "Разминка — не для слабаков. ⚡",
  "Отдых между подходами — не перекур. ⏱️",
  "Вода — это топливо. 💧",
  "Нет оправданий. 😤",
  "Засыпай до полуночи. 🌙",
  "Белок каждый день. 🍗",
  "Дисциплина бьёт мотивацию. ⚔️"
];

// ========== ОСНОВНОЙ ОБРАБОТЧИК ==========
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Установка вебхука
    if (url.pathname === '/setup') {
      return await setupWebhook(env, url.protocol + '//' + url.host);
    }
    
    // Обработка обновлений от Telegram
    if (request.method === 'POST') {
      try {
        const update = await request.json();
        await handleUpdate(update, env, ctx);
        return new Response('OK', { status: 200 });
      } catch (error) {
        console.error('Error:', error);
        return new Response('Error', { status: 500 });
      }
    }
    
    return new Response('Bot is running! Use /setup to configure webhook', { status: 200 });
  },
  
  // Cron для напоминаний (каждые 2 часа)
  async scheduled(event, env, ctx) {
    await checkReminders(env, ctx);
  }
};

// ========== НАСТРОЙКА ВЕБХУКА ==========
async function setupWebhook(env, workerUrl) {
  const webhookUrl = `${workerUrl}/`;
  const response = await fetch(
    `https://api.telegram.org/bot${env.BOT_TOKEN}/setWebhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: webhookUrl })
    }
  );
  
  const result = await response.json();
  return new Response(JSON.stringify(result, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// ========== ОБРАБОТКА ОБНОВЛЕНИЙ ==========
async function handleUpdate(update, env, ctx) {
  // Обработка callback-запросов (кнопки)
  if (update.callback_query) {
    return await handleCallback(update.callback_query, env, ctx);
  }
  
  // Обработка сообщений
  if (!update.message) return;
  
  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text || '';
  const name = msg.from.first_name || 'боец';
  
  // Загружаем данные пользователя
  const userKey = `user:${userId}`;
  let userData = await env.BOT_KV.get(userKey, 'json') || {
    gender: null,
    weight: null,
    height: null,
    waterToday: 0,
    waterDate: new Date().toDateString(),
    totalWater: 0,
    waterStreak: 0,
    lastWaterDate: null,
    sleepStart: null,
    totalSleep: 0,
    totalSleeps: 0,
    workoutsDone: 0,
    achievements: [],
    registeredAt: new Date().toISOString(),
    lastActive: new Date().toISOString(),
    awaitingWater: false
  };
  
  // Обновляем последнюю активность
  userData.lastActive = new Date().toISOString();
  
  // Сброс счетчика воды на новый день
  const today = new Date().toDateString();
  if (userData.waterDate !== today) {
    userData.waterToday = 0;
    userData.waterDate = today;
  }
  
  // Обработка команд
  if (text === '/start') {
    await sendStart(chatId, name, env);
  } else if (text === '/wake') {
    await handleWake(chatId, userData, env);
  } else if (text === '/workout') {
    await sendWorkoutMenu(chatId, env);
  } else if (text === '/sleep') {
    await handleSleep(chatId, userData, env);
  } else if (text === '/achievements') {
    await sendAchievements(chatId, userData, env);
  } else if (text === '/stats') {
    await sendStats(chatId, userData, env);
  } else if (text.startsWith('/')) {
    await sendMessage(chatId, '❓ Неизвестная команда. Используй /start', env);
  } else if (userData.awaitingWater || !isNaN(parseInt(text))) {
    // Обработка ввода воды
    await handleWaterInput(chatId, text, userData, env, ctx);
  } else {
    await sendMainMenu(chatId, env);
  }
  
  // Сохраняем данные
  ctx.waitUntil(env.BOT_KV.put(userKey, JSON.stringify(userData)));
}

// ========== ОБРАБОТКА КНОПОК ==========
async function handleCallback(callback, env, ctx) {
  const chatId = callback.message.chat.id;
  const userId = callback.from.id;
  const data = callback.data;
  
  // Загружаем данные пользователя
  const userKey = `user:${userId}`;
  let userData = await env.BOT_KV.get(userKey, 'json') || {};
  
  // Отвечаем на callback
  await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callback.id })
  });
  
  // Обработка разных кнопок
  if (data === 'workout_beginner') {
    await sendWorkoutPlan(chatId, 'beginner', env);
  } else if (data === 'workout_intermediate') {
    await sendWorkoutPlan(chatId, 'intermediate', env);
  } else if (data === 'workout_advanced') {
    await sendWorkoutPlan(chatId, 'advanced', env);
  } else if (data === 'workout_done') {
    userData.workoutsDone = (userData.workoutsDone || 0) + 1;
    await checkAchievements(chatId, userData, env);
    await sendMessage(chatId, '✅ Отлично потренировался!', env);
  } else if (data === 'woke_up') {
    await handleWake(chatId, userData, env);
  } else if (data === 'drank') {
    userData.awaitingWater = true;
    await sendMessage(chatId, '💧 Сколько мл выпил? (введи число)', env);
  }
  
  ctx.waitUntil(env.BOT_KV.put(userKey, JSON.stringify(userData)));
}

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

async function sendStart(chatId, name, env) {
  const keyboard = {
    keyboard: [
      ['💧 Пить воду', '🏋️ Тренировка'],
      ['🌙 Спать', '🏆 Достижения'],
      ['📊 Статистика', '❓ Помощь']
    ],
    resize_keyboard: true
  };
  
  const welcomeText = `👋 Привет, ${name}! Я Твой Дед 💪\n\n` +
    `📋 Что я умею:\n` +
    `💧 Пить воду — трекер воды\n` +
    `🏋️ Тренировка — планы тренировок\n` +
    `🌙 Спать — трекер сна\n` +
    `🏆 Достижения — награды\n` +
    `📊 Статистика — твой прогресс\n\n` +
    `👇 Выбери действие:`;
  
  await sendMessage(chatId, welcomeText, env, JSON.stringify(keyboard));
}

async function sendMainMenu(chatId, env) {
  const keyboard = {
    keyboard: [
      ['💧 Пить воду', '🏋️ Тренировка'],
      ['🌙 Спать', '🏆 Достижения'],
      ['📊 Статистика', '❓ Помощь']
    ],
    resize_keyboard: true
  };
  
  await sendMessage(chatId, 'Выбери действие:', env, JSON.stringify(keyboard));
}

async function handleWaterInput(chatId, text, userData, env, ctx) {
  const ml = parseInt(text);
  
  if (isNaN(ml) || ml < 50 || ml > 2000) {
    await sendMessage(chatId, '❌ Введи число от 50 до 2000', env);
    userData.awaitingWater = false;
    return;
  }
  
  const waterNorm = (userData.weight || 70) * 30;
  
  // Обновляем статистику воды
  userData.waterToday += ml;
  userData.totalWater += ml;
  userData.awaitingWater = false;
  
  // Обновляем streak
  const today = new Date().toDateString();
  if (userData.lastWaterDate !== today) {
    if (userData.lastWaterDate && 
        new Date(userData.lastWaterDate).getTime() + 86400000 >= new Date().getTime()) {
      userData.waterStreak = (userData.waterStreak || 0) + 1;
    } else {
      userData.waterStreak = 1;
    }
    userData.lastWaterDate = today;
  }
  
  const remaining = Math.max(0, waterNorm - userData.waterToday);
  
  let response = `✅ Записано: +${ml} мл\n`;
  response += `📊 Сегодня: ${userData.waterToday}/${waterNorm} мл\n`;
  
  if (userData.waterToday >= waterNorm) {
    response += `\n🎉 Норма выполнена! Молодец!`;
  } else {
    response += `Осталось: ${remaining} мл`;
  }
  
  response += `\n\n🔥 Серия: ${userData.waterStreak} дней`;
  
  await sendMessage(chatId, response, env);
  
  // Проверяем достижения
  await checkAchievements(chatId, userData, env);
}

async function handleSleep(chatId, userData, env) {
  if (userData.sleepStart) {
    await sendMessage(chatId, '😴 Ты уже спишь!', env);
    return;
  }
  
  userData.sleepStart = new Date().toISOString();
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '👀 Я проснулся', callback_data: 'woke_up' }]
    ]
  };
  
  await sendMessage(
    chatId,
    `🌙 Спокойной ночи! Заснул в ${new Date().toLocaleTimeString().slice(0,5)}`,
    env,
    JSON.stringify(keyboard)
  );
}

async function handleWake(chatId, userData, env) {
  if (!userData.sleepStart) {
    await sendMessage(chatId, '❓ Ты и не ложился!', env);
    return;
  }
  
  const sleepStart = new Date(userData.sleepStart);
  const now = new Date();
  const duration = (now - sleepStart) / 1000;
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  
  userData.totalSleep += duration;
  userData.totalSleeps = (userData.totalSleeps || 0) + 1;
  userData.sleepStart = null;
  
  const totalHours = Math.floor(userData.totalSleep / 3600);
  const totalMinutes = Math.floor((userData.totalSleep % 3600) / 60);
  
  const response = `🌅 Проснулся!\n` +
    `😴 Спал: ${hours} ч ${minutes} мин\n` +
    `📊 Всего сна: ${totalHours} ч ${totalMinutes} мин`;
  
  await sendMessage(chatId, response, env);
  
  // Проверяем достижения
  await checkAchievements(chatId, userData, env);
}

async function sendWorkoutMenu(chatId, env) {
  const keyboard = {
    inline_keyboard: [
      [{ text: '👶 Начальный', callback_data: 'workout_beginner' }],
      [{ text: '🔥 Средний', callback_data: 'workout_intermediate' }],
      [{ text: '⚡ Продвинутый', callback_data: 'workout_advanced' }]
    ]
  };
  
  await sendMessage(chatId, '🏋️ Выбери уровень подготовки:', env, JSON.stringify(keyboard));
}

async function sendWorkoutPlan(chatId, level, env) {
  const plan = TRAINING_PLANS[level];
  let text = `${plan.name}\n${plan.description}\n\n`;
  
  for (const [day, exercises] of Object.entries(plan)) {
    if (!['name', 'description'].includes(day)) {
      text += `📅 ${day}:\n${exercises}\n\n`;
    }
  }
  
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Завершил тренировку', callback_data: 'workout_done' }]
    ]
  };
  
  await sendMessage(chatId, text, env, JSON.stringify(keyboard));
}

async function sendAchievements(chatId, userData, env) {
  let text = '🏆 ТВОИ ДОСТИЖЕНИЯ\n\n';
  
  // Полученные
  if (userData.achievements?.length > 0) {
    text += '✅ ПОЛУЧЕННЫЕ:\n';
    for (const ach of userData.achievements) {
      if (ACHIEVEMENTS[ach]) {
        text += `  ${ACHIEVEMENTS[ach].emoji} ${ACHIEVEMENTS[ach].name}\n`;
      }
    }
    text += '\n';
  }
  
  // Доступные
  text += '📋 ДОСТУПНЫЕ:\n';
  for (const [key, ach] of Object.entries(ACHIEVEMENTS)) {
    if (!userData.achievements?.includes(key)) {
      text += `  ${ach.emoji} ${ach.name}\n    ${ach.how_to_get}\n\n`;
    }
  }
  
  await sendMessage(chatId, text, env);
}

async function sendStats(chatId, userData, env) {
  const waterNorm = (userData.weight || 70) * 30;
  const totalHours = Math.floor(userData.totalSleep / 3600);
  const totalMinutes = Math.floor((userData.totalSleep % 3600) / 60);
  
  const text = `📊 ТВОЯ СТАТИСТИКА\n\n` +
    `💧 Вода сегодня: ${userData.waterToday}/${waterNorm} мл\n` +
    `🔥 Серия: ${userData.waterStreak || 0} дней\n` +
    `💧 Всего выпито: ${Math.round(userData.totalWater / 1000)} л\n\n` +
    `😴 Всего сна: ${totalHours} ч ${totalMinutes} мин\n` +
    `🌙 Пробуждений: ${userData.totalSleeps || 0}\n\n` +
    `🏋️ Тренировок: ${userData.workoutsDone || 0}\n` +
    `🏆 Достижений: ${userData.achievements?.length || 0}`;
  
  await sendMessage(chatId, text, env);
}

async function checkAchievements(chatId, userData, env) {
  const newAchievements = [];
  
  // Проверяем каждое достижение
  if (!userData.achievements?.includes('water_first') && userData.totalWater >= 1000) {
    newAchievements.push('water_first');
  }
  
  if (!userData.achievements?.includes('water_3_days') && userData.waterStreak >= 3) {
    newAchievements.push('water_3_days');
  }
  
  if (!userData.achievements?.includes('sleep_5') && userData.totalSleeps >= 5) {
    newAchievements.push('sleep_5');
  }
  
  if (!userData.achievements?.includes('workout_3') && userData.workoutsDone >= 3) {
    newAchievements.push('workout_3');
  }
  
  if (!userData.achievements?.includes('veteran') && userData.registeredAt) {
    const days = Math.floor((new Date() - new Date(userData.registeredAt)) / 86400000);
    if (days >= 30) {
      newAchievements.push('veteran');
    }
  }
  
  // Отправляем уведомления о новых достижениях
  if (newAchievements.length > 0) {
    userData.achievements = [...(userData.achievements || []), ...newAchievements];
    
    let text = '🎉 НОВЫЕ ДОСТИЖЕНИЯ!\n\n';
    for (const ach of newAchievements) {
      text += `${ACHIEVEMENTS[ach].emoji} ${ACHIEVEMENTS[ach].name}\n`;
    }
    
    await sendMessage(chatId, text, env);
  }
}

async function checkReminders(env, ctx) {
  const users = await listAllUsers(env);
  const now = new Date();
  const hour = now.getHours();
  
  // Не беспокоим ночью
  if (hour < 8 || hour > 22) return;
  
  for (const user of users) {
    // Проверяем, нужно ли напомнить о воде
    if (user.waterToday < (user.weight || 70) * 30 * 0.5) {
      const keyboard = {
        inline_keyboard: [
          [{ text: '🥤 Я выпил', callback_data: 'drank' }]
        ]
      };
      
      await sendMessage(
        user.id,
        '💧 Дед напоминает: пора выпить воды!',
        env,
        JSON.stringify(keyboard)
      );
    }
  }
}

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
async function sendMessage(chatId, text, env, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML'
  };
  
  if (replyMarkup) {
    payload.reply_markup = replyMarkup;
  }
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    if (!result.ok) {
      console.error('Telegram API error:', result);
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
async function listAllUsers(env) {
  const users = [];
  let cursor;
  
  try {
    do {
      const list = await env.BOT_KV.list({ cursor, prefix: 'user:' });
      for (const key of list.keys) {
        const user = await env.BOT_KV.get(key.name, 'json');
        if (user) {
          user.id = parseInt(key.name.replace('user:', ''));
          users.push(user);
        }
      }
      cursor = list.cursor;
    } while (cursor);
  } catch (error) {
    console.error('Error listing users:', error);
  }
  
  return users;
}
