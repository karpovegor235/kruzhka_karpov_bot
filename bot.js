const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const http = require('http');

// ===== ТОКЕН НОВОГО БОТА =====
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

// ===== ЗАГЛУШКА ДЛЯ RENDER =====
const port = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is running!');
});
server.listen(port, '0.0.0.0', () => {
    console.log(`🌐 Веб-сервер запущен на порту ${port}`);
});

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
        consultations: []
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

// ================================================
// ===== ГЛАВНАЯ КЛАВИАТУРА =====
// ================================================
const mainKeyboard = {
    reply_markup: {
        keyboard: [
            [{ text: '🌅 Утренние практики' }],
            [{ text: '🌙 Вечерние практики' }],
            [{ text: '📝 Дневник состояния' }],
            [{ text: '🧘‍♀️ Пройти тест' }],
            [{ text: '🏆 Мой путь' }],
            [{ text: '💬 Написать Егору' }],
            [{ text: '📞 Записаться на консультацию' }],
            [{ text: '🤍 Пространство тишины' }],
            [{ text: '❓ Помощь' }]
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
    
    if (users.length === 0) return;
    
    const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
    const practice = getMorningPractice(dayOffset);
    
    let successCount = 0;
    for (const user of users) {
        try {
            await bot.sendMessage(user.id,
                `${practice.title}\n\n${practice.text}\n\n💗 Поделись ощущениями:\n👇 Нажми на кнопку`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '💬 Поделиться', callback_data: `share_feeling_${user.id}` }]
                        ]
                    }
                }
            );
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
            console.log(`⚠️ Не удалось отправить практику пользователю ${user.id}`);
        }
    }
    console.log(`📅 Утренние практики отправлены ${successCount} пользователям`);
}

// Функция для отправки вечернего вопроса
async function sendEveningQuestion() {
    const data = loadData();
    const users = data.users || [];
    const today = new Date().toISOString().slice(0, 10);
    
    if (users.length === 0) return;
    
    const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
    const question = getEveningQuestion(dayOffset);
    
    let successCount = 0;
    for (const user of users) {
        try {
            await bot.sendMessage(user.id,
                `🌙 <b>Вечерний вопрос:</b>\n\n📝 ${question}\n\nНе для других. Для себя.\n\nЗапиши, если хочешь. Или просто подумай.\n\n💗 Спокойной ночи.\n\n👇 Записать ответ`,
                {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '📝 Записать ответ', callback_data: `journal_evening_${user.id}` }]
                        ]
                    }
                }
            );
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (e) {
            console.log(`⚠️ Не удалось отправить вопрос пользователю ${user.id}`);
        }
    }
    console.log(`📅 Вечерние вопросы отправлены ${successCount} пользователям`);
}

// Планировщик рассылок
function scheduleDailyMessages() {
    const now = new Date();
    
    // Утренняя рассылка в 7:00
    const morningTarget = new Date(now);
    morningTarget.setHours(7, 0, 0, 0);
    if (now > morningTarget) {
        morningTarget.setDate(morningTarget.getDate() + 1);
    }
    const morningDelay = morningTarget - now;
    
    setTimeout(() => {
        sendMorningPractice();
        setInterval(sendMorningPractice, 24 * 60 * 60 * 1000);
    }, morningDelay);
    
    // Вечерняя рассылка в 22:00
    const eveningTarget = new Date(now);
    eveningTarget.setHours(22, 0, 0, 0);
    if (now > eveningTarget) {
        eveningTarget.setDate(eveningTarget.getDate() + 1);
    }
    const eveningDelay = eveningTarget - now;
    
    setTimeout(() => {
        sendEveningQuestion();
        setInterval(sendEveningQuestion, 24 * 60 * 60 * 1000);
    }, eveningDelay);
    
    console.log(`⏰ Утренняя рассылка в 7:00 (через ${Math.round(morningDelay / 60000)} мин)`);
    console.log(`⏰ Вечерняя рассылка в 22:00 (через ${Math.round(eveningDelay / 60000)} мин)`);
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
// ===== КОМАНДА /START =====
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
        
        // Бонус за первый вход
        addPoints(userId, 5, 'Первый вход в бота');
    }

    const welcomeText = 
`☕ <b>Привет, ${firstName}!</b>

Добро пожаловать в «Кружку» — твой карманный инструмент состояния.

Я — Егор. Я создал этот бот, чтобы ты могла возвращаться к себе в любой момент.

Здесь нет «надо» и «правильно». Есть только ты и твои ощущения.

<b>Что ты можешь делать здесь:</b>
🌅 <b>Утренние практики</b> — каждое утро в 7:00
🌙 <b>Вечерние вопросы</b> — каждый вечер в 22:00
📝 <b>Дневник состояния</b> — записывай свои ощущения
🧘‍♀️ <b>Тест</b> — узнай, что переполняет твою кружку
🏆 <b>Мой путь</b> — смотри свой прогресс
💬 <b>Написать Егору</b> — я всегда рядом
📞 <b>Записаться на консультацию</b> — если хочешь пойти глубже
🤍 <b>Пространство тишины</b> — 30 секунд для себя

👇 Начни с того, что откликается:`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML',
        reply_markup: mainKeyboard.reply_markup
    });
});

// ================================================
// ===== КНОПКА «УТРЕННИЕ ПРАКТИКИ» =====
// ================================================
bot.onText(/🌅 Утренние практики/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `🌅 <b>Утренние практики</b>

Каждое утро в 7:00 я буду присылать тебе короткую практику.

Это 5–7 минут, чтобы начать день с заботы о себе.

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
});

// ================================================
// ===== КНОПКА «ВЕЧЕРНИЕ ПРАКТИКИ» =====
// ================================================
bot.onText(/🌙 Вечерние практики/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `🌙 <b>Вечерние практики</b>

Каждый вечер в 22:00 я буду присылать тебе вопрос для рефлексии.

Это возможность остановиться, оглянуться на день и услышать себя.

👇 Хочешь попробовать прямо сейчас?`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '🌙 Получить вопрос сейчас', callback_data: 'get_evening_question' }]
                ]
            }
        }
    );
});

// ================================================
// ===== КНОПКА «ДНЕВНИК СОСТОЯНИЯ» =====
// ================================================
bot.onText(/📝 Дневник состояния/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    
    const entries = getJournalEntries(userId);
    
    let text = 
`📝 <b>Дневник состояния</b>

Записывай свои ощущения, чтобы видеть свой прогресс.

<b>Сегодняшняя запись:</b>
Как ты себя чувствуешь сейчас?`;

    const moodButtons = [
        [{ text: '💚 Отлично', callback_data: 'mood_great' }],
        [{ text: '💛 Хорошо', callback_data: 'mood_good' }],
        [{ text: '🧡 Нормально', callback_data: 'mood_ok' }],
        [{ text: '💔 Плохо', callback_data: 'mood_bad' }]
    ];
    
    if (entries.length > 0) {
        text += `\n\n📅 <b>Последние записи:</b>`;
        const lastEntries = entries.slice(-3).reverse();
        for (const entry of lastEntries) {
            const date = new Date(entry.date).toLocaleDateString('ru-RU');
            text += `\n${date}: «${entry.text}»`;
        }
        text += `\n\n📂 <i>Всего записей: ${entries.length}</i>`;
    }
    
    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: moodButtons
        }
    });
});

// ================================================
// ===== КНОПКА «ТЕСТ» =====
// ================================================
bot.onText(/🧘‍♀️ Пройти тест/, (msg) => {
    const chatId = msg.chat.id;
    
    userStates[chatId] = {
        step: 'test_announce',
        lastActivity: Date.now()
    };
    
    bot.sendMessage(chatId,
        `🧘‍♀️ <b>Тест «Состояние твоей кружки»</b>

Ты ответишь на 5 вопросов о своём состоянии.
Это займёт всего 2–3 минуты.

🎁 <b>А после теста ты получишь подарок:</b>
📦 «Два ключа к себе» — две глубокие практики.

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

    if (score.tired >= 2 || score.drained >= 2) {
        resultEmoji = '🫠';
        resultText = `<b>Твоя кружка переполнена усталостью</b>\n\nТы давно не даёшь себе отдыхать по-настоящему.`;
        personalOffer = `✨ Ты устала быть сильной. Пора разрешить себе быть живой.`;
    } else if (score.anxious >= 2 || score.worry >= 2 || score.tense >= 2) {
        resultEmoji = '😰';
        resultText = `<b>Твоя кружка переполнена тревогой</b>\n\nТы постоянно на взводе. Голова занята делами.`;
        personalOffer = `✨ Ты заслуживаешь спокойствия. Пора его почувствовать.`;
    } else if (score.empty >= 2 || score.disconnected >= 2) {
        resultEmoji = '🌫️';
        resultText = `<b>Твоя кружка почти пуста</b>\n\nТы живёшь на автомате. Внутри — пустота.`;
        personalOffer = `✨ Ты заслуживаешь чувствовать себя живой. Пора это разрешить.`;
    } else if (score.irritated >= 2 || score.guilty >= 2) {
        resultEmoji = '😤';
        resultText = `<b>Твоя кружка переполнена раздражением</b>\n\nТы срываешься на близких, а потом чувствуешь вину.`;
        personalOffer = `✨ Ты имеешь право на эмоции. Пора их выпустить.`;
    } else {
        resultEmoji = '☀️';
        resultText = `<b>Твоя кружка в равновесии</b>\n\nТы умеешь заботиться о себе, но есть место для глубины.`;
        personalOffer = `✨ Даже в гармонии есть место для роста. Пора сделать следующий шаг.`;
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

━━━━━━━━━━━━━━━━
🎁 <b>Забери свой подарок!</b>
«Два ключа к себе» — две глубокие практики.

👇 Нажми на кнопку, чтобы получить подарок:`;

    bot.sendMessage(chatId, resultMessage, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '🎁 Забрать подарок', callback_data: 'take_gift' }]
            ]
        }
    });

    delete userStates[chatId];
}

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
    const daysInBot = data.users.find(u => u.id === userId) ? 
        Math.ceil((Date.now() - new Date(data.users.find(u => u.id === userId).joined_at).getTime()) / (1000 * 60 * 60 * 24)) : 1;
    
    // Считаем практики (утренние + вечерние отклики)
    const practices = data.daily_practices ? data.daily_practices.length : 0;
    
    let text = 
`🏆 <b>Твой путь</b>

━━━━━━━━━━━━━━━━━━━━━━━━━
📅 <b>Дней в боте:</b> ${daysInBot}
🧘‍♀️ <b>Практик:</b> ${practices}
📝 <b>Записей в дневнике:</b> ${entries.length}
🧘‍♀️ <b>Тестов пройдено:</b> ${tests.length}
⭐ <b>Баллов:</b> ${points}
🌱 <b>Уровень:</b> ${level.emoji} ${level.name}

━━━━━━━━━━━━━━━━━━━━━━━━━
💗 Ты делаешь это. Каждый день — шаг к себе.`;

    bot.sendMessage(chatId, text, { parse_mode: 'HTML' });
});

// ================================================
// ===== КНОПКА «НАПИСАТЬ ЕГОРУ» =====
// ================================================
bot.onText(/💬 Написать Егору/, (msg) => {
    const chatId = msg.chat.id;
    
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
});

// ================================================
// ===== КНОПКА «ЗАПИСАТЬСЯ НА КОНСУЛЬТАЦИЮ» =====
// ================================================
bot.onText(/📞 Записаться на консультацию/, (msg) => {
    const chatId = msg.chat.id;
    
    userStates[chatId] = {
        step: 'consultation',
        lastActivity: Date.now()
    };
    
    bot.sendMessage(chatId,
        `📞 <b>Запись на консультацию</b>

Хочешь пойти глубже?

Индивидуальная консультация с Егором — 1 час.
Разбор твоего состояния, рекомендации, поддержка.

👇 Напиши в ответ:
1. Твоё имя
2. Телефон или Telegram
3. Коротко о том, что хочешь проработать

Я свяжусь с тобой. 💗`,
        { parse_mode: 'HTML' }
    );
});

// ================================================
// ===== КНОПКА «ПРОСТРАНСТВО ТИШИНЫ» =====
// ================================================
bot.onText(/🤍 Пространство тишины/, (msg) => {
    const chatId = msg.chat.id;
    
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
        
        const userId = String(chatId);
        addPoints(userId, 3, 'Пространство тишины');
    }, 30000);
});

// ================================================
// ===== КНОПКА «ПОМОЩЬ» =====
// ================================================
bot.onText(/❓ Помощь/, (msg) => {
    const chatId = msg.chat.id;
    
    bot.sendMessage(chatId,
        `❓ <b>Как пользоваться ботом</b>

🌅 <b>Утренние практики</b> — приходят в 7:00
🌙 <b>Вечерние вопросы</b> — приходят в 22:00
📝 <b>Дневник состояния</b> — сохраняй свои ощущения
🧘‍♀️ <b>Тест</b> — узнай своё состояние🏆 <b>Мой путь</b> — смотри свой прогресс
💬 <b>Написать Егору</b> — получить поддержку
📞 <b>Записаться на консультацию</b> — пойти глубже
🤍 <b>Пространство тишины</b> — 30 секунд для себя

Всё просто. Нажимай на то, что откликается. 💗`,
        { parse_mode: 'HTML' }
    );
});

// ================================================
// ===== ОБРАБОТКА ВСЕХ КОЛБЭКОВ =====
// ================================================
bot.on('callback_query', (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    const userId = String(chatId);

    // ===== ПОДЕЛИТЬСЯ ОЩУЩЕНИЯМИ =====
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

    // ===== ДНЕВНИК: НАСТРОЕНИЕ =====
    if (data === 'mood_great' || data === 'mood_good' || data === 'mood_ok' || data === 'mood_bad') {
        const moodMap = {
            'mood_great': '💚 Отлично',
            'mood_good': '💛 Хорошо',
            'mood_ok': '🧡 Нормально',
            'mood_bad': '💔 Плохо'
        };
        const mood = moodMap[data] || 'Нормально';
        
        userStates[chatId] = {
            step: 'journal_mood',
            mood: mood,
            lastActivity: Date.now()
        };
        
        bot.answerCallbackQuery(query.id, { text: '📝 Напиши подробнее' });
        bot.sendMessage(chatId,
            `📝 <b>Твоё состояние:</b> ${mood}

Напиши пару слов о том, что ты чувствуешь.

✍️ Просто напиши сообщение в ответ.`,
            { parse_mode: 'HTML' }
        );
        bot.deleteMessage(chatId, query.message.message_id);
        return;
    }

    // ===== ДНЕВНИК: ВЕЧЕРНИЙ ОТВЕТ =====
    if (data.startsWith('journal_evening_')) {
        const targetUserId = data.replace('journal_evening_', '');
        if (String(chatId) !== targetUserId) {
            bot.answerCallbackQuery(query.id, { text: '❌ Эта кнопка не для вас' });
            return;
        }
        bot.answerCallbackQuery(query.id, { text: '📝 Напиши свой ответ' });
        userStates[chatId] = {
            step: 'journal_evening',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `🌙 <b>Запиши свой ответ</b>

Просто напиши, что приходит.

✍️ Напиши сообщение в ответ.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    // ===== ТЕСТ =====
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

    // ===== ПОДАРОК =====
    if (data === 'take_gift') {
        bot.answerCallbackQuery(query.id, { text: '🎁 Держи подарок!' });
        bot.sendMessage(chatId,
            `🎁 <b>Твой подарок — «Два ключа к себе»</b>

Две глубокие практики, которые помогут тебе:
📦 <b>Коробка обязательств</b> — освободиться от «надо»
🪑 <b>Стул пустоты</b> — встретиться с собой

📄 <b>Скачать PDF:</b>
👇 Нажми на ссылку:`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '📄 Скачать подарок', url: 'https://drive.google.com/file/d/1zZJWif9tKGAU1-vtZPzrrR8fcvXVQFTL/view?usp=sharing' }]
                    ]
                }
            }
        );
        return;
    }

    // ===== УТРЕННЯЯ ПРАКТИКА СЕЙЧАС =====
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

    // ===== ВЕЧЕРНИЙ ВОПРОС СЕЙЧАС =====
    if (data === 'get_evening_question') {
        bot.answerCallbackQuery(query.id, { text: '🌙 Получай!' });
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const question = getEveningQuestion(dayOffset);
        bot.sendMessage(chatId,
            `🌙 <b>Вечерний вопрос:</b>\n\n📝 ${question}\n\nНе для других. Для себя.\n\n💗`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    // ===== ПРОСТРАНСТВО ТИШИНЫ =====
    if (data === 'space_of_silence') {
        bot.answerCallbackQuery(query.id);
        bot.sendMessage(chatId,
            `🤍 <b>Пространство тишины</b>\n\nЗакрой глаза на 30 секунд.\n\nЯ подожду. 💗`,
            { parse_mode: 'HTML' }
        );
        setTimeout(() => {
            bot.sendMessage(chatId, `✨ Ты вернулась. 💗`, { parse_mode: 'HTML' });
            addPoints(userId, 3, 'Пространство тишины');
        }, 30000);
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

    if (!text || text.startsWith('/') || text.startsWith('🌅') || text.startsWith('🌙') || 
        text.startsWith('📝') || text.startsWith('🧘') || text.startsWith('🏆') || 
        text.startsWith('💬') || text.startsWith('📞') || text.startsWith('🤍') || text.startsWith('❓')) {
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

    // ===== ВОПРОС ЕГОРУ =====
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

    // ===== КОНСУЛЬТАЦИЯ =====
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

    // ===== ДНЕВНИК: НАСТРОЕНИЕ =====
    if (state.step === 'journal_mood') {
        const entryText = text.trim();
        if (entryText.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее о своих ощущениях.', { parse_mode: 'HTML' });
            return;
        }

        const data = loadData();
        data.journal_entries.push({
            user_id: userId,
            mood: state.mood || 'Нормально',
            text: entryText,
            date: new Date().toISOString()
        });
        saveData(data);

        addPoints(userId, 5, 'Запись в дневнике');

        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена!</b>\n\n📝 Твоё состояние: ${state.mood}\n📝 «${entryText}»\n\n💗 Спасибо, что делишься. Это важно.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }

    // ===== ДНЕВНИК: ВЕЧЕРНИЙ ОТВЕТ =====
    if (state.step === 'journal_evening') {
        const entryText = text.trim();
        if (entryText.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее о своих ощущениях.', { parse_mode: 'HTML' });
            return;
        }

        const data = loadData();
        data.journal_entries.push({
            user_id: userId,
            mood: '🌙 Вечерняя рефлексия',
            text: entryText,
            date: new Date().toISOString()
        });
        saveData(data);

        addPoints(userId, 5, 'Вечерняя запись в дневнике');

        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена!</b>\n\n🌙 «${entryText}»\n\n💗 Спокойной ночи.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        return;
    }

    // ===== ОТКЛИК НА ПРАКТИКУ =====
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
// ===== ЗАПУСК =====
// ================================================
scheduleDailyMessages();

console.log('✅ Бот готов к работе!');
console.log(`📌 Ссылка: https://t.me/kruzhka_karpov_bot`);
console.log(`📨 Заявки и вопросы приходят в: ${ADMIN_USERNAME}`);
console.log('⏰ Утренняя рассылка: 7:00');
console.log('⏰ Вечерняя рассылка: 22:00');

process.on('SIGINT', () => {
    console.log('🛑 Бот остановлен');
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.log('⚠️ Ошибка:', error.message);
});