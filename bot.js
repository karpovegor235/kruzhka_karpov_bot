// ================================================
// ===== ПОДАВЛЕНИЕ ПРЕДУПРЕЖДЕНИЯ NPM =====
// ================================================
process.env.NPM_CONFIG_PRODUCTION = 'false';

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const http = require('http');

// ================================================
// ===== КОНФИГУРАЦИЯ =====
// ================================================

const TOKEN = '8831398856:AAGqDAVaVYk-G9WF1ny6gbvu1kGKFC0PCP0';
const ADMIN_CHAT_ID = '490337942';
const ADMIN_USERNAME = '@egor_provedet';
const PORT = process.env.PORT || 3000;
const DATA_FILE = 'data.json';

console.log('🤖 Бот: @kruzhka_new_bot');
console.log('✅ Токен загружен');

// ================================================
// ===== СОЗДАНИЕ БОТА =====
// ================================================

const bot = new TelegramBot(TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true
    }
});

console.log('🚀 Бот запущен!');

// ================================================
// ===== HTTP СЕРВЕР ДЛЯ UPTIMEROBOT =====
// ================================================

const server = http.createServer((req, res) => {
    if (req.url === '/' || req.url === '/ping') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            status: 'ok',
            time: new Date().toISOString(),
            bot: 'Kruzhka Bot',
            uptime: Math.floor(process.uptime())
        }));
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP сервер на порту ${PORT}`);
});

// ===== ВНУТРЕННИЙ ПИНГ =====
setInterval(() => {
    const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/',
        method: 'GET'
    }, () => {});
    req.on('error', () => {});
    req.end();
}, 4 * 60 * 1000);

// ================================================
// ===== РАБОТА С ДАННЫМИ =====
// ================================================

function loadData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
        }
    } catch (e) {
        console.log('📁 Создаём новый файл данных');
    }
    return { 
        users: [], 
        test_results: [], 
        journal_entries: [], 
        feedbacks: [],
        points: [],
        consultations: [],
        journal_days: [],
        subscriptions: []
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Ошибка сохранения данных:', e.message);
    }
}

// ================================================
// ===== СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЕЙ =====
// ================================================

const userStates = {};
const userAnswers = {};

// ================================================
// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
// ================================================

function getUserPoints(userId) {
    const data = loadData();
    const user = data.points.find(u => u.user_id === userId);
    return user ? user.points : 0;
}

function addPoints(userId, points, reason) {
    const data = loadData();
    let user = data.points.find(u => u.user_id === userId);
    if (!user) {
        user = { user_id: userId, points: 0, history: [] };
        data.points.push(user);
    }
    user.points += points;
    user.history.push({
        points: points,
        reason: reason,
        date: new Date().toISOString()
    });
    saveData(data);
    return user.points;
}

function getUserLevel(points) {
    if (points < 50) return { name: '🌱 Новичок', emoji: '🌱' };
    if (points < 150) return { name: '🌿 Исследователь', emoji: '🌿' };
    if (points < 300) return { name: '🌳 Мастер', emoji: '🌳' };
    if (points < 500) return { name: '☀️ Проводник', emoji: '☀️' };
    return { name: '✨ Мудрец', emoji: '✨' };
}

function clearUserState(chatId) {
    delete userStates[chatId];
}

function getJournalStats(userId) {
    const data = loadData();
    const entries = data.journal_days ? data.journal_days.filter(e => e.user_id === userId) : [];
    const filled = entries.filter(e => e.morning || e.evening);
    return { total: entries.length, filled: filled.length };
}

function getDailyQuestion(type) {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const morningQuestions = [
        '🌅 С каким настроением ты просыпаешься сегодня?',
        '🌅 Что ты чувствуешь в теле этим утром?',
        '🌅 Какое намерение у тебя на сегодня?',
        '🌅 Что ты хочешь почувствовать сегодня?',
        '🌅 Какой энергией ты хочешь наполнить свой день?'
    ];
    const eveningQuestions = [
        '🌙 Что было самым важным для тебя сегодня?',
        '🌙 За что ты благодарна себе сегодня?',
        '🌙 Что тебе сегодня удалось?',
        '🌙 Что ты хочешь отпустить перед сном?',
        '🌙 Как ты себя чувствуешь в конце этого дня?'
    ];
    const questions = type === 'morning' ? morningQuestions : eveningQuestions;
    return questions[dayOfYear % questions.length];
}

function getTimeGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return '🌅 Доброе утро';
    if (hour < 18) return '☀️ Добрый день';
    return '🌙 Добрый вечер';
}

function getSubscriptionStatus(userId) {
    const data = loadData();
    const sub = data.subscriptions.find(s => s.user_id === userId);
    return sub || { morning: false, evening: false };
}

function updateSubscription(userId, type, enabled) {
    const data = loadData();
    let sub = data.subscriptions.find(s => s.user_id === userId);
    if (!sub) {
        sub = { user_id: userId, morning: false, evening: false };
        data.subscriptions.push(sub);
    }
    sub[type] = enabled;
    saveData(data);
    return sub;
}

function getEncouragingMessage() {
    const messages = [
        '💗 Ты молодец, что проходишь этот путь',
        '🌿 Каждый шаг — это забота о себе',
        '✨ Ты уже делаешь важное дело',
        '💫 Продолжай. Ты справляешься',
        '🌟 Ещё немного, и ты увидишь результат',
        '🌸 Ты делаешь это для себя. И это прекрасно',
        '☀️ С каждым днём ты становишься ближе к себе'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
}

function getUsersName(userId) {
    const data = loadData();
    const user = data.users.find(u => u.id === userId);
    return user && user.first_name ? user.first_name : 'дорогая';
}

// ================================================
// ===== УТРЕННИЕ ПРАКТИКИ =====
// ================================================

const morningPractices = [
    {
        id: 'mp1',
        title: '☀️ Три вдоха',
        text: `☀️ <b>Практика: «Три вдоха»</b>

🕐 <b>Время:</b> 5 минут

<b>Что делать:</b>

1️⃣ Сядь удобно, закрой глаза.
Почувствуй, как твоё тело касается стула или пола.
Ты в безопасности.

2️⃣ Сделай 3 глубоких вдоха и выдоха.
На вдохе — «Я вдыхаю свет».
На выдохе — «Я выдыхаю напряжение».

3️⃣ Положи руку на сердце. Почувствуй его тепло.
Оно бьётся для тебя.

4️⃣ Скажи вслух или про себя:
«Я здесь. Я в своём теле. Я в своей жизни. Я есть».

💗 <b>После:</b> Открой глаза. Улыбнись себе. Ты — есть.`
    },
    {
        id: 'mp2',
        title: '☀️ Благодарность телу',
        text: `☀️ <b>Практика: «Благодарность телу»</b>

🕐 <b>Время:</b> 5–7 минут

<b>Что делать:</b>

1️⃣ Встань, ноги на ширине плеч.
Почувствуй землю под ногами.
Ты стоишь твёрдо.

2️⃣ Медленно называй части тела и благодари их:
«Спасибо, ноги, за то, что несёшь меня».
«Спасибо, руки, за то, что создаёшь, обнимаешь».
«Спасибо, сердце, за то, что любишь и чувствуешь».
«Спасибо, дыхание, за то, что ты есть».

3️⃣ Положи одну руку на сердце, другую — на живот.
Скажи: «Моё тело — мой дом. Я благодарю его».

💗 <b>После:</b> Улыбнись себе в зеркало. Ты — прекрасна.`
    },
    {
        id: 'mp3',
        title: '☀️ Я здесь',
        text: `☀️ <b>Практика: «Я здесь»</b>

🕐 <b>Время:</b> 5 минут

<b>Что делать:</b>

1️⃣ Сядь удобно, закрой глаза.
Ты в своём пространстве.

2️⃣ Сделай 5 глубоких вдохов и выдохов.
На вдохе — «Я здесь».
На выдохе — «Я в безопасности».

3️⃣ Положи одну руку на сердце, другую — на живот.
Почувствуй их тепло.

4️⃣ Скажи вслух:
«Я здесь. Я в своём теле. Я в своей жизни. Я есть».

💗 <b>После:</b> Открой глаза. Ты — есть. Ты — важна.`
    },
    {
        id: 'mp4',
        title: '☀️ Моя опора',
        text: `☀️ <b>Практика: «Моя опора»</b>

🕐 <b>Время:</b> 5–7 минут

<b>Что делать:</b>

1️⃣ Встань. Ноги на ширине плеч.
Почувствуй землю под ногами.
Ты стоишь на твёрдой почве.

2️⃣ Представь, что из стоп в землю уходят корни.
Они глубокие и сильные.
Скажи: «Я стою твёрдо. Я в безопасности».

3️⃣ Почувствуй, как позвоночник становится прямым.
Скажи: «Я — моя опора. Я есть. Я справлюсь».

💗 <b>После:</b> Сделай шаг вперёд и скажи: «Я готова к этому дню».`
    },
    {
        id: 'mp5',
        title: '☀️ Улыбка себе',
        text: `☀️ <b>Практика: «Улыбка себе»</b>

🕐 <b>Время:</b> 5 минут

<b>Что делать:</b>

1️⃣ Подойди к зеркалу. Посмотри себе в глаза.
Ты — красивая. Ты — ценная.

2️⃣ Улыбнись себе. Даже если не хочется.
Скажи: «Я рада видеть тебя, родная».

3️⃣ Найди одну вещь в себе, которую ты любишь.
Скажи: «Мне нравится...»

4️⃣ Положи руку на сердце.
Скажи: «Я люблю себя. Сегодня, завтра и всегда».

💗 <b>После:</b> Сохрани эту улыбку в сердце на весь день.`
    }
];

function getMorningPractice(index) {
    return morningPractices[index % morningPractices.length];
}

// ================================================
// ===== ГЛАВНОЕ МЕНЮ =====
// ================================================

function getMainKeyboard() {
    return {
        reply_markup: {
            keyboard: [
                [{ text: '🧘‍♀️ Тест состояния' }],
                [{ text: '🌅 Утренние практики' }],
                [{ text: '🌙 Вечерние вопросы' }],
                [{ text: '📖 Годовой дневник' }],
                [{ text: '🏆 Мой путь' }],
                [{ text: '🤍 Пространство тишины' }],
                [{ text: '🗓️ Встречи и события' }],
                [{ text: '💬 О проекте' }],
                [{ text: '💬 Обратная связь' }],
                [{ text: '🔔 Управление подписками' }]
            ],
            resize_keyboard: true
        }
    };
}

// ================================================
// ===== ФУНКЦИИ ДЛЯ РАССЫЛОК =====
// ================================================

async function sendMorningPractice() {
    try {
        const data = loadData();
        const users = data.subscriptions.filter(s => s.morning).map(s => s.user_id);
        const today = new Date().toISOString().slice(0, 10);
        
        if (users.length === 0) return;
        
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        const question = getDailyQuestion('morning');
        
        for (const userId of users) {
            try {
                const name = getUsersName(userId);
                await bot.sendMessage(userId,
                    `${getTimeGreeting()}, ${name}! 🌅\n\n${practice.title}\n\n${practice.text}\n\n━━━━━━━━━━━━━━━━\n📖 <b>Дневник: утро</b>\n\n${question}\n\n✍️ Напиши ответ в ответ на это сообщение.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📝 Записать в дневник', callback_data: `journal_morning_${today}_${userId}` }]
                            ]
                        }
                    }
                );
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (e) {
                console.log(`⚠️ Не удалось отправить практику пользователю ${userId}`);
            }
        }
    } catch (e) {
        console.error('❌ Ошибка в sendMorningPractice:', e.message);
    }
}

async function sendEveningQuestion() {
    try {
        const data = loadData();
        const users = data.subscriptions.filter(s => s.evening).map(s => s.user_id);
        const today = new Date().toISOString().slice(0, 10);
        
        if (users.length === 0) return;
        
        const question = getDailyQuestion('evening');
        
        for (const userId of users) {
            try {
                const name = getUsersName(userId);
                await bot.sendMessage(userId,
                    `🌙 <b>Добрый вечер, ${name}!</b>\n\n${question}\n\n📖 Напиши ответ в ответ на это сообщение.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📝 Записать в дневник', callback_data: `journal_evening_${today}_${userId}` }]
                            ]
                        }
                    }
                );
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (e) {
                console.log(`⚠️ Не удалось отправить вопрос пользователю ${userId}`);
            }
        }
    } catch (e) {
        console.error('❌ Ошибка в sendEveningQuestion:', e.message);
    }
}

function scheduleDailyMessages() {
    console.log('⏰ Планировщик запущен');
    
    setInterval(() => {
        try {
            const now = new Date();
            const hours = now.getHours();
            const minutes = now.getMinutes();
            
            if (hours === 7 && minutes === 0) {
                console.log('🌅 Отправляю утреннюю рассылку...');
                sendMorningPractice();
            }
            
            if (hours === 22 && minutes === 0) {
                console.log('🌙 Отправляю вечернюю рассылку...');
                sendEveningQuestion();
            }
        } catch (e) {
            console.error('❌ Ошибка в планировщике:', e.message);
        }
    }, 60000);
}

// ================================================
// ===== ИСТОРИЯ ПРО КРУЖКУ =====
// ================================================

function sendKruzhkaStory(chatId) {
    const storyText = 
`☕ «Кружка» — это не просто имя.

Это метафора того, что происходит с каждой из нас.

Представь...

Когда мы рождаемся, у нас появляется невидимая кружка.
Пустая. Чистая. Прозрачная.

И мы начинаем складывать в неё всё, что не можем выплеснуть:

• Страхи, которые не проговорили
• Обиды, которые проглотили
• «Надо» и «должна», которые на нас повесили
• Чужие ожидания и навязанные роли
• Усталость, которой не давали выхода
• Слёзы, которые не выплакали

Год за годом кружка наполняется.
Становится тяжелее.
Дышать труднее.
Тело зажимается.

И однажды она переполняется.

Кружку нельзя просто закрыть крышкой.
Ей нужно дать выход.

Выплеснуть старое. Освободить место.
И только тогда — наполнить её новым.

Светом. Тишиной. Собой.

Этот бот — твоя кружка.
Здесь можно выдохнуть.
Здесь можно освободиться от старого и начать наполняться новым.

💗 Ты готова начать своё путешествие?`;

    bot.sendMessage(chatId, storyText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '💚 Да, готова', callback_data: 'kruzhka_ready' }],
                [{ text: '💫 Пропустить', callback_data: 'kruzhka_skip' }]
            ]
        }
    });
}

// ================================================
// ===== ЗНАКОМСТВО С ЕГОРОМ =====
// ================================================

function sendEgorPhotosAsAlbum(chatId) {
    const photos = [
        'https://drive.google.com/uc?export=view&id=1J0QHig1ITGQV-6pCC4UK-NytAuc4ugio',
        'https://drive.google.com/uc?export=view&id=1Rqz3WJ3k5aJQQeM6ExurMytf4mvTkOqG',
        'https://drive.google.com/uc?export=view&id=1XQumIRNTqNt0_aRZ3Cp1GccU4APIXtyM',
        'https://drive.google.com/uc?export=view&id=1g6yemJWhPw184kzRxD2AbeReLGPEbUkR'
    ];

    const mediaGroup = photos.map((url, index) => ({
        type: 'photo',
        media: url,
        caption: index === 0 ? 
            `📸 Вот так выглядит мой создатель.\n\nСвайпай вправо, чтобы посмотреть все фото ➡️` : 
            '',
        parse_mode: 'HTML'
    }));

    bot.sendMediaGroup(chatId, mediaGroup).catch(() => {
        photos.forEach((url, index) => {
            setTimeout(() => {
                bot.sendPhoto(chatId, url, {
                    caption: index === 0 ? 
                        `📸 Вот так выглядит мой создатель.` : 
                        '',
                    parse_mode: 'HTML'
                });
            }, index * 500);
        });
    });
}

function showEgorInfo(chatId, type) {
    const info = {
        about: 
`👤 <b>Егор Карпов</b>

Моя жизнь — это гармония между материальным и духовным миром.
Я верю, что истинный баланс рождается там, где душа и тело находятся в согласии.

Я — наставник, целитель и проводник.
Моё предназначение — помогать людям находить внутреннюю поддержку и силу.

🧘‍♂️ <b>Чем я занимаюсь:</b>

• Обучаю проводников гвоздестояния
• Провожу индивидуальные практики для глубокого понимания себя
• Работаю с авторским методом системных расстановок
• Помогаю исцеляться через работу с подсознанием
• Практикую доски садху

✨ В каждой моей практике — забота о том, чтобы человек вернулся к себе.`,

        contacts: 
`📱 <b>Связаться с Егором:</b>

Telegram: <a href="https://t.me/egor_provedet">@egor_provedet</a>
Instagram: <a href="https://www.instagram.com/egor_provedet/">@egor_provedet</a>

📍 <b>Где можно встретиться:</b>

📖 В этом боте — практики, тест, дневник
📞 На индивидуальной консультации
🧘‍♀️ На офлайн-тренинге «Кружка» (Минск, 22 августа)

💗 Егор всегда открыт к диалогу.
Если есть вопрос или нужна поддержка — напиши.`
    };

    bot.sendMessage(chatId, info[type] || info.about, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '💬 Написать Егору', callback_data: 'go_write' }],
                [{ text: '🤖 Познакомиться с ботом', callback_data: 'continue_to_bot' }]
            ]
        }
    });
}

// ================================================
// ===== ЗНАКОМСТВО С БОТОМ =====
// ================================================

function showBotFeatures(chatId) {
    const featuresText = 
`🤖 <b>А теперь я расскажу о себе.</b>

Я — твой карманный инструмент для заботы о себе.
Я не про «надо» и «правильно».
Я про тебя и твои ощущения.

<b>Это очень важно — узнать, что я умею!</b>
Нажми на каждую функцию, чтобы прочитать описание.
Ты сможешь вернуться к ним в любое время через главное меню.

👇 <b>Изучи все функции, а затем нажми «✅ Я всё поняла»:</b>`;

    bot.sendMessage(chatId, featuresText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🧘‍♀️ Тест состояния', callback_data: 'feature_test' }],
                [{ text: '🌅 Утренние практики', callback_data: 'feature_morning' }],
                [{ text: '🌙 Вечерние вопросы', callback_data: 'feature_evening' }],
                [{ text: '📖 Годовой дневник', callback_data: 'feature_journal' }],
                [{ text: '🏆 Мой путь', callback_data: 'feature_path' }],
                [{ text: '🤍 Пространство тишины', callback_data: 'feature_silence' }],
                [{ text: '🗓️ Встречи и события', callback_data: 'feature_events' }],
                [{ text: '✅ Я всё поняла, продолжить', callback_data: 'features_done' }]
            ]
        }
    });
}

// ================================================
// ===== ОПИСАНИЯ ФУНКЦИЙ =====
// ================================================

function showFeatureDescription(chatId, feature) {
    const descriptions = {
        test: 
`🧘‍♀️ <b>ТЕСТ «СОСТОЯНИЕ ТВОЕЙ КРУЖКИ»</b>

<b>Что это?</b>
5 простых вопросов о том, как ты себя чувствуешь прямо сейчас.
Никаких правильных или неправильных ответов.
Только твоя правда.

<b>Зачем это?</b>
Тест помогает увидеть, что переполняет твою кружку в данный момент.
Усталость? Тревога? Пустота? Или равновесие?

Результат покажет, какая область нуждается в твоём внимании.
И даст рекомендацию — с чего начать.

<b>Сколько времени?</b>
Всего 2-3 минуты.

<b>Когда проходить?</b>
В любой момент, когда хочешь услышать себя.

💗 Это первый шаг к пониманию своего состояния.`,

        morning: 
`🌅 <b>УТРЕННИЕ ПРАКТИКИ</b>

<b>Что это?</b>
Короткие упражнения на 5-7 минут.
Они помогают:
• Проснуться осознанно
• Настроиться на день
• Почувствовать своё тело
• Создать утренний ритуал заботы о себе

Каждая практика — это простые действия:
Дыхание. Движение. Благодарность. Присутствие.

<b>Примеры практик:</b>
☀️ «Три вдоха» — вернуться в тело
☀️ «Благодарность телу» — почувствовать опору
☀️ «Я здесь» — быть в настоящем
☀️ «Моя опора» — почувствовать устойчивость
☀️ «Улыбка себе» — начать день с любви

📬 <b>Подписка на утренние практики:</b>

Каждое утро в 7:00 я буду присылать тебе новую практику.
Это как утреннее объятие — тёплое и поддерживающее.
Ты можешь делать её сразу или сохранить на потом.`,

        evening: 
`🌙 <b>ВЕЧЕРНИЕ ВОПРОСЫ</b>

<b>Что это?</b>
Каждый вечер в 22:00 я присылаю тебе один вопрос для рефлексии.

Это не просто «как прошёл день».
Это возможность:
• Заметить свои чувства
• Поблагодарить себя
• Отпустить напряжение перед сном
• Завершить день осознанно

<b>Примеры вопросов:</b>
«Что было самым важным для тебя сегодня?»
«За что ты благодарна себе сегодня?»
«Что тебе сегодня удалось?»

📬 <b>Подписка на вечерние вопросы:</b>

Каждый вечер в 22:00 я буду присылать тебе вопрос.
Это поможет завершать день с лёгкостью и благодарностью.`,

        journal: 
`📖 <b>ГОДОВОЙ ДНЕВНИК</b>

<b>Что это?</b>
Твоё личное пространство для ежедневной рефлексии.
Дневник ведётся в удобном веб-формате по ссылке.

Каждый день ты можешь записывать:
🌅 Утро — с каким настроением проснулась?
🌙 Вечер — что было важным за день?

<b>Зачем это?</b>
• Видеть свой путь день за днём
• Замечать изменения в состоянии
• Отслеживать свои чувства
• Создавать привычку заботиться о себе

<b>Как это работает?</b>
Я присылаю вопрос утром и вечером.
Ты переходишь по ссылке и записываешь ответ.

Каждая запись — это +3 балла к твоему пути.

💗 Дневник — это диалог с собой.
Честный. Тёплый. Без осуждения.`,

        path: 
`🏆 <b>МОЙ ПУТЬ</b>

<b>Что это?</b>
Твоя личная статистика в боте.

Здесь ты видишь:
📅 Сколько дней ты в боте
📖 Сколько дней с записями в дневнике
🧘‍♀️ Сколько тестов пройдено
⭐ Сколько баллов накоплено
🌱 Какой у тебя уровень

<b>Уровни:</b>
🌱 Новичок — 0-50 баллов
🌿 Исследователь — 50-150 баллов
🌳 Мастер — 150-300 баллов
☀️ Проводник — 300-500 баллов
✨ Мудрец — 500+ баллов

<b>Зачем это?</b>
Это не соревнование.
Это способ увидеть, как ты меняешься.

Когда внутри кажется, что ничего не происходит —
ты смотришь сюда и видишь: ты идёшь.
Ты делаешь. Ты растёшь.

Каждый шаг — это забота о себе.`,

        silence: 
`🤍 <b>ПРОСТРАНСТВО ТИШИНЫ</b>

<b>Что это?</b>
30 секунд тишины для тебя.

Здесь не нужно ничего делать.
Просто остановиться и побыть с собой.

<b>Как это работает?</b>
Нажимаешь кнопку — и я приглашаю тебя закрыть глаза.
30 секунд. Только ты и твоё дыхание.
Тишина.
Ты в безопасности.

<b>Зачем это?</b>
В нашей жизни так мало моментов, когда мы просто молчим.
Когда не думаем, не планируем, не анализируем.
А просто — есть.

Это маленький островок тишины в твоём дне.
Доступен в любой момент.

💗 После тишины ты получаешь +3 балла.
И, самое главное, — возвращаешься к себе.`,

        events: 
`🗓️ <b>ВСТРЕЧИ И СОБЫТИЯ</b>

Я планирую проводить живые встречи в Минске и не только.
Здесь ты узнаешь о ближайших событиях первой.

━━━━━━━━━━━━━━━━━━━━━━━━━
🧘‍♀️ <b>БЛИЖАЙШЕЕ СОБЫТИЕ:</b>

🌿 <b>Офлайн-тренинг «Кружка»</b>
📍 Минск, 22 августа 2026
⏰ 10:00 – 16:10

6 часов авторских практик:
• Работа с телом и состоянием
• Освобождение от блоков
• Встреча с собой
• Живое общение с Егором и другими участницами

<b>📌 Тарифы:</b>
🟢 «Лёгкий» — 380 BYN
🟠 «Классика» — 580 BYN
🟡 «VIP» — 880 BYN

━━━━━━━━━━━━━━━━━━━━━━━━━
🌟 <b>В ПЛАНАХ:</b>

• Женские круги в Минске
• Ретриты на природе
• Онлайн-встречи и вебинары
• Гвоздестояние в группах

💗 Я буду постепенно анонсировать всё здесь.
Следи за обновлениями!`
    };

    const featureMap = {
        test: 'feature_test',
        morning: 'feature_morning',
        evening: 'feature_evening',
        journal: 'feature_journal',
        path: 'feature_path',
        silence: 'feature_silence',
        events: 'feature_events'
    };

    const backCallback = featureMap[feature] || 'feature_list';
    
    // ✅ ИСПРАВЛЕНО: добавлена кнопка "✅ Я всё поняла, продолжить"
    bot.sendMessage(chatId, descriptions[feature], {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🔙 Назад к функциям', callback_data: backCallback }],
                [{ text: '✅ Я всё поняла, продолжить', callback_data: 'features_done' }]
            ]
        }
    });
}

// ================================================
// ===== ЗНАКОМСТВО С ПОЛЬЗОВАТЕЛЕМ =====
// ================================================

function startUserIntro(chatId) {
    const userId = String(chatId);
    const userData = userAnswers[userId];
    if (!userData) {
        userAnswers[userId] = {
            name: '',
            answers: {},
            step: 0,
            stage: 'intro'
        };
    }
    
    bot.sendMessage(chatId,
        `💗 <b>Теперь я хочу познакомиться с тобой.</b>

Я буду называть тебя по имени.
Каждый раз, когда я произношу твоё имя, я напоминаю тебе:
ты — важна. ты — есть. ты — ценность.

👇 Как мне тебя называть?`,
        { parse_mode: 'HTML' }
    );
    
    userAnswers[userId].stage = 'intro_name';
}

function askIntroQuestion(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    const questions = [
        {
            id: 'state',
            text: `💭 <b>Расскажи мне, ${userData.name}...</b>\n\nКакое у тебя сейчас состояние?\nОпиши одним-двумя словами.`
        },
        {
            id: 'reason',
            text: `🌟 <b>Спасибо, что делишься, ${userData.name}.</b>\n\nА теперь скажи:\nЧто привело тебя сюда?\nЧто ты ищешь в этом пространстве?`
        }
    ];
    
    const currentStep = userData.step || 0;
    if (currentStep < questions.length) {
        bot.sendMessage(chatId, questions[currentStep].text, { parse_mode: 'HTML' });
        userData.stage = `intro_${questions[currentStep].id}`;
    } else {
        finishUserIntro(chatId, userId);
    }
}

function finishUserIntro(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    const data = loadData();
    const user = data.users.find(u => u.id === userId);
    if (user) {
        user.intro_answers = userData.answers;
        user.intro_completed = true;
        user.first_name = userData.name;
        user.intro_date = new Date().toISOString();
        saveData(data);
    }
    
    bot.sendMessage(chatId,
        `💗 <b>Спасибо за твою честность, ${userData.name}.</b>

Ты уже сделала важный шаг — пришла сюда и поделилась.
Это многое значит.

Теперь у тебя есть место, где можно:
• Услышать себя
• Восстановить силы
• Найти опору
• Просто быть

👇 С чего хочешь начать своё путешествие?`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🧘‍♀️ Пройти тест (рекомендую)', callback_data: 'intro_test' }],
                    [{ text: '🌅 Получить утреннюю практику', callback_data: 'intro_practice' }],
                    [{ text: '🏠 В главное меню', callback_data: 'intro_main' }]
                ]
            }
        }
    );
    
    userData.stage = 'done';
}

// ================================================
// ===== ТЕСТ =====
// ================================================

const testQuestions = [
    {
        id: 'q1',
        text: '🧘‍♀️ <b>Вопрос 1 из 5</b>\n\nКак ты просыпаешься по утрам?',
        options: [
            { text: '☀️ С лёгкостью', value: 'light' },
            { text: '😴 С трудом', value: 'tired' },
            { text: '😰 С тревогой', value: 'anxious' },
            { text: '😶 На автомате', value: 'empty' }
        ]
    },
    {
        id: 'q2',
        text: '💼 <b>Вопрос 2 из 5</b>\n\nКак ты чувствуешь себя в течение дня?',
        options: [
            { text: '⚡ Энергично', value: 'energetic' },
            { text: '🫠 Устаю', value: 'exhausted' },
            { text: '😬 Напряжённо', value: 'tense' },
            { text: '🌫️ На автомате', value: 'disconnected' }
        ]
    },
    {
        id: 'q3',
        text: '💬 <b>Вопрос 3 из 5</b>\n\nЧто ты чаще всего чувствуешь к концу дня?',
        options: [
            { text: '😌 Спокойствие', value: 'satisfied' },
            { text: '😩 Усталость', value: 'drained' },
            { text: '😤 Раздражение', value: 'irritated' },
            { text: '😔 Чувство вины', value: 'guilty' }
        ]
    },
    {
        id: 'q4',
        text: '🛌 <b>Вопрос 4 из 5</b>\n\nЧто происходит, когда ты остаёшься одна?',
        options: [
            { text: '😊 Наслаждаюсь', value: 'enjoy' },
            { text: '😰 Тревожусь', value: 'worry' },
            { text: '😴 Хочу спать', value: 'sleep' },
            { text: '🤔 Думаю о делах', value: 'think' }
        ]
    },
    {
        id: 'q5',
        text: '💭 <b>Вопрос 5 из 5</b>\n\nЧто бы ты хотела изменить в своей жизни прямо сейчас?',
        options: [
            { text: '🧘‍♀️ Отдыхать без вины', value: 'rest' },
            { text: '🗣️ Говорить «нет»', value: 'boundaries' },
            { text: '❤️ Чувствовать тело', value: 'body' },
            { text: '🌿 Найти опору', value: 'grounding' }
        ]
    }
];

function startTest(chatId) {
    const userId = String(chatId);
    const name = getUsersName(userId);
    
    userStates[chatId] = {
        step: 'test',
        currentQuestion: 0,
        answers: [],
        lastActivity: Date.now()
    };
    
    bot.sendMessage(chatId,
        `🧘‍♀️ <b>Отличный выбор, ${name}!</b>\n\nТест «Состояние твоей кружки» поможет тебе:\n• Увидеть, что сейчас переполняет твою кружку\n• Понять, какая область нуждается в заботе\n• Получить рекомендацию, с чего начать\n\n5 вопросов. 2-3 минуты.\nНикаких правильных ответов.\nТолько ты и твои ощущения.\n\n👇 Готова?`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🚀 Начать тест', callback_data: 'start_test' }]
                ]
            }
        }
    );
}

function sendTestQuestion(chatId, index) {
    const state = userStates[chatId];
    if (!state || state.step !== 'test') {
        bot.sendMessage(chatId, '❌ Тест не найден. Начни заново через "🧘‍♀️ Тест состояния"', { parse_mode: 'HTML' });
        return;
    }

    if (index >= testQuestions.length) {
        showTestResult(chatId);
        return;
    }

    const question = testQuestions[index];
    const progress = Math.round((index / testQuestions.length) * 100);
    const progressBar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));
    const text = question.text + `\n\n📊 Прогресс: ${progressBar} ${progress}%`;

    const options = question.options.map(opt => ({
        text: opt.text,
        callback_data: `test_${question.id}_${opt.value}`
    }));

    const keyboard = [];
    for (let i = 0; i < options.length; i += 2) {
        const row = [];
        row.push(options[i]);
        if (i + 1 < options.length) {
            row.push(options[i + 1]);
        }
        keyboard.push(row);
    }

    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}

function showTestResult(chatId) {
    const state = userStates[chatId];
    if (!state || !state.answers) {
        bot.sendMessage(chatId, '❌ Результат теста не найден.', { parse_mode: 'HTML' });
        return;
    }

    const answers = state.answers;
    let score = { 
        tired: 0, anxious: 0, empty: 0, 
        tense: 0, drained: 0, irritated: 0, 
        guilty: 0, worry: 0, light: 0,
        energetic: 0, satisfied: 0, enjoy: 0,
        rest: 0, boundaries: 0, body: 0, grounding: 0
    };

    answers.forEach(a => {
        if (score[a.value] !== undefined) score[a.value]++;
    });

    let resultText = '', resultEmoji = '', personalOffer = '', recommendation = '';

    if (score.tired >= 2 || score.drained >= 2) {
        resultEmoji = '🫠';
        resultText = `<b>Твоя кружка переполнена усталостью</b>`;
        personalOffer = `Ты давно не даёшь себе отдыхать по-настоящему. Ты привыкла быть сильной.`;
        recommendation = `🌿 Тебе помогут практики на восстановление энергии и контакт с телом.`;
    } else if (score.anxious >= 2 || score.worry >= 2 || score.tense >= 2) {
        resultEmoji = '😰';
        resultText = `<b>Твоя кружка переполнена тревогой</b>`;
        personalOffer = `Ты постоянно на взводе. Голова занята делами, а тело зажато.`;
        recommendation = `🌿 Тебе помогут дыхательные практики и пространство тишины.`;
    } else if (score.empty >= 2 || score.disconnected >= 2) {
        resultEmoji = '🌫️';
        resultText = `<b>Твоя кружка почти пуста</b>`;
        personalOffer = `Ты живёшь на автомате. Внутри — пустота.`;
        recommendation = `🌿 Тебе помогут практики заземления и возвращения в тело.`;
    } else if (score.irritated >= 2 || score.guilty >= 2) {
        resultEmoji = '😤';
        resultText = `<b>Твоя кружка переполнена раздражением</b>`;
        personalOffer = `Ты срываешься на близких, а потом чувствуешь вину.`;
        recommendation = `🌿 Тебе помогут практики на выражение эмоций и прощение.`;
    } else {
        resultEmoji = '☀️';
        resultText = `<b>Твоя кружка в равновесии</b>`;
        personalOffer = `Ты умеешь заботиться о себе.`;
        recommendation = `🌿 Есть место для глубины — попробуй практики осознанности.`;
    }

    const userId = String(chatId);
    const data = loadData();
    data.test_results.push({
        user_id: userId,
        answers: state.answers,
        result: resultText.slice(0, 50),
        date: new Date().toISOString()
    });
    saveData(data);
    addPoints(userId, 10, 'Прохождение теста');
    const name = getUsersName(userId);

    const resultMessage = 
`${resultEmoji} <b>Твой результат, ${name}</b>

${resultText}

${personalOffer}

${recommendation}

━━━━━━━━━━━━━━━━
📝 <b>А теперь — дневник состояния</b>

Запиши свои ощущения прямо сейчас.
Как ты себя чувствуешь после теста?
Что откликается в теле?

👇 Напиши в ответ:`;

    bot.sendMessage(chatId, resultMessage, {
        parse_mode: 'HTML'
    });

    userStates[chatId] = {
        step: 'journal_after_test',
        lastActivity: Date.now()
    };

    delete userStates[chatId].answers;
    delete userStates[chatId].currentQuestion;
}

// ================================================
// ===== ПУТЬ ПОЛЬЗОВАТЕЛЯ =====
// ================================================

function showUserPath(chatId) {
    const userId = String(chatId);
    const data = loadData();
    
    const points = getUserPoints(userId);
    const level = getUserLevel(points);
    const journalStats = getJournalStats(userId);
    const tests = data.test_results ? data.test_results.filter(t => t.user_id === userId) : [];
    const daysInBot = data.users.find(u => u.id === userId) ? 
        Math.ceil((Date.now() - new Date(data.users.find(u => u.id === userId).joined_at).getTime()) / (1000 * 60 * 60 * 24)) : 1;
    const name = getUsersName(userId);
    
    let nextLevel = '';
    if (points < 50) {
        nextLevel = '🌿 Исследователь — осталось ' + (50 - points) + ' баллов';
    } else if (points < 150) {
        nextLevel = '🌳 Мастер — осталось ' + (150 - points) + ' баллов';
    } else if (points < 300) {
        nextLevel = '☀️ Проводник — осталось ' + (300 - points) + ' баллов';
    } else if (points < 500) {
        nextLevel = '✨ Мудрец — осталось ' + (500 - points) + ' баллов';
    } else {
        nextLevel = '🌟 Ты достигла высшего уровня!';
    }
    
    let text = 
`🏆 <b>Твой путь, ${name}</b>

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Зачем это нужно?</b>

Это не просто цифры. Это твой дневник движения.

Каждая запись, каждая практика — это шаг к себе.
Здесь ты видишь, как меняешься день за днём.

Когда внутри кажется, что ничего не происходит — ты смотришь сюда и видишь: ты идёшь. Ты делаешь. Ты растешь.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Твоя статистика:</b>

📅 <b>Дней в боте:</b> ${daysInBot}
📖 <b>Дней с записями:</b> ${journalStats.filled}
🧘‍♀️ <b>Тестов пройдено:</b> ${tests.length}
⭐ <b>Баллов:</b> ${points}

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Твой уровень:</b> ${level.emoji} ${level.name}

${nextLevel}

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Как заработать баллы?</b>

🌅 Утренняя практика → +5 баллов
📝 Запись в дневнике → +5 баллов
🧘‍♀️ Прохождение теста → +10 баллов
🤍 Пространство тишины → +3 балла
💬 Отклик на практику → +3 балла

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Уровни:</b>

🌱 Новичок — начало пути
🌿 Исследователь — ты в процессе
🌳 Мастер — ты чувствуешь себя
☀️ Проводник — ты можешь вдохновлять других
✨ Мудрец — ты в контакте с собой

━━━━━━━━━━━━━━━━━━━━━━━━━
💗 Каждый день — шаг к себе.
Ты делаешь это. Продолжай.`;

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

// ================================================
// ===== ПОДПИСКИ =====
// ================================================

function showSubscriptionMenu(chatId, userId) {
    const sub = getSubscriptionStatus(userId);
    const status = {
        morning: sub.morning ? '✅ включена' : '❌ выключена',
        evening: sub.evening ? '✅ включена' : '❌ выключена'
    };
    
    const text = 
`🔔 <b>Управление подписками</b>

Твои текущие подписки:

🌅 Утро: ${status.morning}
🌙 Вечер: ${status.evening}

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Что это даёт?</b>

🌅 <b>УТРО (7:00)</b>
Короткие практики на 5-7 минут.
Помогают проснуться осознанно и настроиться на день.

🌙 <b>ВЕЧЕР (22:00)</b>
Один вопрос для рефлексии.
Помогает завершить день с лёгкостью и благодарностью.

👇 Что хочешь изменить?`;

    const buttons = [];
    if (sub.morning) {
        buttons.push([{ text: '🌅 Отключить утро', callback_data: 'sub_morning_off' }]);
    } else {
        buttons.push([{ text: '🌅 Включить утро', callback_data: 'sub_morning' }]);
    }
    if (sub.evening) {
        buttons.push([{ text: '🌙 Отключить вечер', callback_data: 'sub_evening_off' }]);
    } else {
        buttons.push([{ text: '🌙 Включить вечер', callback_data: 'sub_evening' }]);
    }
    buttons.push([{ text: '🔙 Назад', callback_data: 'back_to_menu' }]);

    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: buttons
        }
    });
}

// ================================================
// ===== КОМАНДА /START =====
// ================================================

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Гость';
    const userId = String(msg.from.id);

    console.log(`✅ Команда /start от ${firstName}`);

    const data = loadData();
    
    if (!data.users.some(u => u.id === userId)) {
        data.users.push({
            id: userId,
            username: msg.from.username || 'без_юзернейма',
            first_name: firstName,
            joined_at: new Date().toISOString()
        });
        saveData(data);
        addPoints(userId, 5, 'Первый вход в бота');
    }

    userAnswers[userId] = {
        name: '',
        answers: {},
        step: 0,
        stage: 'greeting'
    };

    const welcomeText = 
`☕ Привет!

Я — бот «Кружка».
Меня создал Егор Карпов — наставник, целитель и проводник.

Я здесь, чтобы помочь тебе услышать себя.
Находить опору. Замечать своё состояние. Просто быть.

Ты знаешь, почему я назван «Кружка»?

👇 Хочешь узнать историю?`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '☕ Да, расскажи', callback_data: 'kruzhka_story' }],
                [{ text: '💫 Пропустить', callback_data: 'kruzhka_skip' }]
            ]
        }
    });
});

// ================================================
// ===== ОБРАБОТКА КОМАНД =====
// ================================================

bot.onText(/\/feedback/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const name = getUsersName(userId);
    
    bot.sendMessage(chatId,
        `💬 <b>Обратная связь, ${name}</b>\n\n✍️ Напиши всё, что хочешь сказать, в ответ на это сообщение.\n\n💗 Твоё мнение очень важно!`,
        { parse_mode: 'HTML' }
    );
    
    userStates[chatId] = { 
        step: 'feedback', 
        lastActivity: Date.now() 
    };
});

bot.onText(/\/help/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const name = getUsersName(userId);
    
    const helpText = 
`❓ <b>Помощь, ${name}</b>

Этот бот помогает заботиться о себе.

<b>Быстрые команды:</b>
/start — начать заново
/feedback — оставить обратную связь
/help — эта справка

<b>Основные функции:</b>
🧘‍♀️ Тест состояния — понять себя
🌅 Утренние практики — забота о себе
🌙 Вечерние вопросы — рефлексия
📖 Годовой дневник — путь к себе
🏆 Мой путь — видеть прогресс
🤍 Пространство тишины — остановиться
🗓️ Встречи — живое общение
💬 Обратная связь — твои пожелания

💗 Я здесь, чтобы быть рядом.`;
    
    bot.sendMessage(chatId, helpText, { parse_mode: 'HTML' });
});

// ================================================
// ===== ОБРАБОТКА КОЛБЭКОВ =====
// ================================================

bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = String(chatId);
    const userData = userAnswers[userId];
    
    bot.answerCallbackQuery(query.id);

    // ===== КРУЖКА =====
    if (data === 'kruzhka_story') {
        bot.deleteMessage(chatId, query.message.message_id);
        sendKruzhkaStory(chatId);
        return;
    }

    if (data === 'kruzhka_ready') {
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `✨ <b>Это пространство создал Егор Карпов.</b>

Он вложил в этот бот свою душу и опыт.
Позволь мне познакомить тебя с ним...

👇 Хочешь увидеть, как выглядит мой создатель?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📸 Показать фото', callback_data: 'egor_photos' }],
                        [{ text: '💫 Пропустить', callback_data: 'egor_skip' }]
                    ]
                }
            }
        );
        return;
    }

    if (data === 'kruzhka_skip') {
        bot.deleteMessage(chatId, query.message.message_id);
        showBotFeatures(chatId);
        return;
    }

    // ===== ЕГОР =====
    if (data === 'egor_photos') {
        bot.deleteMessage(chatId, query.message.message_id);
        sendEgorPhotosAsAlbum(chatId);
        setTimeout(() => {
            showEgorInfo(chatId, 'about');
        }, 1500);
        return;
    }

    if (data === 'egor_skip') {
        bot.deleteMessage(chatId, query.message.message_id);
        showBotFeatures(chatId);
        return;
    }

    if (data === 'continue_to_bot') {
        bot.deleteMessage(chatId, query.message.message_id);
        showBotFeatures(chatId);
        return;
    }

    // ===== ФУНКЦИИ БОТА =====
    if (data === 'feature_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'test');
        return;
    }

    if (data === 'feature_morning') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'morning');
        return;
    }

    if (data === 'feature_evening') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'evening');
        return;
    }

    if (data === 'feature_journal') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'journal');
        return;
    }

    if (data === 'feature_path') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'path');
        return;
    }

    if (data === 'feature_silence') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'silence');
        return;
    }

    if (data === 'feature_events') {
        bot.deleteMessage(chatId, query.message.message_id);
        showFeatureDescription(chatId, 'events');
        return;
    }

    // ✅ ИСПРАВЛЕНО: возврат к списку функций
    if (data === 'feature_list') {
        bot.deleteMessage(chatId, query.message.message_id);
        showBotFeatures(chatId);
        return;
    }

    // ✅ ИСПРАВЛЕНО: переход к знакомству
    if (data === 'features_done') {
        bot.deleteMessage(chatId, query.message.message_id);
        startUserIntro(chatId);
        return;
    }

    // ===== ИНТРО =====
    if (data === 'intro_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        startTest(chatId);
        return;
    }

    if (data === 'intro_practice') {
        bot.deleteMessage(chatId, query.message.message_id);
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        const name = userData ? userData.name : 'дорогая';
        bot.sendMessage(chatId,
            `🌅 <b>Прекрасный выбор, ${name}!</b>\n\nПрактика — это твой личный ритуал заботы.\nОна поможет тебе:\n• Вернуться в тело\n• Почувствовать опору\n• Настроиться на день\n\nВот практика для тебя прямо сейчас:\n\n${practice.title}\n\n${practice.text}\n\n💗 После выполнения напиши пару слов о своих ощущениях.\nЭто поможет закрепить состояние.`,
            { parse_mode: 'HTML' }
        );
        addPoints(userId, 5, 'Утренняя практика');
        setTimeout(() => {
            bot.sendMessage(chatId,
                `📬 <b>Кстати!</b>\n\nТы можешь получать такие практики каждое утро в 7:00.\nХочешь подписаться?`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Да, подписаться на утро', callback_data: 'sub_morning' }],
                            [{ text: '🌙 И на вечерние вопросы тоже', callback_data: 'sub_both' }],
                            [{ text: '💫 Пока нет, спасибо', callback_data: 'sub_skip' }]
                        ]
                    }
                }
            );
        }, 3000);
        return;
    }

    if (data === 'intro_main') {
        bot.deleteMessage(chatId, query.message.message_id);
        const name = userData ? userData.name : '';
        bot.sendMessage(chatId,
            `☕ <b>Добро пожаловать в «Кружку», ${name}!</b>\n\nЗдесь ты всегда можешь найти то, что нужно именно сейчас.\n\n👇 Что тебе сегодня важно?`,
            {
                parse_mode: 'HTML',
                reply_markup: getMainKeyboard().reply_markup
            }
        );
        return;
    }

    // ===== ПОДПИСКИ =====
    if (data === 'sub_morning') {
        updateSubscription(userId, 'morning', true);
        bot.editMessageText(
            `✅ <b>Отлично!</b>\n\nТы подписана на утренние практики.\nКаждое утро в 7:00 я буду присылать тебе новую практику.\n\n💗 Это твой утренний ритуал заботы.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            }
        );
        return;
    }

    if (data === 'sub_evening') {
        updateSubscription(userId, 'evening', true);
        bot.editMessageText(
            `✅ <b>Отлично!</b>\n\nТы подписана на вечерние вопросы.\nКаждый вечер в 22:00 я буду присылать тебе вопрос для рефлексии.\n\n💗 Это поможет завершать день с лёгкостью.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            }
        );
        return;
    }

    if (data === 'sub_both') {
        updateSubscription(userId, 'morning', true);
        updateSubscription(userId, 'evening', true);
        bot.editMessageText(
            `✅ <b>Прекрасно!</b>\n\nТы подписана на утренние практики и вечерние вопросы.\n\n🌅 Каждое утро в 7:00 — практика\n🌙 Каждый вечер в 22:00 — вопрос\n\n💗 Это твой ежедневный ритуал заботы о себе.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            }
        );
        return;
    }

    if (data === 'sub_skip') {
        bot.editMessageText(
            `💫 <b>Хорошо!</b>\n\nТы всегда можешь подписаться позже через раздел «🔔 Управление подписками» в главном меню.\n\n💗 Я здесь, когда ты будешь готова.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML'
            }
        );
        return;
    }

    // ===== УПРАВЛЕНИЕ ПОДПИСКАМИ (ВКЛ/ВЫКЛ) =====
    if (data === 'sub_morning_off') {
        updateSubscription(userId, 'morning', false);
        bot.editMessageText(
            `❌ <b>Утренние практики отключены.</b>\n\nТы больше не будешь получать практики в 7:00.\n\nТы всегда можешь включить их снова через меню подписок.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Назад к подпискам', callback_data: 'go_subscriptions' }]
                    ]
                }
            }
        );
        return;
    }

    if (data === 'sub_evening_off') {
        updateSubscription(userId, 'evening', false);
        bot.editMessageText(
            `❌ <b>Вечерние вопросы отключены.</b>\n\nТы больше не будешь получать вопросы в 22:00.\n\nТы всегда можешь включить их снова через меню подписок.`,
            {
                chat_id: chatId,
                message_id: query.message.message_id,
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔙 Назад к подпискам', callback_data: 'go_subscriptions' }]
                    ]
                }
            }
        );
        return;
    }

    if (data === 'back_to_menu') {
        bot.deleteMessage(chatId, query.message.message_id);
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `☕ <b>Главное меню, ${name}</b>\n\n👇 Что тебе сегодня нужно?`,
            {
                parse_mode: 'HTML',
                reply_markup: getMainKeyboard().reply_markup
            }
        );
        return;
    }

    // ===== ОСНОВНЫЕ ФУНКЦИИ =====
    if (data === 'go_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        startTest(chatId);
        return;
    }

    if (data === 'go_morning') {
        bot.deleteMessage(chatId, query.message.message_id);
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `🌅 <b>Вот практика для тебя, ${name}!</b>\n\n${practice.title}\n\n${practice.text}`,
            { parse_mode: 'HTML' }
        );
        addPoints(userId, 5, 'Утренняя практика');
        const sub = getSubscriptionStatus(userId);
        if (!sub.morning) {
            setTimeout(() => {
                bot.sendMessage(chatId,
                    `📬 <b>Хочешь получать такие практики каждое утро?</b>\n\nПодпишись, и я буду присылать их в 7:00.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✅ Да, подписаться', callback_data: 'sub_morning' }],
                                [{ text: '💫 Не сейчас', callback_data: 'sub_skip' }]
                            ]
                        }
                    }
                );
            }, 2000);
        }
        return;
    }

    if (data === 'go_evening') {
        bot.deleteMessage(chatId, query.message.message_id);
        const question = getDailyQuestion('evening');
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `🌙 <b>Вечерний вопрос для тебя, ${name}!</b>\n\n${question}\n\n📝 Напиши ответ в ответ на это сообщение.`,
            { parse_mode: 'HTML' }
        );
        const sub = getSubscriptionStatus(userId);
        if (!sub.evening) {
            setTimeout(() => {
                bot.sendMessage(chatId,
                    `📬 <b>Хочешь получать такие вопросы каждый вечер?</b>\n\nПодпишись, и я буду присылать их в 22:00.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '✅ Да, подписаться', callback_data: 'sub_evening' }],
                                [{ text: '💫 Не сейчас', callback_data: 'sub_skip' }]
                            ]
                        }
                    }
                );
            }, 2000);
        }
        return;
    }

    if (data === 'go_silence') {
        bot.deleteMessage(chatId, query.message.message_id);
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `🤍 <b>Пространство тишины, ${name}</b>\n\nСейчас я предлагаю тебе остановиться.\n\nПросто закрой глаза на 30 секунд.\nПочувствуй своё дыхание.\nТы в безопасности.\n\nЯ подожду. 💗`,
            { parse_mode: 'HTML' }
        );
        setTimeout(() => {
            bot.sendMessage(chatId,
                `✨ <b>Ты вернулась.</b>\n\nЭто уже много.\n\n💗 Ты — ценность. Твой путь — важен.\n\n+3 балла за заботу о себе.`,
                { parse_mode: 'HTML' }
            );
            addPoints(userId, 3, 'Пространство тишины');
        }, 30000);
        return;
    }

    if (data === 'go_journal') {
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `📖 <b>Годовой дневник состояния</b>\n\n👇 <b>Открой дневник по ссылке:</b>\n\n<a href="https://karpovegor235.github.io/kruzhka-journal/">📖 Открыть годовой дневник</a>\n\n💗 Заполняй его каждый день — это твой путь к себе.`,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
        return;
    }

    if (data === 'go_path') {
        bot.deleteMessage(chatId, query.message.message_id);
        showUserPath(chatId);
        return;
    }

    if (data === 'go_about') {
        bot.deleteMessage(chatId, query.message.message_id);
        const text = 
`📋 <b>О проекте «Кружка»</b>

«Кружка» — это пространство, где можно остановиться и услышать себя.

Создатель проекта — <b>Егор Карпов</b>.

<b>Кто такой Егор?</b>
🌿 Наставник, целитель и проводник
🧘‍♂️ Обучает проводников гвоздестояния
🔥 Проводит индивидуальные практики для глубокого понимания себя
🧬 Работает с авторским методом системных расстановок
🪵 Практикует доски садху
🧠 Исцеляет через работу с подсознанием

<b>Где встретиться с Егором?</b>
📖 В этом боте — практики, тест, дневник
📞 На индивидуальной консультации
🧘‍♀️ На офлайн-тренинге «Кружка» (22 августа, Минск)

💗 Ты всегда можешь написать Егору через бота — он отвечает лично.`;

        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return;
    }

    if (data === 'go_write') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = { step: 'ask_question', lastActivity: Date.now() };
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `💬 <b>Написать Егору, ${name}</b>\n\nНапиши мне всё, что сейчас внутри.\nИли задай вопрос.\n\nЯ отвечу. 💗\n\n✍️ Просто напиши сообщение в ответ.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'go_help') {
        bot.deleteMessage(chatId, query.message.message_id);
        const text = 
`❓ <b>Как пользоваться ботом «Кружка»</b>

Это твой карманный инструмент для состояния.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🧘‍♀️ ТЕСТ СОСТОЯНИЯ</b>
→ 5 вопросов о состоянии
→ Результат + рекомендация

<b>🌅 УТРЕННИЕ ПРАКТИКИ</b>
→ Короткие упражнения (5-7 мин)
→ Можно подписаться на 7:00

<b>🌙 ВЕЧЕРНИЕ ВОПРОСЫ</b>
→ Вопрос для рефлексии
→ Можно подписаться на 22:00

<b>📖 ГОДОВОЙ ДНЕВНИК</b>
→ Ежедневная рефлексия
→ Ссылка на веб-дневник

<b>🏆 МОЙ ПУТЬ</b>
→ Статистика и прогресс
→ Уровни от Новичка до Мудреца

<b>🤍 ПРОСТРАНСТВО ТИШИНЫ</b>
→ 30 секунд тишины
→ Доступно в любой момент

<b>🗓️ ВСТРЕЧИ И СОБЫТИЯ</b>
→ Тренинги, ретриты
→ Живое общение

<b>🔔 УПРАВЛЕНИЕ ПОДПИСКАМИ</b>
→ Включить/выключить
→ Утро и вечер

<b>💬 ОБРАТНАЯ СВЯЗЬ</b>
→ Твои пожелания и предложения

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📌 СОВЕТ:</b>
Начни с теста — это поможет понять,
что сейчас важно именно тебе.

💗 Бот — для тебя, а не ты — для бота.`;

        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return;
    }

    if (data === 'go_training') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = { step: 'consultation', lastActivity: Date.now() };
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `📝 <b>Запись на тренинг «Кружка», ${name}</b>\n\n📍 Минск, 22 августа 2026\n⏰ 10:00 – 16:10\n\n<b>Тарифы:</b>\n🟢 «Лёгкий» — 380 BYN\n🟠 «Классика» — 580 BYN\n🟡 «VIP» — 880 BYN\n\n👇 Напиши в ответ:\n1. Твоё имя\n2. Телефон или Telegram\n3. Какой тариф тебе интересен\n\nЯ свяжусь с тобой. 💗`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'go_events') {
        bot.deleteMessage(chatId, query.message.message_id);
        const text = 
`🗓️ <b>Встречи и мероприятия</b>

Я планирую проводить живые встречи в Минске и не только.
Здесь ты узнаешь о ближайших событиях первой.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🧘‍♀️ БЛИЖАЙШИЕ ПЛАНЫ:</b>

<b>🌿 Офлайн-тренинг «Кружка»</b>
📍 Минск, 22 августа 2026
⏰ 10:00 – 16:10

6 часов авторских практик:
• Работа с телом и состоянием
• Освобождение от блоков
• Встреча с собой

<b>📌 Подробности и запись:</b>
Напиши @egor_provedet

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🌟 А ТАКЖЕ В ПЛАНАХ:</b>

• Женские круги в Минске
• Ретриты на природе
• Онлайн-встречи и вебинары
• Гвоздестояние в группах

💗 Следи за обновлениями!`;

        bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 Записаться на тренинг', callback_data: 'go_training' }],
                    [{ text: '💬 Написать Егору', callback_data: 'go_write' }]
                ]
            }
        });
        return;
    }

    if (data === 'go_subscriptions') {
        bot.deleteMessage(chatId, query.message.message_id);
        showSubscriptionMenu(chatId, userId);
        return;
    }

    // ===== ТЕСТ =====
    if (data === 'start_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        const state = userStates[chatId];
        if (state && state.step === 'test') {
            sendTestQuestion(chatId, 0);
        } else {
            startTest(chatId);
        }
        return;
    }

    if (data.startsWith('test_')) {
        const parts = data.split('_');
        const questionId = parts[1];
        const value = parts[2];
        const state = userStates[chatId];
        
        if (!state || state.step !== 'test') {
            bot.sendMessage(chatId, '❌ Начни тест заново через "🧘‍♀️ Тест состояния"', { parse_mode: 'HTML' });
            return;
        }
        
        state.answers.push({ questionId, value });
        state.currentQuestion = (state.currentQuestion || 0) + 1;
        
        bot.deleteMessage(chatId, query.message.message_id);
        
        if (state.currentQuestion >= testQuestions.length) {
            showTestResult(chatId);
        } else {
            sendTestQuestion(chatId, state.currentQuestion);
        }
        return;
    }

    // ===== ДНЕВНИК =====
    if (data.startsWith('journal_morning_')) {
        const parts = data.split('_');
        const dateStr = parts[2];
        const targetUserId = parts[3];
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        userStates[chatId] = {
            step: 'journal_write',
            time: 'morning',
            date: dateStr,
            lastActivity: Date.now()
        };
        const question = getDailyQuestion('morning');
        bot.sendMessage(chatId,
            `🌅 <b>Запись в дневник (утро)</b>\n\n${question}\n\n✍️ Напиши свой ответ в ответ на это сообщение.`,
            { parse_mode: 'HTML' }
        );
        bot.deleteMessage(chatId, query.message.message_id);
        return;
    }

    if (data.startsWith('journal_evening_')) {
        const parts = data.split('_');
        const dateStr = parts[2];
        const targetUserId = parts[3];
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        userStates[chatId] = {
            step: 'journal_write',
            time: 'evening',
            date: dateStr,
            lastActivity: Date.now()
        };
        const question = getDailyQuestion('evening');
        bot.sendMessage(chatId,
            `🌙 <b>Запись в дневник (вечер)</b>\n\n${question}\n\n✍️ Напиши свой ответ в ответ на это сообщение.`,
            { parse_mode: 'HTML' }
        );
        bot.deleteMessage(chatId, query.message.message_id);
        return;
    }
});

// ================================================
// ===== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ =====
// ================================================

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = String(msg.from.id);

    if (!text || text.startsWith('/') || text.startsWith('🧘') || text.startsWith('🌅') || 
        text.startsWith('🌙') || text.startsWith('📖') || text.startsWith('🏆') || 
        text.startsWith('🤍') || text.startsWith('🗓️') || text.startsWith('💬') || 
        text.startsWith('🔔')) {
        return;
    }

    // ===== ЗНАКОМСТВО: ИМЯ =====
    const userData = userAnswers[userId];
    if (userData && userData.stage === 'intro_name') {
        const name = text.trim();
        if (name.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее. Как мне тебя называть?', { parse_mode: 'HTML' });
            return;
        }
        userData.name = name;
        userData.step = 0;
        userData.stage = 'intro_state';
        bot.sendMessage(chatId,
            `❤️ <b>Какое красивое имя, ${name}!</b>\n\nЯ буду называть тебя так.\nКаждый раз, когда я произношу твоё имя, я напоминаю тебе:\nты — важна. ты — есть. ты — ценность.\n\n💭 Теперь расскажи мне, ${name}...\nКакое у тебя сейчас состояние?\nОпиши одним-двумя словами.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    // ===== ЗНАКОМСТВО: СОСТОЯНИЕ =====
    if (userData && userData.stage === 'intro_state') {
        const state = text.trim();
        if (state.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее о своём состоянии.', { parse_mode: 'HTML' });
            return;
        }
        userData.answers.state = state;
        userData.stage = 'intro_reason';
        
        let response = `✨ <b>Спасибо, что делишься, ${userData.name}.</b>\n\n`;
        const lowerState = state.toLowerCase();
        if (lowerState.includes('устал') || lowerState.includes('вымотан') || lowerState.includes('тяжело')) {
            response += `Я слышу твою усталость. Ты носишь так много...\nЭто важно — признавать это.\n\n`;
        } else if (lowerState.includes('тревог') || lowerState.includes('страх') || lowerState.includes('волн')) {
            response += `Тревога — это сигнал. Она говорит о том, что что-то важное ждёт твоего внимания.\nТы не одна.\n\n`;
        } else if (lowerState.includes('хорош') || lowerState.includes('отличн') || lowerState.includes('спокойн')) {
            response += `Как прекрасно, что ты чувствуешь это состояние!\nСохрани его в сердце.\n\n`;
        } else if (lowerState.includes('пусто') || lowerState.includes('ничего')) {
            response += `Пустота — это тоже состояние.\nИногда она говорит о том, что пора остановиться и прислушаться.\n\n`;
        } else {
            response += `Спасибо, что делишься своим состоянием.\nЭто ценный сигнал.\n\n`;
        }
        
        response += `🌟 А теперь скажи, ${userData.name}:\nЧто привело тебя сюда?\nЧто ты ищешь в этом пространстве?`;
        
        bot.sendMessage(chatId, response, { parse_mode: 'HTML' });
        return;
    }

    // ===== ЗНАКОМСТВО: ПРИЧИНА =====
    if (userData && userData.stage === 'intro_reason') {
        const reason = text.trim();
        if (reason.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
            return;
        }
        userData.answers.reason = reason;
        userData.stage = 'intro_done';
        
        let response = `💗 <b>Спасибо за твою честность, ${userData.name}.</b>\n\n`;
        
        const lowerReason = reason.toLowerCase();
        if (lowerReason.includes('себя') || lowerReason.includes('понять') || lowerReason.includes('разобраться')) {
            response += `Понимание себя — самый ценный путь.\nЯ здесь, чтобы помочь тебе в этом.\n\n`;
        } else if (lowerReason.includes('опор') || lowerReason.includes('поддержк')) {
            response += `Опора — это то, что мы часто ищем снаружи, но она всегда внутри.\nЯ помогу тебе её найти.\n\n`;
        } else if (lowerReason.includes('спокойств') || lowerReason.includes('тишин') || lowerReason.includes('отдых')) {
            response += `Спокойствие — это твоё естественное состояние.\nЯ помогу тебе к нему вернуться.\n\n`;
        } else {
            response += `Твой путь начинается здесь. И это уже шаг.\n\n`;
        }
        
        response += `Теперь у тебя есть место, где можно:\n• Услышать себя\n• Восстановить силы\n• Найти опору\n• Просто быть\n\n👇 С чего хочешь начать своё путешествие?`;
        
        bot.sendMessage(chatId, response, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🧘‍♀️ Пройти тест (рекомендую)', callback_data: 'intro_test' }],
                    [{ text: '🌅 Получить утреннюю практику', callback_data: 'intro_practice' }],
                    [{ text: '🏠 В главное меню', callback_data: 'intro_main' }]
                ]
            }
        });
        
        const data = loadData();
        const user = data.users.find(u => u.id === userId);
        if (user) {
            user.intro_answers = userData.answers;
            user.intro_completed = true;
            user.first_name = userData.name;
            user.intro_date = new Date().toISOString();
            saveData(data);
        }
        return;
    }

    // ===== ОБРАБОТКА СОСТОЯНИЙ =====
    const state = userStates[chatId];
    if (!state) {
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `${getTimeGreeting()}, ${name}! 💗\n\nЧто тебе сегодня нужно?`,
            {
                parse_mode: 'HTML',
                reply_markup: getMainKeyboard().reply_markup
            }
        );
        return;
    }

    state.lastActivity = Date.now();

    // ===== ОБРАТНАЯ СВЯЗЬ =====
    if (state.step === 'feedback') {
        const feedbackText = text.trim();
        if (feedbackText.length < 3) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее. Твоё мнение очень важно!', { parse_mode: 'HTML' });
            return;
        }
        
        const userInfo = msg.from;
        const name = getUsersName(userId);
        const data = loadData();
        
        if (!data.feedbacks) data.feedbacks = [];
        data.feedbacks.push({
            user_id: userId,
            name: name,
            username: userInfo.username || 'не указан',
            text: feedbackText,
            date: new Date().toISOString()
        });
        saveData(data);
        
        bot.sendMessage(ADMIN_CHAT_ID,
            `💬 <b>НОВАЯ ОБРАТНАЯ СВЯЗЬ</b>\n\n👤 Имя: ${name}\n📱 Юзернейм: @${userInfo.username || 'не указан'}\n🆔 ID: ${userInfo.id}\n\n📝 Сообщение:\n"${feedbackText}"\n\n📅 ${new Date().toISOString().slice(0, 10)}`,
            { parse_mode: 'HTML' }
        );
        
        bot.sendMessage(chatId,
            `🙏 <b>Огромное спасибо за твою обратную связь, ${name}!</b>\n\nЯ передал твои пожелания Егору.\nКаждое твоё слово помогает делать бота лучше.\n\n💗 Ты — важная часть этого пространства.`,
            { parse_mode: 'HTML' }
        );
        
        clearUserState(chatId);
        
        setTimeout(() => {
            bot.sendMessage(chatId,
                `☕ <b>Что дальше, ${name}?</b>`,
                {
                    parse_mode: 'HTML',
                    reply_markup: getMainKeyboard().reply_markup
                }
            );
        }, 1000);
        return;
    }

    // ===== ДНЕВНИК =====
    if (state.step === 'journal_write') {
        const entryText = text.trim();
        if (entryText.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
            return;
        }
        const data = loadData();
        if (!data.journal_days) data.journal_days = [];
        let entry = data.journal_days.find(e => e.user_id === userId && e.date === state.date);
        if (!entry) {
            entry = { user_id: userId, date: state.date, morning: '', evening: '', morningMood: '', eveningMood: '' };
            data.journal_days.push(entry);
        }
        entry[state.time === 'morning' ? 'morning' : 'evening'] = entryText;
        saveData(data);
        addPoints(userId, 5, `Запись в дневнике (${state.time})`);
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена, ${name}!</b>\n\n💗 Спасибо, что делишься. Это помогает видеть свой путь.\n\n${getEncouragingMessage()}`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        return;
    }

    // ===== ДНЕВНИК ПОСЛЕ ТЕСТА =====
    if (state.step === 'journal_after_test') {
        const entryText = text.trim();
        if (entryText.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее о своих ощущениях.', { parse_mode: 'HTML' });
            return;
        }
        const data = loadData();
        data.journal_entries.push({
            user_id: userId,
            mood: '🧘‍♀️ После теста',
            text: entryText,
            date: new Date().toISOString()
        });
        saveData(data);
        addPoints(userId, 5, 'Запись в дневнике после теста');
        const name = getUsersName(userId);
        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена, ${name}!</b>\n\n💗 Спасибо, что делишься. Это помогает видеть свой прогресс.\n\n${getEncouragingMessage()}`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId,
            `☕ <b>Что дальше, ${name}?</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: getMainKeyboard().reply_markup
            }
        );
        return;
    }

    // ===== ВОПРОС ЕГОРУ =====
    if (state.step === 'ask_question') {
        const question = text.trim();
        if (question.length < 3) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
            return;
        }
        const userInfo = msg.from;
        const name = getUsersName(userId);
        bot.sendMessage(ADMIN_CHAT_ID,
            `❓ <b>ВОПРОС ОТ УЧАСТНИЦЫ</b>\n\n👤 Имя: ${name}\n📱 Юзернейм: @${userInfo.username || 'не указан'}\n🆔 ID: ${userInfo.id}\n\n📝 Вопрос: "${question}"\n\n📅 ${new Date().toISOString().slice(0, 10)}`,
            { parse_mode: 'HTML' }
        );
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо за вопрос, ${name}!</b>\n\nЯ передал его Егору. Он ответит в ближайшее время.\n\n💗 Твой голос важен.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId,
            `☕ <b>Что дальше, ${name}?</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: getMainKeyboard().reply_markup
            }
        );
        return;
    }

    // ===== КОНСУЛЬТАЦИЯ =====
    if (state.step === 'consultation') {
        const consultationText = text.trim();
        if (consultationText.length < 5) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
            return;
        }
        const userInfo = msg.from;
        const name = getUsersName(userId);
        const data = loadData();
        data.consultations.push({
            user_id: userId,
            name: name,
            username: userInfo.username || 'не указан',
            text: consultationText,
            date: new Date().toISOString()
        });
        saveData(data);
        bot.sendMessage(ADMIN_CHAT_ID,
            `📞 <b>ЗАПРОС НА КОНСУЛЬТАЦИЮ</b>\n\n👤 Имя: ${name}\n📱 Юзернейм: @${userInfo.username || 'не указан'}\n🆔 ID: ${userInfo.id}\n\n📝 Запрос: "${consultationText}"\n\n📅 ${new Date().toISOString().slice(0, 10)}`,
            { parse_mode: 'HTML' }
        );
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо, ${name}!</b>\n\nЯ получил твой запрос. Я свяжусь с тобой в ближайшее время.\n\n💗`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId,
            `☕ <b>Что дальше, ${name}?</b>`,
            {
                parse_mode: 'HTML',
                reply_markup: getMainKeyboard().reply_markup
            }
        );
        return;
    }
});

// ================================================
// ===== ОБРАБОТКА КНОПОК ГЛАВНОГО МЕНЮ =====
// ================================================

bot.onText(/🧘‍♀️ Тест состояния/, (msg) => {
    const chatId = msg.chat.id;
    startTest(chatId);
});

bot.onText(/🌅 Утренние практики/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
    const practice = getMorningPractice(dayOffset);
    const name = getUsersName(userId);
    bot.sendMessage(chatId,
        `🌅 <b>Вот практика для тебя, ${name}!</b>\n\n${practice.title}\n\n${practice.text}`,
        { parse_mode: 'HTML' }
    );
    addPoints(userId, 5, 'Утренняя практика');
    const sub = getSubscriptionStatus(userId);
    if (!sub.morning) {
        setTimeout(() => {
            bot.sendMessage(chatId,
                `📬 <b>Хочешь получать такие практики каждое утро?</b>\n\nПодпишись, и я буду присылать их в 7:00.`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Да, подписаться', callback_data: 'sub_morning' }],
                            [{ text: '💫 Не сейчас', callback_data: 'sub_skip' }]
                        ]
                    }
                }
            );
        }, 2000);
    }
});

bot.onText(/🌙 Вечерние вопросы/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const question = getDailyQuestion('evening');
    const name = getUsersName(userId);
    bot.sendMessage(chatId,
        `🌙 <b>Вечерний вопрос для тебя, ${name}!</b>\n\n${question}\n\n📝 Напиши ответ в ответ на это сообщение.`,
        { parse_mode: 'HTML' }
    );
    const sub = getSubscriptionStatus(userId);
    if (!sub.evening) {
        setTimeout(() => {
            bot.sendMessage(chatId,
                `📬 <b>Хочешь получать такие вопросы каждый вечер?</b>\n\nПодпишись, и я буду присылать их в 22:00.`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '✅ Да, подписаться', callback_data: 'sub_evening' }],
                            [{ text: '💫 Не сейчас', callback_data: 'sub_skip' }]
                        ]
                    }
                }
            );
        }, 2000);
    }
});

bot.onText(/📖 Годовой дневник/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `📖 <b>Годовой дневник состояния</b>\n\n👇 <b>Открой дневник по ссылке:</b>\n\n<a href="https://karpovegor235.github.io/kruzhka-journal/">📖 Открыть годовой дневник</a>\n\n💗 Заполняй его каждый день — это твой путь к себе.`,
        {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        }
    );
});

bot.onText(/🏆 Мой путь/, (msg) => {
    const chatId = msg.chat.id;
    showUserPath(chatId);
});

bot.onText(/🤍 Пространство тишины/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const name = getUsersName(userId);
    bot.sendMessage(chatId,
        `🤍 <b>Пространство тишины, ${name}</b>\n\nСейчас я предлагаю тебе остановиться.\n\nПросто закрой глаза на 30 секунд.\nПочувствуй своё дыхание.\nТы в безопасности.\n\nЯ подожду. 💗`,
        { parse_mode: 'HTML' }
    );
    setTimeout(() => {
        bot.sendMessage(chatId,
            `✨ <b>Ты вернулась.</b>\n\nЭто уже много.\n\n💗 Ты — ценность. Твой путь — важен.\n\n+3 балла за заботу о себе.`,
            { parse_mode: 'HTML' }
        );
        addPoints(userId, 3, 'Пространство тишины');
    }, 30000);
});

bot.onText(/🗓️ Встречи и события/, (msg) => {
    const chatId = msg.chat.id;
    const text = 
`🗓️ <b>Встречи и мероприятия</b>

Я планирую проводить живые встречи в Минске и не только.
Здесь ты узнаешь о ближайших событиях первой.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🧘‍♀️ БЛИЖАЙШИЕ ПЛАНЫ:</b>

<b>🌿 Офлайн-тренинг «Кружка»</b>
📍 Минск, 22 августа 2026
⏰ 10:00 – 16:10

6 часов авторских практик:
• Работа с телом и состоянием
• Освобождение от блоков
• Встреча с собой

<b>📌 Подробности и запись:</b>
Напиши @egor_provedet

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🌟 А ТАКЖЕ В ПЛАНАХ:</b>

• Женские круги в Минске
• Ретриты на природе
• Онлайн-встречи и вебинары
• Гвоздестояние в группах

💗 Следи за обновлениями!`;

    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📝 Записаться на тренинг', callback_data: 'go_training' }],
                [{ text: '💬 Написать Егору', callback_data: 'go_write' }]
            ]
        }
    });
});

bot.onText(/💬 О проекте/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const name = getUsersName(userId);
    
    bot.sendMessage(chatId,
        `💬 <b>О проекте и связь, ${name}</b>\n\nЧто тебя интересует?\n\n👇 Выбери:`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📋 О проекте', callback_data: 'go_about' }],
                    [{ text: '💬 Написать Егору', callback_data: 'go_write' }],
                    [{ text: '❓ Помощь', callback_data: 'go_help' }]
                ]
            }
        }
    );
});

bot.onText(/💬 Обратная связь/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const name = getUsersName(userId);
    
    bot.sendMessage(chatId,
        `💬 <b>Обратная связь, ${name}</b>\n\nЯ очень ценю твоё мнение!\n\nТы можешь поделиться:\n• Что тебе нравится в боте?\n• Что хотелось бы улучшить?\n• Какие практики или функции добавить?\n• Любые пожелания и предложения\n\n✍️ Напиши всё, что хочешь сказать, в ответ на это сообщение.\n\n💗 Каждое твоё слово помогает делать бота лучше!`,
        { parse_mode: 'HTML' }
    );
    
    userStates[chatId] = { 
        step: 'feedback', 
        lastActivity: Date.now() 
    };
});

bot.onText(/🔔 Управление подписками/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    showSubscriptionMenu(chatId, userId);
});

// ================================================
// ===== КОМАНДЫ ДЛЯ АДМИНА =====
// ================================================

bot.onText(/\/status/, (msg) => {
    if (msg.from.id !== 490337942) return;
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const data = loadData();
    const subs = data.subscriptions || [];
    const morningSubs = subs.filter(s => s.morning).length;
    const eveningSubs = subs.filter(s => s.evening).length;
    const feedbacks = data.feedbacks ? data.feedbacks.length : 0;
    bot.sendMessage(msg.chat.id,
        `📊 <b>Статус бота</b>\n\n⏱ Работает: ${hours}ч ${minutes}м\n👥 Пользователей: ${data.users.length}\n📝 Записей: ${data.journal_entries?.length || 0}\n🧘 Тестов: ${data.test_results?.length || 0}\n🌅 Утренних подписок: ${morningSubs}\n🌙 Вечерних подписок: ${eveningSubs}\n💬 Обратной связи: ${feedbacks}`,
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/users/, (msg) => {
    if (msg.from.id !== 490337942) return;
    const data = loadData();
    let text = `👥 Пользователей: ${data.users.length}\n\n`;
    if (data.users.length > 0) {
        text += data.users.slice(0, 10).map((u, i) => `${i+1}. ${u.first_name} (@${u.username || 'нет'})`).join('\n');
        if (data.users.length > 10) text += `\n... и еще ${data.users.length - 10}`;
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

bot.onText(/\/test_morning/, (msg) => {
    if (msg.from.id !== 490337942) return;
    bot.sendMessage(msg.chat.id, '🧪 Тестирую утреннюю рассылку...');
    sendMorningPractice();
});

bot.onText(/\/test_evening/, (msg) => {
    if (msg.from.id !== 490337942) return;
    bot.sendMessage(msg.chat.id, '🧪 Тестирую вечернюю рассылку...');
    sendEveningQuestion();
});

bot.onText(/\/broadcast/, (msg) => {
    if (msg.from.id !== 490337942) return;
    const text = msg.text.replace('/broadcast', '').trim();
    if (!text) {
        bot.sendMessage(msg.chat.id,
            `📢 <b>Инструкция по рассылке</b>\n\nЧтобы отправить сообщение всем участникам, напиши:\n\n<code>/broadcast Текст вашего сообщения</code>\n\n📊 Сейчас в базе: <b>${loadData().users.length}</b> участников.`,
            { parse_mode: 'HTML' }
        );
        return;
    }
    const data = loadData();
    let successCount = 0;
    for (const user of data.users) {
        try {
            bot.sendMessage(user.id, text, { parse_mode: 'HTML' });
            successCount++;
            setTimeout(() => {}, 50);
        } catch (e) {}
    }
    bot.sendMessage(msg.chat.id,
        `📊 <b>Отчёт о рассылке</b>\n\n✅ Успешно: ${successCount}\n👥 Всего: ${data.users.length}`,
        { parse_mode: 'HTML' }
    );
});

// ================================================
// ===== ЗАПУСК =====
// ================================================

scheduleDailyMessages();

console.log('✅ Бот готов к работе!');
console.log(`📌 Ссылка: https://t.me/kruzhka_new_bot`);
console.log(`📨 Админ: ${ADMIN_USERNAME}`);
console.log('⏰ Утренняя рассылка: 7:00');
console.log('⏰ Вечерняя рассылка: 22:00');

process.on('uncaughtException', (error) => {
    console.log('⚠️ Ошибка:', error.message);
});

process.on('SIGINT', () => {
    console.log('🛑 Бот остановлен');
    process.exit(0);
});