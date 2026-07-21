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
        '🌅 Какое намерение у тебя на сегодня?'
    ];
    const eveningQuestions = [
        '🌙 Что было самым важным для тебя сегодня?',
        '🌙 За что ты благодарна себе сегодня?',
        '🌙 Что тебе сегодня удалось?'
    ];
    const questions = type === 'morning' ? morningQuestions : eveningQuestions;
    return questions[dayOfYear % questions.length];
}

// ================================================
// ===== ГЛАВНАЯ КЛАВИАТУРА =====
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
// ===== ВОПРОСЫ ДЛЯ ЗНАКОМСТВА =====
// ================================================

const introQuestions = [
    {
        id: 'name',
        question: '🌸 Как тебя зовут? (Можно вымышленное имя, если хочешь)',
        field: 'name'
    },
    {
        id: 'feeling',
        question: '💭 Какое у тебя сейчас состояние? Опиши одним-двумя словами.',
        field: 'state'
    },
    {
        id: 'reason',
        question: '🌟 Что привело тебя сюда? Чего ты ищешь?',
        field: 'reason'
    },
    {
        id: 'expectation',
        question: '✨ Что бы ты хотела получить от этого бота?',
        field: 'expectation'
    }
];

// ================================================
// ===== ВОПРОСЫ ДЛЯ ЗНАКОМСТВА С ЕГОРОМ =====
// ================================================

const egorQuestions = [
    {
        id: 'egor_1',
        question: '👤 Хочешь узнать, кто меня создал и увидеть его фотографии?'
    },
    {
        id: 'egor_2',
        question: '🧘‍♂️ Хочешь узнать, чем занимается мой создатель?'
    },
    {
        id: 'egor_3',
        question: '📱 Хочешь узнать, как с ним связаться и где встретиться?'
    }
];

// ================================================
// ===== ФУНКЦИИ ЗНАКОМСТВА =====
// ================================================

function generatePersonalizedResponse(answers) {
    const name = answers.name || 'дорогая';
    const state = answers.state || '';
    const reason = answers.reason || '';
    const expectation = answers.expectation || '';
    
    let response = `❤️ <b>Спасибо, что поделилась, ${name}!</b>\n\n`;
    
    if (state) {
        const lowerState = state.toLowerCase();
        if (lowerState.includes('устал') || lowerState.includes('вымотан') || lowerState.includes('тяжело')) {
            response += `Я слышу это состояние. Ты устала — это важно признать.\n\n`;
        } else if (lowerState.includes('тревог') || lowerState.includes('страх') || lowerState.includes('волн')) {
            response += `Тревога — это сигнал. Она говорит о том, что что-то важное требует внимания.\n\n`;
        } else if (lowerState.includes('хорош') || lowerState.includes('отличн') || lowerState.includes('спокойн')) {
            response += `Как прекрасно, что ты чувствуешь это состояние! Сохрани его.\n\n`;
        } else if (lowerState.includes('пусто') || lowerState.includes('ничего')) {
            response += `Пустота — это тоже состояние. Иногда она говорит о том, что пора остановиться.\n\n`;
        } else {
            response += `Спасибо, что делишься своим состоянием.\n\n`;
        }
    }
    
    if (reason) {
        const lowerReason = reason.toLowerCase();
        if (lowerReason.includes('себя') || lowerReason.includes('понять') || lowerReason.includes('разобраться')) {
            response += `Понимание себя — самый ценный путь. Я здесь, чтобы помочь тебе в этом.\n\n`;
        } else if (lowerReason.includes('опор') || lowerReason.includes('поддержк')) {
            response += `Опора — это то, что мы часто ищем снаружи, но она всегда внутри. Я помогу тебе её найти.\n\n`;
        } else if (lowerReason.includes('спокойств') || lowerReason.includes('тишин') || lowerReason.includes('отдых')) {
            response += `Спокойствие — это твоё естественное состояние. Я помогу тебе к нему вернуться.\n\n`;
        } else {
            response += `Твой путь начинается здесь. И это уже шаг.\n\n`;
        }
    }
    
    if (expectation) {
        const lowerExpect = expectation.toLowerCase();
        if (lowerExpect.includes('практик') || lowerExpect.includes('упражнени')) {
            response += `Я дам тебе практики. Они простые и короткие — по 5-7 минут утром и вечером.\n\n`;
        } else if (lowerExpect.includes('дневник') || lowerExpect.includes('запис')) {
            response += `Дневник — это твой разговор с собой. Я буду задавать вопросы, а ты будешь отвечать.\n\n`;
        } else if (lowerExpect.includes('поддержк') || lowerExpect.includes('помощ')) {
            response += `Я здесь, чтобы быть рядом. В этом боте ты найдёшь инструменты, которые помогут.\n\n`;
        } else {
            response += `Мы найдём то, что тебе нужно. Постепенно, шаг за шагом.\n\n`;
        }
    }
    
    return response;
}

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
            `📸 <b>Егор Карпов</b>\n\nВот так выглядит мой создатель.\n\nСвайпайте вправо, чтобы посмотреть все фото ➡️` : 
            '',
        parse_mode: 'HTML'
    }));

    bot.sendMediaGroup(chatId, mediaGroup).catch(() => {
        photos.forEach((url, index) => {
            setTimeout(() => {
                bot.sendPhoto(chatId, url, {
                    caption: index === 0 ? 
                        `📸 <b>Егор Карпов</b>\n\nВот так выглядит мой создатель.` : 
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
`<b>👤 Егор Карпов</b>

Моя жизнь — это гармония между материальным и духовным миром. Я верю, что истинный баланс рождается там, где душа и тело находятся в согласии, и именно это стало основой моего пути.

Я — наставник, целитель и проводник. Моё предназначение — помогать людям находить внутреннюю поддержку и силу.`,

        practices: 
`<b>🧘‍♂️ Чем я занимаюсь:</b>

🧘‍♂️ Обучаю проводников <b>гвоздестояния</b>
🔥 Провожу индивидуальные практики для глубокого понимания себя через древнюю технику гвоздестояния
🧬 Использую <b>авторский метод системных расстановок</b> — помогаю распутывать жизненные узлы
🪵 Работаю с <b>досками садху</b>
🧠 Исцеляю через работу с <b>подсознанием</b>`,

        contacts: 
`<b>📱 Связаться со мной:</b>

Telegram: <a href="https://t.me/egor_provedet">@egor_provedet</a>
Instagram: <a href="https://www.instagram.com/egor_provedet/">@egor_provedet</a>

<b>📍 Где встретиться:</b>
📖 В этом боте — практики, тест, дневник
📞 На <b>индивидуальной консультации</b>
🧘‍♀️ На <b>офлайн-тренинге</b> «Кружка» (22 августа, Минск)

💗 Ты всегда можешь написать мне через бота.`
    };

    bot.sendMessage(chatId, info[type] || info.about, {
        parse_mode: 'HTML'
    });
}

// ================================================
// ===== РАССКАЗ ПРО КРУЖКУ =====
// ================================================

function sendKruzhkaStory(chatId) {
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

💗 Ты готова начать?`;

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
// ===== РАССЫЛКИ =====
// ================================================

async function sendMorningPractice() {
    try {
        const data = loadData();
        const users = data.users || [];
        const today = new Date().toISOString().slice(0, 10);
        
        if (users.length === 0) return;
        
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        const question = getDailyQuestion('morning');
        
        for (const user of users) {
            try {
                await bot.sendMessage(user.id,
                    `${practice.title}\n\n${practice.text}\n\n━━━━━━━━━━━━━━━━\n📖 <b>Дневник: утро</b>\n\n${question}\n\n✍️ Напиши ответ в ответ на это сообщение.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📝 Записать в дневник', callback_data: `journal_morning_${today}_${user.id}` }]
                            ]
                        }
                    }
                );
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (e) {
                console.log(`⚠️ Не удалось отправить практику пользователю ${user.id}`);
            }
        }
    } catch (e) {
        console.error('❌ Ошибка в sendMorningPractice:', e.message);
    }
}

async function sendEveningQuestion() {
    try {
        const data = loadData();
        const users = data.users || [];
        const today = new Date().toISOString().slice(0, 10);
        
        if (users.length === 0) return;
        
        const question = getDailyQuestion('evening');
        
        for (const user of users) {
            try {
                await bot.sendMessage(user.id,
                    `🌙 <b>Вечерний вопрос:</b>\n\n${question}\n\n📖 Напиши ответ в ответ на это сообщение.`,
                    {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: '📝 Записать в дневник', callback_data: `journal_evening_${today}_${user.id}` }]
                            ]
                        }
                    }
                );
                await new Promise(resolve => setTimeout(resolve, 50));
            } catch (e) {
                console.log(`⚠️ Не удалось отправить вопрос пользователю ${user.id}`);
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
// ===== ВОПРОСЫ ДЛЯ ТЕСТА =====
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
        name: firstName,
        answers: {},
        egorStep: 0,
        step: 0,
        inEgorIntro: false,
        kruzhkaStep: 0
    };

    const welcomeText = 
`☕ <b>Привет, ${firstName}!</b>

Я — бот «Кружка». Меня создал <b>Егор Карпов</b>.

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
// ===== ФУНКЦИИ ЗНАКОМСТВА =====
// ================================================

function askNextQuestion(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    const currentStep = userData.step || 0;
    
    if (currentStep >= introQuestions.length) {
        finishIntro(chatId, userId);
        return;
    }
    
    const question = introQuestions[currentStep];
    bot.sendMessage(chatId, question.question, {
        parse_mode: 'HTML'
    });
}

function finishIntro(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    const answers = userData.answers;
    
    const data = loadData();
    const user = data.users.find(u => u.id === userId);
    if (user) {
        user.intro_answers = answers;
        user.intro_completed = true;
        user.intro_date = new Date().toISOString();
        saveData(data);
    }
    
    const personalResponse = generatePersonalizedResponse(answers);
    
    bot.sendMessage(chatId, personalResponse, {
        parse_mode: 'HTML'
    });
    
    setTimeout(() => {
        startEgorIntro(chatId, userId);
    }, 2000);
}

function startEgorIntro(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    userData.egorStep = 0;
    userData.inEgorIntro = true;
    
    askEgorQuestion(chatId, userId);
}

function askEgorQuestion(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData || !userData.inEgorIntro) return;
    
    const currentStep = userData.egorStep || 0;
    
    if (currentStep >= egorQuestions.length) {
        finishEgorIntro(chatId, userId);
        return;
    }
    
    const question = egorQuestions[currentStep];
    
    bot.sendMessage(chatId, question.question, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: '💚 Да, хочу', callback_data: `egor_yes_${currentStep}` }],
                [{ text: '💫 Пропустить', callback_data: 'egor_skip' }]
            ]
        }
    });
}

function finishEgorIntro(chatId, userId) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    userData.inEgorIntro = false;
    userData.egorCompleted = true;
    
    const data = loadData();
    const user = data.users.find(u => u.id === userId);
    if (user) {
        user.egor_completed = true;
        user.egor_date = new Date().toISOString();
        saveData(data);
    }
    
    setTimeout(() => {
        bot.sendMessage(chatId,
            `🤖 <b>Теперь расскажу о себе.</b>

Я — твой карманный инструмент для состояния.

<b>Что я умею:</b>

🧘‍♀️ <b>Тест «Состояние твоей кружки»</b>
5 вопросов, которые покажут, что переполняет твою кружку прямо сейчас.

🌅 <b>Утренние практики</b>
Короткие упражнения (5-7 минут), чтобы начать день с заботы о себе.
Каждое утро в 7:00 я присылаю новую практику.

📖 <b>Годовой дневник</b>
Место для ежедневной рефлексии.
Утром и вечером я задаю вопросы, чтобы ты могла записать свои ощущения.

🏆 <b>Мой путь</b>
Твоя статистика: дни, практики, баллы, уровень.
Это помогает видеть, как ты меняешься день за днём.

🤍 <b>Пространство тишины</b>
30 секунд, чтобы остановиться и просто побыть с собой.

🗓️ <b>Встречи и мероприятия</b>
Информация о живых встречах, тренингах и ретритах с Егором.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💡 Важно:</b>
Я не про «надо» и «правильно».
Я про тебя и твои ощущения.

Ты можешь использовать меня как хочешь:
• Проходить практики каждый день
• Вести дневник, когда есть настроение
• Просто заходить в «Пространство тишины»

Всё, что ты делаешь — для тебя.

👇 С чего хочешь начать?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🧘‍♀️ Пройти тест', callback_data: 'intro_test' }],
                        [{ text: '🌅 Получить практику', callback_data: 'intro_practice' }],
                        [{ text: '🏠 В главное меню', callback_data: 'intro_main' }]
                    ]
                }
            }
        );
    }, 1000);
}

// ================================================
// ===== КНОПКИ ГЛАВНОГО МЕНЮ =====
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

bot.onText(/🏆 Мой путь/, (msg) => {
    const chatId = msg.chat.id;
    const userId = String(chatId);
    const data = loadData();
    
    const points = getUserPoints(userId);
    const level = getUserLevel(points);
    const journalStats = getJournalStats(userId);
    const tests = data.test_results ? data.test_results.filter(t => t.user_id === userId) : [];
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
    
    bot.answerCallbackQuery(query.id);

    // ===== ИСТОРИЯ ПРО КРУЖКУ =====
    if (data === 'kruzhka_story') {
        bot.deleteMessage(chatId, query.message.message_id);
        sendKruzhkaStory(chatId);
        return;
    }

    if (data === 'kruzhka_ready') {
        bot.deleteMessage(chatId, query.message.message_id);
        // Переходим к знакомству
        const userData = userAnswers[userId];
        if (userData) {
            userData.kruzhkaStep = 1;
        }
        const firstName = query.from.first_name || 'Гость';
        bot.sendMessage(chatId,
            `☕ <b>Отлично, ${firstName}!</b>\n\nДавай познакомимся поближе.\n\n👇 Первый вопрос:`,
            { parse_mode: 'HTML' }
        );
        setTimeout(() => {
            askNextQuestion(chatId, userId);
        }, 1000);
        return;
    }

    if (data === 'kruzhka_skip') {
        bot.deleteMessage(chatId, query.message.message_id);
        const firstName = query.from.first_name || 'Гость';
        bot.sendMessage(chatId,
            `☕ <b>Хорошо, ${firstName}!</b>\n\nДавай познакомимся поближе.\n\n👇 Первый вопрос:`,
            { parse_mode: 'HTML' }
        );
        setTimeout(() => {
            askNextQuestion(chatId, userId);
        }, 1000);
        return;
    }

    // ===== ЗНАКОМСТВО С ЕГОРОМ =====
    if (data.startsWith('egor_yes_')) {
        const step = parseInt(data.replace('egor_yes_', ''));
        const userData = userAnswers[userId];
        if (!userData || !userData.inEgorIntro) return;
        
        bot.deleteMessage(chatId, query.message.message_id);
        
        switch(step) {
            case 0:
                sendEgorPhotosAsAlbum(chatId);
                setTimeout(() => {
                    showEgorInfo(chatId, 'about');
                }, 1000);
                setTimeout(() => {
                    userData.egorStep = 1;
                    askEgorQuestion(chatId, userId);
                }, 3000);
                break;
            case 1:
                showEgorInfo(chatId, 'practices');
                setTimeout(() => {
                    userData.egorStep = 2;
                    askEgorQuestion(chatId, userId);
                }, 2500);
                break;
            case 2:
                showEgorInfo(chatId, 'contacts');
                setTimeout(() => {
                    userData.egorStep = 3;
                    finishEgorIntro(chatId, userId);
                }, 3000);
                break;
            default:
                finishEgorIntro(chatId, userId);
        }
        return;
    }

    if (data === 'egor_skip') {
        const userData = userAnswers[userId];
        if (userData) {
            userData.inEgorIntro = false;
            userData.egorCompleted = true;
        }
        bot.deleteMessage(chatId, query.message.message_id);
        finishEgorIntro(chatId, userId);
        return;
    }

    // ===== ПРИВЕТСТВИЕ =====
    if (data === 'intro_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = { step: 'test_announce', lastActivity: Date.now() };
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
        bot.deleteMessage(chatId, query.message.message_id);
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        bot.sendMessage(chatId,
            `${practice.title}\n\n${practice.text}`,
            { parse_mode: 'HTML' }
        );
        addPoints(userId, 5, 'Утренняя практика');
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

    // ===== ПРАКТИКИ =====
    if (data === 'go_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = { step: 'test_announce', lastActivity: Date.now() };
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

    if (data === 'get_morning_practice') {
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
        const practice = getMorningPractice(dayOffset);
        bot.sendMessage(chatId,
            `${practice.title}\n\n${practice.text}`,
            { parse_mode: 'HTML' }
        );
        addPoints(userId, 5, 'Утренняя практика');
        return;
    }

    // ===== ДНЕВНИКИ =====
    if (data === 'go_yearly') {
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

    // ===== О ПРОЕКТЕ =====
    if (data === 'go_about') {
        bot.deleteMessage(chatId, query.message.message_id);
        const text = 
`📋 <b>О проекте «Кружка»</b>

«Кружка» — это пространство, где можно остановиться и услышать себя.

Создатель проекта — <b>Егор Карпов</b>.

<b>Кто такой Егор?</b>
🌿 Наставник, целитель и проводник
🧘‍♂️ Обучает проводников <b>гвоздестояния</b>
🔥 Проводит индивидуальные практики для глубокого понимания себя
🧬 Работает с <b>авторским методом системных расстановок</b>
🪵 Практикует <b>доски садху</b>
🧠 Исцеляет через работу с <b>подсознанием</b>

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
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = { step: 'consultation', lastActivity: Date.now() };
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

    // ===== ТЕСТ =====
    if (data === 'start_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'test',
            currentQuestion: 0,
            answers: [],
            lastActivity: Date.now()
        };
        sendTestQuestion(chatId, 0);
        return;
    }

    if (data.startsWith('test_')) {
        const parts = data.split('_');
        const questionId = parts[1];
        const value = parts[2];
        const state = userStates[chatId];
        if (!state || state.step !== 'test') {
            bot.sendMessage(chatId, 'Начни тест заново: нажми "🧘‍♀️ Пройти тест"');
            return;
        }
        state.answers.push({ questionId, value });
        state.currentQuestion++;
        bot.deleteMessage(chatId, query.message.message_id);
        if (state.currentQuestion >= testQuestions.length) {
            showTestResult(chatId);
        } else {
            sendTestQuestion(chatId, state.currentQuestion);
        }
        return;
    }
});

// ================================================
// ===== ТЕСТ =====
// ================================================

function sendTestQuestion(chatId, index) {
    const state = userStates[chatId];
    if (!state) return;

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

    bot.sendMessage(chatId, text, {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: options.map(opt => [opt])
        }
    });
}

function showTestResult(chatId) {
    const state = userStates[chatId];
    if (!state) return;

    const answers = state.answers;
    let score = { tired: 0, anxious: 0, empty: 0, tense: 0, drained: 0, irritated: 0, guilty: 0, worry: 0 };

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
        text.startsWith('🗓️') || text.startsWith('🏆') || text.startsWith('💬')) {
        return;
    }

    // Знакомство
    const userData = userAnswers[userId];
    if (userData && userData.step !== undefined && userData.step < introQuestions.length) {
        const answer = text.trim();
        if (answer.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
            return;
        }
        userData.answers[introQuestions[userData.step].id] = answer;
        userData.step++;
        setTimeout(() => {
            askNextQuestion(chatId, userId);
        }, 1000);
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

    // Дневник
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
        addPoints(userId, 3, `Запись в дневнике (${state.time})`);
        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена!</b>\n\n💗 Спасибо, что делишься. Это помогает видеть свой путь.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        return;
    }

    // Дневник после теста
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
            `✅ <b>Запись сохранена!</b>\n\n💗 Спасибо, что делишься. Это помогает видеть свой прогресс.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }

    // Вопрос Егору
    if (state.step === 'ask_question') {
        const question = text.trim();
        if (question.length < 3) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
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

    // Консультация
    if (state.step === 'consultation') {
        const consultationText = text.trim();
        if (consultationText.length < 5) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
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
    bot.sendMessage(msg.chat.id,
        `📊 <b>Статус бота</b>\n\n⏱ Работает: ${hours}ч ${minutes}м\n👥 Пользователей: ${data.users.length}\n📝 Записей: ${data.journal_entries?.length || 0}\n🧘 Тестов: ${data.test_results?.length || 0}`,
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