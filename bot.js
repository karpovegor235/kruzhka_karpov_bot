const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const http = require('http');

// ===== ТОКЕН БОТА =====
const TOKEN = '8831398856:AAGqDAVaVYk-G9WF1ny6gbvu1kGKFC0PCP0';

// ===== ТВОЙ TELEGRAM ID =====
const ADMIN_CHAT_ID = '490337942';
const ADMIN_USERNAME = '@egor_provedet';

console.log('🤖 Бот: @kruzhka_karpov_bot');
console.log('✅ Токен загружен');

// ===== СОЗДАНИЕ БОТА =====
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

// СОЗДАЕМ HTTP СЕРВЕР
const server = http.createServer((req, res) => {
    // Обработка пингов от UptimeRobot
    if (req.url === '/' || req.url === '/ping') {
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        });
        res.end(JSON.stringify({
            status: 'ok',
            time: new Date().toISOString(),
            bot: 'Kruzhka Bot',
            users: loadData().users.length,
            uptime: Math.floor(process.uptime())
        }));
        console.log(`🏓 Пинг в ${new Date().toLocaleTimeString()}`);
        return;
    }
    
    // Для всех остальных запросов
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 HTTP сервер на порту ${PORT}`);
    console.log(`🔗 UptimeRobot URL: https://kruzhka-bot.onrender.com`);
    console.log(`✅ Бот готов к пингам!`);
});

// ===== ВНУТРЕННИЙ ПИНГ =====
setInterval(() => {
    const req = http.request({
        hostname: 'localhost',
        port: PORT,
        path: '/',
        method: 'GET'
    }, (res) => {
        // Просто держим соединение
    });
    req.on('error', () => {});
    req.end();
}, 4 * 60 * 1000);

console.log('🔋 Keep-Alive активирован!');

// ===== ФАЙЛ ДЛЯ ХРАНЕНИЯ ДАННЫХ =====
const DATA_FILE = 'data.json';

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
        registrations: [], 
        gifts: [], 
        test_results: [], 
        daily_practices: [],
        journal_entries: [],
        feedbacks: [],
        points: [],
        consultations: [],
        journal_days: []
    };
}

function saveData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
        console.error('❌ Ошибка сохранения данных:', e.message);
    }
}

// ===== СОСТОЯНИЯ ПОЛЬЗОВАТЕЛЕЙ =====
const userStates = {};

// ================================================
// ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ =====
// ================================================

function getDaysUntilTraining() {
    const trainingDate = new Date(2026, 7, 22);
    const now = new Date();
    const diff = Math.ceil((trainingDate - now) / (1000 * 60 * 60 * 24));
    if (diff < 0) return 0;
    return diff;
}

function getTrainingDate() {
    return '22 августа 2026';
}

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

function getJournalEntries(userId) {
    const data = loadData();
    return data.journal_entries ? data.journal_entries.filter(e => e.user_id === userId) : [];
}

function getUserPractices(userId) {
    const data = loadData();
    const feedbacks = data.feedbacks ? data.feedbacks.filter(f => f.user_id === userId) : [];
    return feedbacks.length;
}

// ================================================
// ===== ФУНКЦИИ ДЛЯ ГОДОВОГО ДНЕВНИКА =====
// ================================================

function getDayEntry(userId, dateStr) {
    const data = loadData();
    if (!data.journal_days) data.journal_days = [];
    let entry = data.journal_days.find(e => e.user_id === userId && e.date === dateStr);
    if (!entry) {
        entry = {
            user_id: userId,
            date: dateStr,
            morning: '',
            evening: '',
            morningMood: '',
            eveningMood: ''
        };
        data.journal_days.push(entry);
        saveData(data);
    }
    return entry;
}

function saveDayEntry(userId, dateStr, field, value) {
    const data = loadData();
    if (!data.journal_days) data.journal_days = [];
    let entry = data.journal_days.find(e => e.user_id === userId && e.date === dateStr);
    if (!entry) {
        entry = {
            user_id: userId,
            date: dateStr,
            morning: '',
            evening: '',
            morningMood: '',
            eveningMood: ''
        };
        data.journal_days.push(entry);
    }
    entry[field] = value;
    saveData(data);
}

function getUserDays(userId) {
    const data = loadData();
    if (!data.journal_days) return [];
    return data.journal_days.filter(e => e.user_id === userId);
}

function getJournalStats(userId) {
    const entries = getUserDays(userId);
    const filled = entries.filter(e => e.morning || e.evening);
    const total = entries.length;
    
    let streak = 0;
    const today = new Date();
    let checkDate = new Date(today);
    
    while (true) {
        const dateStr = checkDate.toISOString().slice(0, 10);
        const entry = entries.find(e => e.date === dateStr);
        if (entry && (entry.morning || entry.evening)) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
        } else {
            break;
        }
    }
    
    return { total, filled: filled.length, streak };
}

function getDailyQuestion(type) {
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
    const morningQuestions = [
        '🌅 С каким настроением ты просыпаешься сегодня?',
        '🌅 Что ты чувствуешь в теле этим утром?',
        '🌅 Какое намерение у тебя на сегодня?',
        '🌅 Что бы ты хотела сохранить в себе сегодня?',
        '🌅 За что ты благодарна этому дню?'
    ];
    const eveningQuestions = [
        '🌙 Что было самым важным для тебя сегодня?',
        '🌙 За что ты благодарна себе сегодня?',
        '🌙 Что тебе сегодня удалось?',
        '🌙 Что бы ты хотела отпустить перед сном?',
        '🌙 Какое состояние у тебя сейчас?'
    ];
    
    const questions = type === 'morning' ? morningQuestions : eveningQuestions;
    return questions[dayOfYear % questions.length];
}

// ================================================
// ===== ГЛАВНАЯ КЛАВИАТУРА (5 КНОПОК) =====
// ================================================
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🧘‍♀️ Практики и тест' }],
            [{ text: '📖 Дневники' }],
            [{ text: '🗓️ Встречи и мероприятия' }],
            [{ text: '🏆 Мой путь' }],
            [{ text: '💬 О проекте и связь' }]
        ],
        resize_keyboard: true
    }
};

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

2️⃣ Сделай 3 глубоких вдоха и выдоха.
На вдохе — «Я вдыхаю свет».
На выдохе — «Я выдыхаю напряжение».

3️⃣ Положи руку на сердце. Почувствуй его тепло.

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

2️⃣ Медленно называй части тела и благодари их:
«Спасибо, ноги, за то, что несёшь меня».
«Спасибо, руки, за то, что создаёшь, обнимаешь».
«Спасибо, сердце, за то, что любишь и чувствуешь».
«Спасибо, дыхание, за то, что ты есть».

3️⃣ Положи одну руку на сердце, другую — на живот.
Скажи: «Моё тело — мой дом. Я благодарю его».

💗 <b>После:</b> Улыбнись себе в зеркало.`
    },
    {
        id: 'mp3',
        title: '☀️ Я здесь',
        text: `☀️ <b>Практика: «Я здесь»</b>

🕐 <b>Время:</b> 5 минут

<b>Что делать:</b>

1️⃣ Сядь удобно, закрой глаза.

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
// ===== ВЕЧЕРНИЕ ВОПРОСЫ =====
// ================================================
const eveningQuestions = [
    'Что было самым важным для тебя сегодня?',
    'За что ты благодарна себе сегодня?',
    'Что я сегодня чувствовала? Какие эмоции были самыми яркими?',
    'Что я могу отпустить перед сном?',
    'Какое у меня было состояние сегодня? Что я заметила в себе?',
    'Что я хочу сделать завтра для себя?',
    'Что сегодня было самым сложным? Что помогло справиться?'
];

function getEveningQuestion(index) {
    return eveningQuestions[index % eveningQuestions.length];
}

// ================================================
// ===== ОТПРАВКА РАССЫЛОК =====
// ================================================

// Функция для отправки утренней практики
async function sendMorningPractice() {
    const data = loadData();
    const users = data.users || [];
    const today = new Date().toISOString().slice(0, 10);
    
    console.log(`🌅 Попытка отправки утренней практики ${users.length} пользователям`);
    
    if (users.length === 0) {
        console.log('⚠️ Нет пользователей для рассылки');
        return;
    }
    
    const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
    const practice = getMorningPractice(dayOffset);
    const question = getDailyQuestion('morning');
    
    let successCount = 0;
    let failCount = 0;
    let firstError = null;
    
    for (const user of users) {
        try {
            await bot.sendMessage(user.id,
                `${practice.title}\n\n${practice.text}\n\n━━━━━━━━━━━━━━━━\n📖 <b>Дневник: утро</b>\n\n${question}\n\n✍️ Напиши ответ в ответ на это сообщение, и я сохраню его в твой дневник.\n\n💗 Поделись ощущениями:`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📝 Записать в дневник', callback_data: `journal_morning_${today}_${user.id}` }],
                            [{ text: '💬 Поделиться', callback_data: `share_feeling_${user.id}` }]
                        ]
                    }
                }
            );
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
            failCount++;
            if (!firstError) firstError = e.message;
            console.log(`⚠️ Не удалось отправить практику пользователю ${user.id}: ${e.message}`);
        }
    }
    
    console.log(`📅 Утренние практики: ${successCount} успешно, ${failCount} ошибок`);
    
    // Отправить отчет админу
    try {
        await bot.sendMessage(ADMIN_CHAT_ID,
            `📊 <b>Отчет об утренней рассылке</b>\n\n` +
            `✅ Успешно: ${successCount}\n` +
            `❌ Ошибок: ${failCount}\n` +
            `👥 Всего: ${users.length}\n` +
            `${firstError ? `\n⚠️ Первая ошибка: ${firstError}` : ''}`,
            { parse_mode: 'HTML' }
        );
    } catch (e) {
        console.log('Не удалось отправить отчет админу');
    }
}

// Функция для отправки вечернего вопроса
async function sendEveningQuestion() {
    const data = loadData();
    const users = data.users || [];
    const today = new Date().toISOString().slice(0, 10);
    
    console.log(`🌙 Попытка отправки вечернего вопроса ${users.length} пользователям`);
    
    if (users.length === 0) {
        console.log('⚠️ Нет пользователей для рассылки');
        return;
    }
    
    const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
    const question = getEveningQuestion(dayOffset);
    const journalQuestion = getDailyQuestion('evening');
    
    let successCount = 0;
    let failCount = 0;
    let firstError = null;
    
    for (const user of users) {
        try {
            await bot.sendMessage(user.id,
                `🌙 <b>Вечерний вопрос:</b>\n\n${question}\n\n━━━━━━━━━━━━━━━━\n📖 <b>Дневник: вечер</b>\n\n${journalQuestion}\n\n✍️ Напиши ответ в ответ на это сообщение, и я сохраню его в твой дневник.\n\n💗 Спокойной ночи.`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📝 Записать в дневник', callback_data: `journal_evening_${today}_${user.id}` }]
                        ]
                    }
                }
            );
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
            failCount++;
            if (!firstError) firstError = e.message;
            console.log(`⚠️ Не удалось отправить вопрос пользователю ${user.id}: ${e.message}`);
        }
    }
    
    console.log(`📅 Вечерние вопросы: ${successCount} успешно, ${failCount} ошибок`);
    
    try {
        await bot.sendMessage(ADMIN_CHAT_ID,
            `📊 <b>Отчет о вечерней рассылке</b>\n\n` +
            `✅ Успешно: ${successCount}\n` +
            `❌ Ошибок: ${failCount}\n` +
            `👥 Всего: ${users.length}\n` +
            `${firstError ? `\n⚠️ Первая ошибка: ${firstError}` : ''}`,
            { parse_mode: 'HTML' }
        );
    } catch (e) {
        console.log('Не удалось отправить отчет админу');
    }
}

// Планировщик рассылок
function scheduleDailyMessages() {
    console.log('⏰ Планировщик запущен');
    
    // Проверяем каждую минуту
    setInterval(() => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        
        // Утренняя рассылка в 7:00
        if (hours === 7 && minutes === 0) {
            console.log('🌅 Отправляю утреннюю рассылку...');
            sendMorningPractice();
        }
        
        // Вечерняя рассылка в 22:00
        if (hours === 22 && minutes === 0) {
            console.log('🌙 Отправляю вечернюю рассылку...');
            sendEveningQuestion();
        }
    }, 60000); // Проверка каждую минуту
    
    // Для отладки - отправляем тестовое сообщение админу
    setTimeout(() => {
        bot.sendMessage(ADMIN_CHAT_ID, 
            '✅ Бот запущен! Рассылки будут в 7:00 и 22:00.\n' +
            `👥 Пользователей в базе: ${loadData().users.length}\n` +
            `🌐 UptimeRobot пингует бота каждые 5 минут`
        ).catch(e => console.log('Не удалось отправить тестовое сообщение админу'));
    }, 5000);
}

// ================================================
// ===== ВОПРОСЫ ДЛЯ ТЕСТА =====
// ================================================
const questions = [
    {
        id: 'q1',
        text: '🧘‍♀️ <b>Вопрос 1 из 5</b>\n\nКак ты просыпаешься по утрам?',
        options: [
            { text: '☀️ С лёгкостью и энергией', value: 'light' },
            { text: '😴 С трудом, еле открываю глаза', value: 'tired' },
            { text: '😰 Сразу с тревогой и списком дел', value: 'anxious' },
            { text: '😶 Не чувствую ничего, просто встаю', value: 'empty' }
        ]
    },
    {
        id: 'q2',
        text: '💼 <b>Вопрос 2 из 5</b>\n\nКак ты чувствуешь себя в течение дня?',
        options: [
            { text: '⚡ Энергично, всё успеваю', value: 'energetic' },
            { text: '🫠 Постоянно устаю', value: 'exhausted' },
            { text: '😬 Внутреннее напряжение не отпускает', value: 'tense' },
            { text: '🌫️ Как будто я не здесь, всё на автомате', value: 'disconnected' }
        ]
    },
    {
        id: 'q3',
        text: '💬 <b>Вопрос 3 из 5</b>\n\nЧто ты чаще всего чувствуешь к концу дня?',
        options: [
            { text: '😌 Спокойствие', value: 'satisfied' },
            { text: '😩 Опустошённость', value: 'drained' },
            { text: '😤 Раздражение', value: 'irritated' },
            { text: '😔 Чувство вины', value: 'guilty' }
        ]
    },
    {
        id: 'q4',
        text: '🛌 <b>Вопрос 4 из 5</b>\n\nЧто происходит, когда ты остаёшься одна?',
        options: [
            { text: '😊 Наслаждаюсь тишиной', value: 'enjoy' },
            { text: '😰 Тревожусь', value: 'worry' },
            { text: '😴 Засыпаю', value: 'sleep' },
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

// ================================================
// ===== НОВАЯ КОМАНДА /START =====
// ================================================
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const firstName = msg.from.first_name || 'Гость';
    const userId = String(msg.from.id);

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

    const welcomeText = 
`☕ <b>Привет, ${firstName}!</b>

Я — бот «Кружка». Но прежде чем я расскажу о себе, давай познакомимся.

Расскажи пару слов о себе:
• Как тебя зовут (если хочешь, чтобы я называл тебя иначе)?
• Что привело тебя сюда?
• Что ты чувствуешь сейчас?

📝 Просто напиши в ответ. Это поможет нам начать разговор. 💗`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML'
    });

    userStates[chatId] = {
        step: 'intro_meet',
        lastActivity: Date.now()
    };
});

// ================================================
// ===== КНОПКА «ПРАКТИКИ И ТЕСТ» =====
// ================================================
bot.onText(/🧘‍♀️ Практики и тест/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `🧘‍♀️ <b>Практики и тест</b>

Что тебе сейчас нужно?

👇 Выбери:`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🧘‍♀️ Пройти тест', callback_data: 'go_test' }],
                    [{ text: '🌅 Утренние практики', callback_data: 'go_morning' }],
                    [{ text: '🤍 Пространство тишины', callback_data: 'go_silence' }]
                ]
            }
        }
    );
});

// ================================================
// ===== КНОПКА «ДНЕВНИКИ» =====
// ================================================
bot.onText(/📖 Дневники/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `📖 <b>Дневники</b>

Веди свои записи и отслеживай прогресс.

👇 Выбери:`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📖 Годовой дневник', callback_data: 'go_yearly' }]
                ]
            }
        }
    );
});

// ================================================
// ===== КНОПКА «ВСТРЕЧИ И МЕРОПРИЯТИЯ» =====
// ================================================
bot.onText(/🗓️ Встречи и мероприятия/, (msg) => {
    const chatId = msg.chat.id;
    
    const text = 
`🗓️ <b>Встречи и мероприятия</b>

Я планирую проводить живые встречи в Минске и не только.

Здесь ты узнаешь о ближайших событиях первым.

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

Я буду постепенно анонсировать всё здесь.
Следи за обновлениями! 💗

👇 Нажми, чтобы узнать больше или задать вопрос:`;

    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '📝 Записаться на тренинг', callback_data: 'go_training' }],
                [{ text: '💬 Написать Егору', callback_data: 'go_write' }],
                [{ text: '📖 О проекте', callback_data: 'go_about' }]
            ]
        }
    });
});

// ================================================
// ===== КНОПКА «МОЙ ПУТЬ» =====
// ================================================
bot.onText(/🏆 Мой путь/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const data = loadData();
    
    const points = getUserPoints(userId);
    const level = getUserLevel(points);
    const entries = getJournalEntries(userId);
    const tests = data.test_results ? data.test_results.filter(t => t.user_id === userId) : [];
    const practices = getUserPractices(userId);
    const journalStats = getJournalStats(userId);
    const daysInBot = data.users.find(u => u.id === userId) ? 
        Math.ceil((Date.now() - new Date(data.users.find(u => u.id === userId).joined_at).getTime()) / (1000 * 60 * 60 * 24)) : 1;
    
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
`🏆 <b>Твой путь</b>

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Зачем это нужно?</b>

Это не просто цифры. Это твой дневник движения.

Каждая запись, каждая практика — это шаг к себе.
Здесь ты видишь, как меняешься день за днём.

Когда внутри кажется, что ничего не происходит — ты смотришь сюда и видишь: ты идёшь. Ты делаешь. Ты растешь.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>Твоя статистика:</b>

📅 <b>Дней в боте:</b> ${daysInBot}
🧘‍♀️ <b>Практик:</b> ${practices}
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
});

// ================================================
// ===== КНОПКА «О ПРОЕКТЕ И СВЯЗЬ» =====
// ================================================
bot.onText(/💬 О проекте и связь/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `💬 <b>О проекте и связь</b>

Что тебя интересует?

👇 Выбери:`,
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

// ================================================
// ===== ОБРАБОТКА КОЛБЭКОВ =====
// ================================================
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = String(chatId);

    // ===== НОВЫЕ КОЛБЭКИ ДЛЯ ПРИВЕТСТВИЯ =====
    
    if (data === 'intro_about_bot') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);

        const botText = 
`🤖 <b>Что такое бот «Кружка»?</b>

Это твой карманный инструмент для состояния.

Я создал его, потому что верю: у каждого человека есть внутренняя опора. Иногда нужно просто напомнить себе об этом.

<b>Что здесь есть:</b>
🧘‍♀️ <b>Тест</b> — 5 вопросов, которые покажут, что переполняет твою кружку
🌅 <b>Утренние практики</b> — короткие упражнения для заботы о себе
📖 <b>Годовой дневник</b> — место для ежедневной рефлексии
🏆 <b>Мой путь</b> — статистика, баллы и уровни
🤍 <b>Пространство тишины</b> — 30 секунд, чтобы остановиться

Это не про «надо» и «правильно».
Это про тебя и твои ощущения.

👇 Хочешь узнать, почему всё это называется «Кружка»?`;

        bot.sendMessage(chatId, botText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '☕ Да, расскажи историю', callback_data: 'intro_story' }],
                    [{ text: '🚀 Сразу начать', callback_data: 'intro_main' }]
                ]
            }
        });
        return;
    }

    if (data === 'intro_story') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);

        const storyText = 
`☕ <b>Почему «Кружка»?</b>

Когда мы рождаемся, у нас появляется невидимая кружка. Пустая. Чистая.

И мы начинаем складывать в неё всё, что не можем выплеснуть:
• Страхи, которые не проговорили
• Обиды, которые проглотили
• «Надо» и «должна», которые на нас повесили
• Чужие ожидания
• Усталость, которой не давали выхода

Год за годом кружка наполняется.
Становится тяжелее.
Дышать труднее.

И однажды она переполняется.

<b>Кружку нельзя просто закрыть крышкой.</b>
Ей нужно дать выход.

Выплеснуть старое. Освободить место.

И только тогда — наполнить её новым.

<b>Светом. Тишиной. Собой.</b>

Этот бот — твоя кружка.

Здесь можно выдохнуть. Здесь можно освободиться от старого и начать наполняться новым.

👇 Готова начать?`;

        bot.sendMessage(chatId, storyText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🧘‍♀️ Пройти тест', callback_data: 'intro_test' }],
                    [{ text: '🌅 Получить практику', callback_data: 'intro_practice' }],
                    [{ text: '🏠 В главное меню', callback_data: 'intro_main' }]
                ]
            }
        });
        return;
    }

    if (data === 'intro_skip_to_practice') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        
        bot.sendMessage(chatId,
            `☕ <b>Добро пожаловать в «Кружку»</b>

👇 Выбери, что тебе сейчас важно:`,
            {
                parse_mode: 'HTML',
                reply_markup: mainKeyboard.reply_markup
            }
        );
        return;
    }

    if (data === 'intro_test') {
        bot.answerCallbackQuery(query.id, { text: '🧘‍♀️ Начинаем!' });
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'test_announce',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `🧘‍♀️ <b>Тест «Состояние твоей кружки»</b>

Ты ответишь на 5 вопросов о своём состоянии.
Это займёт всего 2–3 минуты.

👇 Готова?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🚀 Начать тест', callback_data: 'start_test' }]
                    ]
                }
            }
        );
        return;
    }

    if (data === 'intro_practice') {
        bot.answerCallbackQuery(query.id, { text: '🌅 Получай!' });
        bot.deleteMessage(chatId, query.message.message_id);
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        bot.sendMessage(chatId,
            `${practice.title}\n\n${practice.text}`,
            { parse_mode: 'HTML' }
        );
        addPoints(String(chatId), 5, 'Утренняя практика');
        
        setTimeout(() => {
            bot.sendMessage(chatId,
                `☕ Что дальше?`,
                {
                    parse_mode: 'HTML',
                    reply_markup: mainKeyboard.reply_markup
                }
            );
        }, 2000);
        return;
    }

    if (data === 'intro_main') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `☕ <b>Добро пожаловать в «Кружку»</b>

👇 Выбери, что тебе сейчас важно:`,
            {
                parse_mode: 'HTML',
                reply_markup: mainKeyboard.reply_markup
            }
        );
        return;
    }

    // ===== СТАРЫЕ КОЛБЭКИ =====

    if (data === 'go_test') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'test_announce',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `🧘‍♀️ <b>Тест «Состояние твоей кружки»</b>

Ты ответишь на 5 вопросов о своём состоянии.
Это займёт всего 2–3 минуты.

👇 Готова?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🚀 Начать тест', callback_data: 'start_test' }]
                    ]
                }
            }
        );
        return;
    }

    if (data === 'go_morning') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `🌅 <b>Утренние практики</b>

Каждое утро в 7:00 я буду присылать тебе короткую практику.

👇 Хочешь попробовать прямо сейчас?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '☀️ Получить практику сейчас', callback_data: 'get_morning_practice' }]
                    ]
                }
            }
        );
        return;
    }

    if (data === 'go_silence') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `🤍 <b>Пространство тишины</b>

Сейчас я предлагаю тебе остановиться.

Просто закрой глаза на 30 секунд.
Почувствуй своё дыхание.
Ты в безопасности.

Я подожду. 💗`,
            { parse_mode: 'HTML' }
        );
        setTimeout(() => {
            bot.sendMessage(chatId,
                `✨ Ты вернулась. Это уже много.

💗 Ты — ценность. Твой путь — важен.`,
                { parse_mode: 'HTML' }
            );
            addPoints(userId, 3, 'Пространство тишины');
        }, 30000);
        return;
    }

    if (data === 'go_yearly') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `📖 <b>Годовой дневник состояния</b>

👇 <b>Открой дневник по ссылке:</b>

<a href="https://karpovegor235.github.io/kruzhka-journal/">📖 Открыть годовой дневник</a>

💗 Заполняй его каждый день — это твой путь к себе.`,
            {
                parse_mode: 'HTML',
                disable_web_page_preview: true
            }
        );
        return;
    }

    if (data === 'go_about') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        const text = 
`📋 <b>О проекте «Кружка»</b>

«Кружка» — это пространство, где можно остановиться и услышать себя.

Создатель проекта — <b>Егор Карпов</b>.

<b>Кто такой Егор?</b>
🧘‍♂️ Практикующий психолог, телесно-ориентированный терапевт
🧬 Работает с расстановками, подсознанием, родовыми узлами
🔥 Проводит гвоздестояние — практику возвращения в тело
🌱 Более 6 лет помогает людям находить контакт с собой

<b>В чём его сила?</b>
Он не даёт готовых ответов. Он создаёт пространство, где ты сама находишь свой путь.

«Рядом со мной люди становятся спокойнее. Не потому, что я что-то делаю, а потому что они наконец разрешают себе быть собой».

<b>Где можно встретиться с Егором?</b>
📖 В этом боте — практики, тест, дневник
📞 На индивидуальной консультации
🧘‍♀️ На офлайн-тренинге «Кружка» (22 августа, Минск)

💗 Ты всегда можешь написать Егору через бота — он отвечает лично.`;

        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return;
    }

    if (data === 'go_write') {
        bot.answerCallbackQuery(query.id, { text: '💬 Я здесь' });
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'ask_question',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `💬 <b>Написать Егору</b>

Напиши мне всё, что сейчас внутри.
Или задай вопрос.

Я отвечу. 💗

✍️ Просто напиши сообщение в ответ.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'go_help') {
        bot.answerCallbackQuery(query.id);
        bot.deleteMessage(chatId, query.message.message_id);
        const text = 
`❓ <b>Как пользоваться ботом «Кружка»</b>

Это твой карманный инструмент для состояния.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🧘‍♀️ ПРАКТИКИ И ТЕСТ</b>
→ Тест: 5 вопросов о состоянии
→ Утренние практики: в 7:00
→ Пространство тишины: 30 секунд

<b>📖 ДНЕВНИКИ</b>
→ Годовой дневник: ежедневная рефлексия

<b>🗓️ ВСТРЕЧИ И МЕРОПРИЯТИЯ</b>
→ Офлайн-тренинг «Кружка»
→ Женские круги, ретриты

<b>🏆 МОЙ ПУТЬ</b>
→ Статистика: дни, практики, баллы
→ Уровни: от Новичка до Мудреца

<b>💬 О ПРОЕКТЕ И СВЯЗЬ</b>
→ О проекте: кто создал бот
→ Написать Егору: личное сообщение

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📌 СОВЕТ:</b>
Начни с теста — это поможет понять, что сейчас важно именно тебе.

💗 Бот — для тебя, а не ты — для бота.`;

        bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        return;
    }

    if (data === 'go_training') {
        bot.answerCallbackQuery(query.id, { text: '📝 Начинаем запись!' });
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'consultation',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `📝 <b>Запись на тренинг «Кружка»</b>

📍 Минск, 22 августа 2026
⏰ 10:00 – 16:10

<b>Тарифы:</b>
🟢 «Лёгкий» — 380 BYN
🟠 «Классика» — 580 BYN
🟡 «VIP» — 880 BYN

👇 Напиши в ответ:
1. Твоё имя
2. Телефон или Telegram
3. Какой тариф тебе интересен

Я свяжусь с тобой. 💗`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data.startsWith('journal_morning_')) {
        const parts = data.split('_');
        const dateStr = parts[2];
        const targetUserId = parts[3];
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        bot.answerCallbackQuery(query.id, { text: '🌅 Запиши своё утро' });
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
        bot.answerCallbackQuery(query.id, { text: '🌙 Запиши свой вечер' });
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

    if (data.startsWith('journal_write_morning_')) {
        const dateStr = data.replace('journal_write_morning_', '');
        bot.answerCallbackQuery(query.id, { text: '🌅 Запиши своё утро' });
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

    if (data.startsWith('journal_write_evening_')) {
        const dateStr = data.replace('journal_write_evening_', '');
        bot.answerCallbackQuery(query.id, { text: '🌙 Запиши свой вечер' });
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

    if (data.startsWith('journal_archive_')) {
        const targetUserId = data.replace('journal_archive_', '');
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        bot.answerCallbackQuery(query.id);
        const entries = getUserDays(targetUserId);
        const sorted = entries.sort((a, b) => b.date.localeCompare(a.date));
        if (sorted.length === 0) {
            bot.sendMessage(chatId, '📭 У тебя пока нет записей.', { parse_mode: 'HTML' });
            return;
        }
        let text = `📚 <b>Архив записей</b>\n\n`;
        let count = 0;
        for (const entry of sorted) {
            if (count >= 10) break;
            const dateObj = new Date(entry.date + 'T00:00:00');
            const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
            const morning = entry.morning ? '🌅' : '';
            const evening = entry.evening ? '🌙' : '';
            const preview = (entry.morning || entry.evening || '').slice(0, 40);
            text += `${dateStr} ${morning}${evening} — «${preview}${(entry.morning || entry.evening || '').length > 40 ? '...' : ''}»\n`;
            count++;
        }
        if (sorted.length > 10) {
            text += `\nи ещё ${sorted.length - 10} записей в архиве`;
        }
        if (sorted.length > 0) {
            const firstEntry = sorted[0];
            text += `\n\n👇 Нажми на кнопку, чтобы посмотреть первую запись.`;
            bot.sendMessage(chatId, text, {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: `📖 Показать запись от ${new Date(firstEntry.date + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}`, callback_data: `journal_view_${targetUserId}_0` }]
                    ]
                }
            });
        } else {
            bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
        }
        bot.deleteMessage(chatId, query.message.message_id);
        return;
    }

    if (data.startsWith('journal_view_')) {
        const parts = data.split('_');
        const targetUserId = parts[2];
        const index = parseInt(parts[3]);
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        const entries = getUserDays(targetUserId);
        const sorted = entries.sort((a, b) => b.date.localeCompare(a.date));
        if (index >= sorted.length) {
            bot.answerCallbackQuery(query.id, { text: '❌ Запись не найдена' });
            return;
        }
        const entry = sorted[index];
        const dateObj = new Date(entry.date + 'T00:00:00');
        const dateStr = dateObj.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        const dayOfWeek = dateObj.toLocaleDateString('ru-RU', { weekday: 'long' });
        let text = 
`📖 <b>Запись от ${dateStr}</b>
${dayOfWeek}

━━━━━━━━━━━━━━━━━━━━━━━━━`;

        if (entry.morning) {
            text += `\n🌅 <b>Утро:</b>\n${entry.morning}`;
        }
        if (entry.morningMood) {
            text += `\n😊 Настроение: ${entry.morningMood}`;
        }
        if (entry.evening) {
            text += `\n\n🌙 <b>Вечер:</b>\n${entry.evening}`;
        }
        if (entry.eveningMood) {
            text += `\n😊 Настроение: ${entry.eveningMood}`;
        }

        const total = sorted.length;
        const nextIndex = index + 1 < total ? index + 1 : -1;
        const prevIndex = index - 1 >= 0 ? index - 1 : -1;
        
        const keyboard = [];
        const row = [];
        if (prevIndex >= 0) {
            row.push({ text: '⬅️ Назад', callback_data: `journal_view_${targetUserId}_${prevIndex}` });
        }
        if (nextIndex >= 0) {
            row.push({ text: 'Вперёд ➡️', callback_data: `journal_view_${targetUserId}_${nextIndex}` });
        }
        if (row.length > 0) {
            keyboard.push(row);
        }
        keyboard.push([{ text: '📚 К архиву', callback_data: `journal_archive_${targetUserId}` }]);

        bot.sendMessage(chatId, text, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
        bot.deleteMessage(chatId, query.message.message_id);
        return;
    }

    if (data.startsWith('share_feeling_')) {
        const targetUserId = data.replace('share_feeling_', '');
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        bot.answerCallbackQuery(query.id, { text: '💬 Напиши пару слов' });
        userStates[chatId] = {
            step: 'share_feeling',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `💬 <b>Поделись своими ощущениями</b>

Напиши пару слов о том:
• Как ты себя чувствуешь?
• Что изменилось?

✍️ Просто напиши сообщение в ответ:`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'start_test') {
        bot.answerCallbackQuery(query.id, { text: '🧘‍♀️ Начинаем!' });
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'test',
            currentQuestion: 0,
            answers: [],
            lastActivity: Date.now()
        };
        sendQuestion(chatId, 0);
        return;
    }

    if (data.startsWith('test_')) {
        const parts = data.split('_');
        const questionId = parts[1];
        const value = parts[2];
        const state = userStates[chatId];
        if (!state || state.step !== 'test') {
            bot.answerCallbackQuery(query.id, { text: 'Начни тест заново: нажми "🧘‍♀️ Пройти тест"' });
            return;
        }
        state.answers.push({ questionId, value });
        state.currentQuestion++;
        bot.answerCallbackQuery(query.id, { text: '✅ Ответ принят!' });
        bot.deleteMessage(chatId, query.message.message_id);
        if (state.currentQuestion >= questions.length) {
            showTestResult(chatId);
        } else {
            sendQuestion(chatId, state.currentQuestion);
        }
        return;
    }

    if (data === 'get_morning_practice') {
        bot.answerCallbackQuery(query.id, { text: '☀️ Получай!' });
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        bot.sendMessage(chatId,
            `${practice.title}\n\n${practice.text}`,
            { parse_mode: 'HTML' }
        );
        addPoints(userId, 5, 'Утренняя практика');
        return;
    }

    if (data === 'get_evening_question') {
        bot.answerCallbackQuery(query.id, { text: '🌙 Получай!' });
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const question = getEveningQuestion(dayOffset);
        bot.sendMessage(chatId,
            `🌙 <b>Вечерний вопрос:</b>\n\n${question}\n\nНе для других. Для себя.\n\n💗`,
            { parse_mode: 'HTML' }
        );
        return;
    }
});

// ================================================
// ===== ОТПРАВКА ВОПРОСА ТЕСТА =====
// ================================================
function sendQuestion(chatId, index) {
    const state = userStates[chatId];
    if (!state) return;

    if (index >= questions.length) {
        showTestResult(chatId);
        return;
    }

    const question = questions[index];
    
    const progress = Math.round((index / questions.length) * 100);
    const progressBar = '█'.repeat(Math.round(progress / 10)) + '░'.repeat(10 - Math.round(progress / 10));
    
    const text = question.text + `\n\n📊 Прогресс: ${progressBar} ${progress}%`;

    const options = question.options.map(opt => ({
        text: opt.text,
        callback_data: `test_${question.id}_${opt.value}`
    }));

    const keyboard = options.map(opt => [opt]);

    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: keyboard
        }
    });
}

// ================================================
// ===== РЕЗУЛЬТАТ ТЕСТА =====
// ================================================
function showTestResult(chatId) {
    const state = userStates[chatId];
    if (!state) return;

    const answers = state.answers;
    let score = { tired: 0, anxious: 0, empty: 0, tense: 0, drained: 0, irritated: 0, guilty: 0, worry: 0 };

    answers.forEach(a => {
        if (score[a.value] !== undefined) score[a.value]++;
    });

    let resultText = '';
    let resultEmoji = '';
    let personalOffer = '';
    let recommendation = '';

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

    const resultMessage = 
`${resultEmoji} <b>Твой результат</b>

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
// ===== ОБРАБОТКА ТЕКСТОВЫХ СООБЩЕНИЙ =====
// ================================================
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    const userId = String(msg.from.id);

    if (!text || text.startsWith('/') || text.startsWith('🧘') || text.startsWith('📖') || 
        text.startsWith('🗓️') || text.startsWith('🏆') || text.startsWith('💬') || text.startsWith('❓')) {
        return;
    }

    const state = userStates[chatId];
    if (!state) {
        bot.sendMessage(chatId,
            `👋 Выбери, что тебя интересует:`,
            { reply_markup: mainKeyboard.reply_markup }
        );
        return;
    }

    state.lastActivity = Date.now();

    if (state.step === 'intro_meet') {
        const aboutUser = text.trim();
        if (aboutUser.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее о себе.', { parse_mode: 'HTML' });
            return;
        }

        const data = loadData();
        const user = data.users.find(u => u.id === userId);
        if (user) {
            user.about = aboutUser;
            saveData(data);
        }

        const userFirstName = user ? user.first_name : 'дорогая';
        const aboutEgorText = 
`❤️ <b>Спасибо, что поделилась, ${userFirstName}!</b>

Теперь я расскажу о себе.

Меня зовут <b>Егор Карпов</b>.

Я — проводник. Я не даю готовых ответов и не учу жить. Я создаю пространство, где можно выдохнуть и услышать себя.

<b>Что я делаю:</b>
🧬 <b>Расстановки</b> — помогаю развязать то, что тянется из рода
🔥 <b>Гвоздестояние</b> — практика, которая возвращает контакт с телом
🧠 <b>Работа с подсознанием</b> — чтобы убрать блоки и найти ресурс

Более 6 лет я помогаю людям возвращать контакт с собой, снимать зажимы и находить своё состояние.

«Рядом со мной люди становятся спокойнее. Не потому, что я что-то делаю, а потому что они наконец разрешают себе быть собой».

👇 Хочешь узнать, что такое бот «Кружка» и зачем я его создал?`;

        bot.sendMessage(chatId, aboutEgorText, {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💚 Да, расскажи', callback_data: 'intro_about_bot' }],
                    [{ text: '💫 Сразу к практике', callback_data: 'intro_skip_to_practice' }]
                ]
            }
        });

        clearUserState(chatId);
        return;
    }

    if (state.step === 'journal_write') {
        const entryText = text.trim();
        if (entryText.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее (минимум 2 слова).', { parse_mode: 'HTML' });
            return;
        }
        const field = state.time === 'morning' ? 'morning' : 'evening';
        saveDayEntry(userId, state.date, field, entryText);
        addPoints(userId, 3, `Запись в дневнике (${state.time})`);
        const emoji = state.time === 'morning' ? '🌅' : '🌙';
        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена!</b>\n\n${emoji} «${entryText}»\n\n💗 Спасибо, что делишься. Это помогает видеть свой путь.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        return;
    }

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
        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена!</b>\n\n📝 «${entryText}»\n\n💗 Спасибо, что делишься. Это помогает видеть свой прогресс.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }

    if (state.step === 'ask_question') {
        const question = text.trim();
        if (question.length < 3) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее (минимум 3 слова).', { parse_mode: 'HTML' });
            return;
        }
        const userInfo = msg.from;
        bot.sendMessage(ADMIN_CHAT_ID,
            `❓ <b>ВОПРОС ОТ УЧАСТНИЦЫ</b>\n\n👤 Имя: ${userInfo.first_name || 'Гость'}\n📱 Юзернейм: @${userInfo.username || 'не указан'}\n🆔 ID: ${userInfo.id}\n\n📝 Вопрос: "${question}"\n\n📅 ${new Date().toISOString().slice(0, 10)}`,
            { parse_mode: 'HTML' }
        );
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо за вопрос!</b>\n\nЯ передал его Егору. Он ответит в ближайшее время.\n\n💗 Твой голос важен.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }

    if (state.step === 'consultation') {
        const consultationText = text.trim();
        if (consultationText.length < 5) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее (минимум 5 слов).', { parse_mode: 'HTML' });
            return;
        }
        const userInfo = msg.from;
        const data = loadData();
        data.consultations.push({
            user_id: userId,
            name: userInfo.first_name || 'Гость',
            username: userInfo.username || 'не указан',
            text: consultationText,
            date: new Date().toISOString()
        });
        saveData(data);
        bot.sendMessage(ADMIN_CHAT_ID,
            `📞 <b>ЗАПРОС НА КОНСУЛЬТАЦИЮ</b>\n\n👤 Имя: ${userInfo.first_name || 'Гость'}\n📱 Юзернейм: @${userInfo.username || 'не указан'}\n🆔 ID: ${userInfo.id}\n\n📝 Запрос: "${consultationText}"\n\n📅 ${new Date().toISOString().slice(0, 10)}`,
            { parse_mode: 'HTML' }
        );
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо, я получил твой запрос!</b>\n\nЯ свяжусь с тобой в ближайшее время.\n\n💗`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }

    if (state.step === 'share_feeling') {
        const feeling = text.trim();
        if (feeling.length < 3) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее (минимум 3 слова).', { parse_mode: 'HTML' });
            return;
        }
        const userInfo = msg.from;
        const data = loadData();
        if (!data.feedbacks) data.feedbacks = [];
        data.feedbacks.push({
            user_id: userId,
            user_name: userInfo.first_name || 'Гость',
            username: userInfo.username || 'не указан',
            feeling: feeling,
            date: new Date().toISOString()
        });
        saveData(data);
        addPoints(userId, 3, 'Отклик на практику');
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо, что поделилась!</b>\n\nТвой отклик очень важен. 💗`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }
});

// ================================================
// ===== КОМАНДА /BROADCAST — РАССЫЛКА ВСЕМ =====
// ================================================
bot.onText(/\/broadcast/, (msg) => {
    const chatId = msg.chat.id;
    const ADMIN_ID = 490337942;

    if (msg.from.id !== ADMIN_ID) {
        bot.sendMessage(chatId, '⛔ Доступ запрещён.');
        return;
    }

    const text = msg.text.replace('/broadcast', '').trim();
    if (!text) {
        bot.sendMessage(chatId,
            `📢 <b>Инструкция по рассылке</b>

Чтобы отправить сообщение всем участникам, напиши:

<code>/broadcast Текст вашего сообщения</code>

📊 Сейчас в базе: <b>${loadData().users.length}</b> участников.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    bot.sendMessage(chatId,
        `📢 <b>Начинаю рассылку...</b>

📝 Текст: "${text}"
👥 Будет отправлено: <b>${loadData().users.length}</b> участникам.`,
        { parse_mode: 'HTML' }
    );

    sendBroadcast(chatId, text);
});

async function sendBroadcast(adminChatId, messageText) {
    const data = loadData();
    const users = data.users;
    
    if (users.length === 0) {
        bot.sendMessage(adminChatId, '❌ В базе нет пользователей.');
        return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
        try {
            await bot.sendMessage(user.id, messageText, { parse_mode: 'HTML' });
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
            failCount++;
        }
    }

    bot.sendMessage(adminChatId,
        `📊 <b>Отчёт о рассылке</b>

✅ Успешно: ${successCount}
❌ Ошибок: ${failCount}
👥 Всего: ${users.length}`,
        { parse_mode: 'HTML' }
    );
}

// ================================================
// ===== КОМАНДЫ ДЛЯ АДМИНА =====
// ================================================

// Статус бота
bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const ADMIN_ID = 490337942;
    
    if (msg.from.id !== ADMIN_ID) return;
    
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const data = loadData();
    
    bot.sendMessage(chatId,
        `📊 <b>Статус бота</b>\n\n` +
        `⏱ <b>Работает:</b> ${hours}ч ${minutes}м\n` +
        `👥 <b>Пользователей:</b> ${data.users.length}\n` +
        `📝 <b>Записей:</b> ${data.journal_entries?.length || 0}\n` +
        `🧘 <b>Тестов:</b> ${data.test_results?.length || 0}\n` +
        `📅 <b>Время:</b> ${new Date().toLocaleString()}\n` +
        `🏓 <b>Пинги:</b> активны`,
        { parse_mode: 'HTML' }
    );
});

// Проверка что бот отвечает на пинги
bot.onText(/\/ping_test/, (msg) => {
    const chatId = msg.chat.id;
    const ADMIN_ID = 490337942;
    
    if (msg.from.id !== ADMIN_ID) return;
    
    const req = http.get(`http://localhost:${PORT}/`, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            bot.sendMessage(chatId, 
                `✅ Сервер отвечает!\n\n` +
                `Статус: ${res.statusCode}\n` +
                `Ответ: ${data.slice(0, 100)}`
            );
        });
    });
    req.on('error', (e) => {
        bot.sendMessage(chatId, `❌ Ошибка: ${e.message}`);
    });
});

// Тест рассылки
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

// Показать пользователей
bot.onText(/\/users/, (msg) => {
    if (msg.from.id !== 490337942) return;
    const data = loadData();
    let text = `👥 <b>Пользователей: ${data.users.length}</b>\n\n`;
    if (data.users.length > 0) {
        text += data.users.slice(0, 10).map((u, i) => 
            `${i+1}. ${u.first_name} (@${u.username || 'нет'}) - ${new Date(u.joined_at).toLocaleDateString()}`
        ).join('\n');
        if (data.users.length > 10) {
            text += `\n... и еще ${data.users.length - 10} пользователей`;
        }
    } else {
        text += '⚠️ Нет пользователей';
    }
    bot.sendMessage(msg.chat.id, text, { parse_mode: 'HTML' });
});

// ================================================
// ===== ЗАПУСК =====
// ================================================
scheduleDailyMessages();

console.log('✅ Бот готов к работе!');
console.log(`📌 Ссылка: https://t.me/kruzhka_karpov_bot`);
console.log(`📨 Заявки и вопросы приходят в: ${ADMIN_USERNAME}`);
console.log('⏰ Утренняя рассылка: 7:00');
console.log('⏰ Вечерняя рассылка: 22:00');
console.log('📢 Команда /broadcast — для рассылки всем участникам');
console.log('📊 Команда /status — статус бота');
console.log('🧪 Команды /test_morning и /test_evening — тест рассылок');

process.on('SIGINT', () => {
    console.log('🛑 Бот остановлен');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log('⚠️ Ошибка:', error.message);
});