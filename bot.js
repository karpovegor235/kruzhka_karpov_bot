const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const http = require('http');

// ===== ТОКЕН БОТА =====
const TOKEN = '8831398856:AAGqDAVaVYk-G9WF1ny6gbvu1kGKFC0PCP0';

// ===== ТВОЙ TELEGRAM ID =====
const ADMIN_CHAT_ID = '490337942';
const ADMIN_USERNAME = '@egor_provedet';

console.log('🤖 Бот: @kruzhka_new_bot');
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

const PORT = process.env.PORT || 3000;
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
    }, (res) => {});
    req.on('error', () => {});
    req.end();
}, 4 * 60 * 1000);

// ================================================
// ===== ФАЙЛ ДЛЯ ХРАНЕНИЯ ДАННЫХ =====
// ================================================

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
        field: 'name',
        next: 'feeling'
    },
    {
        id: 'feeling',
        question: '💭 Какое у тебя сейчас состояние? Опиши одним-двумя словами.',
        field: 'state',
        next: 'reason'
    },
    {
        id: 'reason',
        question: '🌟 Что привело тебя сюда? Чего ты ищешь?',
        field: 'reason',
        next: 'expectation'
    },
    {
        id: 'expectation',
        question: '✨ Что бы ты хотела получить от этого бота?',
        field: 'expectation',
        next: 'done'
    }
];

// ================================================
// ===== ФУНКЦИИ ГЕНЕРАЦИИ ОТВЕТОВ =====
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

// ================================================
// ===== ОТПРАВКА РАССЫЛОК =====
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
        
        const dayOffset = Math.floor((Date.now() - new Date(2026, 6, 16).getTime()) / (1000 * 60 * 60 * 24));
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
        step: 0
    };

    const welcomeText = 
`☕ <b>Привет, ${firstName}!</b>

Я — бот «Кружка». Меня создал <b>Егор Карпов</b>.

Но прежде чем я расскажу о себе, давай познакомимся.
Ответь на несколько вопросов — это поможет мне понять, что тебе сейчас нужно.

👇 Первый вопрос:`;

    bot.sendMessage(chatId, welcomeText, {
        parse_mode: 'HTML'
    });

    setTimeout(() => {
        askNextQuestion(chatId, userId);
    }, 1000);
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
    
    // ===== ЗНАКОМСТВО С ЕГОРОМ С ФОТОГРАФИЯМИ =====
    setTimeout(() => {
        sendAboutEgor(chatId);
    }, 2000);
}

// ================================================
// ===== РАССКАЗ О ЕГОРЕ С ФОТОГРАФИЯМИ =====
// ================================================

function sendAboutEgor(chatId) {
    // Фотографии Егора
    const photos = [
        'https://drive.google.com/uc?export=view&id=1J0QHig1ITGQV-6pCC4UK-NytAuc4ugio',
        'https://drive.google.com/uc?export=view&id=1Rqz3WJ3k5aJQQeM6ExurMytf4mvTkOqG',
        'https://drive.google.com/uc?export=view&id=1XQumIRNTqNt0_aRZ3Cp1GccU4APIXtyM',
        'https://drive.google.com/uc?export=view&id=1g6yemJWhPw184kzRxD2AbeReLGPEbUkR'
    ];

    // Текст о Егоре
    const aboutText = 
`━━━━━━━━━━━━━━━━━━━━━━━━━
<b>👤 Меня создал Егор Карпов</b>

Моя жизнь — это гармония между материальным и духовным миром. Я верю, что истинный баланс рождается там, где душа и тело находятся в согласии, и именно это стало основой моего пути.

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>🌿 Я — наставник, целитель и проводник.</b>

Моё предназначение — помогать людям находить внутреннюю поддержку и силу.

<b>Что я делаю:</b>
🧘‍♂️ Обучаю проводников <b>гвоздестояния</b>
🔥 Провожу индивидуальные практики для глубокого понимания себя
🧬 Использую <b>авторский метод системных расстановок</b>
🪵 Работаю с <b>досками садху</b>
🧠 Исцеляю через работу с <b>подсознанием</b>

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📱 Связаться со мной:</b>
Telegram: <a href="https://t.me/egor_provedet">@egor_provedet</a>
Instagram: <a href="https://www.instagram.com/egor_provedet/">@egor_provedet</a>

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>📍 Где можно встретиться:</b>
📖 В этом боте — практики, тест, дневник
📞 На <b>индивидуальной консультации</b>
🧘‍♀️ На <b>офлайн-тренинге</b> «Кружка» (22 августа, Минск)

💗 Ты всегда можешь написать мне через бота.

👇 Хочешь узнать, чем я (бот) могу быть тебе полезен?`;

    // Отправляем первое фото с текстом
    bot.sendPhoto(chatId, photos[0], {
        caption: aboutText,
        parse_mode: 'HTML'
    }).then(() => {
        // Отправляем остальные фото
        for (let i = 1; i < photos.length; i++) {
            setTimeout(() => {
                bot.sendPhoto(chatId, photos[i]);
            }, i * 500);
        }
    });

    // Кнопки после всех фото
    setTimeout(() => {
        bot.sendMessage(chatId, 
            `👇 Что хочешь сделать дальше?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🤖 Расскажи о себе (бот)', callback_data: 'intro_about_bot' }],
                        [{ text: '💫 Сразу к практике', callback_data: 'intro_skip_to_practice' }]
                    ]
                }
            }
        );
    }, photos.length * 500 + 1000);
}

// ================================================
// ===== КНОПКИ ГЛАВНОГО МЕНЮ =====
// ================================================

bot.onText(/🧘‍♀️ Практики и тест/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `🧘‍♀️ <b>Практики и тест</b>

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
    bot.sendMessage(chatId,
        `🗓️ <b>Встречи и мероприятия</b>

<b>🌿 Офлайн-тренинг «Кружка»</b>
📍 Минск, 22 августа 2026
⏰ 10:00 – 16:10

<b>📌 Подробности и запись:</b>
Напиши @egor_provedet`,
        {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: '📝 Записаться', callback_data: 'go_training' }],
                    [{ text: '💬 Написать Егору', callback_data: 'go_write' }]
                ]
            }
        }
    );
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
    
    bot.sendMessage(chatId,
        `🏆 <b>Твой путь</b>

📅 <b>Дней в боте:</b> ${daysInBot}
📖 <b>Дней с записями:</b> ${journalStats.filled}
🧘‍♀️ <b>Тестов пройдено:</b> ${tests.length}
⭐ <b>Баллов:</b> ${points}

<b>Твой уровень:</b> ${level.emoji} ${level.name}

${nextLevel}

<b>Как заработать баллы?</b>
🌅 Утренняя практика → +5 баллов
📝 Запись в дневнике → +5 баллов
🧘‍♀️ Прохождение теста → +10 баллов
🤍 Пространство тишины → +3 балла`,
        { parse_mode: 'HTML' }
    );
});

bot.onText(/💬 О проекте и связь/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId,
        `💬 <b>О проекте и связь</b>

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

    // ===== КОЛБЭКИ ПРИВЕТСТВИЯ =====
    
    if (data === 'intro_about_bot') {
        bot.deleteMessage(chatId, query.message.message_id);
        
        bot.sendMessage(chatId,
            `🤖 <b>Теперь расскажу о себе.</b>

<b>Что я умею:</b>

🧘‍♀️ <b>Тест</b> — 5 вопросов о состоянии
🌅 <b>Утренние практики</b> — 5-7 минут для себя
📖 <b>Годовой дневник</b> — ежедневная рефлексия
🏆 <b>Мой путь</b> — статистика и баллы
🤍 <b>Пространство тишины</b> — 30 секунд остановиться

━━━━━━━━━━━━━━━━━━━━━━━━━
<b>💡 Важно:</b>
Я не про «надо» и «правильно».
Я про тебя и твои ощущения.

👇 Готова начать?`,
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
        return;
    }

    if (data === 'intro_skip_to_practice') {
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
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'test_announce',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `🧘‍♀️ <b>Тест «Состояние твоей кружки»</b>

5 вопросов о твоём состоянии. 2-3 минуты.

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

    // ===== ОСТАЛЬНЫЕ КОЛБЭКИ =====

    if (data === 'go_test') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'test_announce',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `🧘‍♀️ <b>Тест «Состояние твоей кружки»</b>

5 вопросов о твоём состоянии. 2-3 минуты.

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

Каждое утро в 7:00 я присылаю короткую практику.

👇 Хочешь попробовать сейчас?`,
            {
                parse_mode: 'HTML',
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '☀️ Получить практику', callback_data: 'get_morning_practice' }]
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

Закрой глаза на 30 секунд.
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
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `📖 <b>Годовой дневник состояния</b>

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
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `📋 <b>О проекте «Кружка»</b>

«Кружка» — это пространство, где можно остановиться и услышать себя.

Создатель проекта — <b>Егор Карпов</b>.

<b>Что делает Егор?</b>
🧘‍♂️ Практикующий психолог, телесно-ориентированный терапевт
🧬 Работает с расстановками, подсознанием, родовыми узлами
🔥 Проводит гвоздестояние — практику возвращения в тело

<b>Где встретиться с Егором?</b>
📖 В этом боте — практики, тест, дневник
📞 На индивидуальной консультации
🧘‍♀️ На офлайн-тренинге «Кружка» (22 августа, Минск)

💗 Ты всегда можешь написать Егору через бота.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'go_write') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'ask_question',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `💬 <b>Написать Егору</b>

Напиши всё, что сейчас внутри.
Или задай вопрос.

✍️ Просто напиши сообщение в ответ.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'go_help') {
        bot.deleteMessage(chatId, query.message.message_id);
        bot.sendMessage(chatId,
            `❓ <b>Как пользоваться ботом</b>

<b>🧘‍♀️ Практики и тест</b>
→ Тест: 5 вопросов о состоянии
→ Утренние практики: в 7:00
→ Пространство тишины: 30 секунд

<b>📖 Дневники</b>
→ Годовой дневник: ежедневная рефлексия

<b>🗓️ Встречи</b>
→ Офлайн-тренинг «Кружка»

<b>🏆 Мой путь</b>
→ Статистика: дни, практики, баллы

💗 Бот — для тебя, а не ты — для бота.`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    if (data === 'go_training') {
        bot.deleteMessage(chatId, query.message.message_id);
        userStates[chatId] = {
            step: 'consultation',
            lastActivity: Date.now()
        };
        bot.sendMessage(chatId,
            `📝 <b>Запись на тренинг «Кружка»</b>

📍 Минск, 22 августа 2026
⏰ 10:00 – 16:10

👇 Напиши в ответ:
1. Твоё имя
2. Телефон или Telegram

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

    // ===== УТРЕННЯЯ ПРАКТИКА =====
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
});

// ================================================
// ===== ОТПРАВКА ВОПРОСА ТЕСТА =====
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
    
    const text = question.text + `\n\n📊 ${progressBar} ${progress}%`;

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
    let recommendation = '';

    if (score.tired >= 2 || score.drained >= 2) {
        resultEmoji = '🫠';
        resultText = `<b>Твоя кружка переполнена усталостью</b>`;
        recommendation = `🌿 Тебе помогут практики на восстановление энергии.`;
    } else if (score.anxious >= 2 || score.worry >= 2 || score.tense >= 2) {
        resultEmoji = '😰';
        resultText = `<b>Твоя кружка переполнена тревогой</b>`;
        recommendation = `🌿 Тебе помогут дыхательные практики и пространство тишины.`;
    } else if (score.empty >= 2) {
        resultEmoji = '🌫️';
        resultText = `<b>Твоя кружка почти пуста</b>`;
        recommendation = `🌿 Тебе помогут практики заземления и возвращения в тело.`;
    } else if (score.irritated >= 2 || score.guilty >= 2) {
        resultEmoji = '😤';
        resultText = `<b>Твоя кружка переполнена раздражением</b>`;
        recommendation = `🌿 Тебе помогут практики на выражение эмоций.`;
    } else {
        resultEmoji = '☀️';
        resultText = `<b>Твоя кружка в равновесии</b>`;
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

    bot.sendMessage(chatId,
        `${resultEmoji} <b>Твой результат</b>

${resultText}

${recommendation}

📝 Напиши свои ощущения после теста в ответ на это сообщение.`,
        { parse_mode: 'HTML' }
    );

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

    // Обработка ответов на вопросы знакомства
    const userData = userAnswers[userId];
    if (userData && userData.step !== undefined && userData.step < introQuestions.length) {
        handleIntroResponse(chatId, userId, text);
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
            entry = {
                user_id: userId,
                date: state.date,
                morning: '',
                evening: '',
                morningMood: '',
                eveningMood: ''
            };
            data.journal_days.push(entry);
        }
        
        const field = state.time === 'morning' ? 'morning' : 'evening';
        entry[field] = entryText;
        saveData(data);
        addPoints(userId, 3, `Запись в дневнике (${state.time})`);
        
        bot.sendMessage(chatId,
            `✅ <b>Запись сохранена!</b>\n\n💗 Спасибо, что делишься.`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        return;
    }

    // Дневник после теста
    if (state.step === 'journal_after_test') {
        const entryText = text.trim();
        if (entryText.length < 2) {
            bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
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
            `✅ <b>Запись сохранена!</b>\n\n💗 Спасибо, что делишься.`,
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
            `❓ <b>ВОПРОС ОТ УЧАСТНИЦЫ</b>\n\n👤 ${userInfo.first_name || 'Гость'}\n📱 @${userInfo.username || 'не указан'}\n\n📝 "${question}"`,
            { parse_mode: 'HTML' }
        );
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо за вопрос!</b>\n\nЯ передал его Егору. Он ответит.\n\n💗`,
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
            `📞 <b>ЗАПРОС НА КОНСУЛЬТАЦИЮ</b>\n\n👤 ${userInfo.first_name || 'Гость'}\n📱 @${userInfo.username || 'не указан'}\n\n📝 "${consultationText}"`,
            { parse_mode: 'HTML' }
        );
        bot.sendMessage(chatId,
            `🙏 <b>Спасибо!</b>\n\nЯ свяжусь с тобой.\n\n💗`,
            { parse_mode: 'HTML' }
        );
        clearUserState(chatId);
        bot.sendMessage(chatId, `☕ Что дальше?`, { reply_markup: mainKeyboard.reply_markup });
        return;
    }
});

// ================================================
// ===== ОБРАБОТКА ОТВЕТОВ ЗНАКОМСТВА =====
// ================================================

function handleIntroResponse(chatId, userId, text) {
    const userData = userAnswers[userId];
    if (!userData) return;
    
    const currentStep = userData.step || 0;
    if (currentStep >= introQuestions.length) return;
    
    const question = introQuestions[currentStep];
    const answer = text.trim();
    
    if (answer.length < 2) {
        bot.sendMessage(chatId, '✍️ Напиши чуть подробнее.', { parse_mode: 'HTML' });
        return;
    }
    
    userData.answers[question.id] = answer;
    userData.step = currentStep + 1;
    
    setTimeout(() => {
        askNextQuestion(chatId, userId);
    }, 1000);
}

// ================================================
// ===== КОМАНДЫ ДЛЯ АДМИНА =====
// ================================================

bot.onText(/\/status/, (msg) => {
    const chatId = msg.chat.id;
    const ADMIN_ID = 490337942;
    
    if (msg.from.id !== ADMIN_ID) {
        bot.sendMessage(chatId, '⛔ Доступ запрещён.');
        return;
    }
    
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const data = loadData();
    
    bot.sendMessage(chatId,
        `📊 <b>Статус бота</b>\n\n` +
        `⏱ Работает: ${hours}ч ${minutes}м\n` +
        `👥 Пользователей: ${data.users.length}\n` +
        `📝 Записей: ${data.journal_entries?.length || 0}\n` +
        `🧘 Тестов: ${data.test_results?.length || 0}`,
        { parse_mode: 'HTML' }
    );
});

bot.onText(/\/users/, (msg) => {
    if (msg.from.id !== 490337942) return;
    const data = loadData();
    let text = `👥 Пользователей: ${data.users.length}\n\n`;
    if (data.users.length > 0) {
        text += data.users.slice(0, 10).map((u, i) => 
            `${i+1}. ${u.first_name} (@${u.username || 'нет'})`
        ).join('\n');
        if (data.users.length > 10) {
            text += `\n... и еще ${data.users.length - 10}`;
        }
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

// ================================================
// ===== КОМАНДА /BROADCAST =====
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
            `📢 <b>Инструкция</b>\n\n<code>/broadcast Текст</code>\n\n👥 В базе: ${loadData().users.length}`,
            { parse_mode: 'HTML' }
        );
        return;
    }

    sendBroadcast(chatId, text);
});

async function sendBroadcast(adminChatId, messageText) {
    const data = loadData();
    const users = data.users;
    
    if (users.length === 0) {
        bot.sendMessage(adminChatId, '❌ Нет пользователей.');
        return;
    }

    let successCount = 0;
    for (const user of users) {
        try {
            await bot.sendMessage(user.id, messageText, { parse_mode: 'HTML' });
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {}
    }

    bot.sendMessage(adminChatId,
        `📊 Отчёт\n\n✅ Успешно: ${successCount}\n👥 Всего: ${users.length}`,
        { parse_mode: 'HTML' }
    );
}

// ================================================
// ===== ЗАПУСК =====
// ================================================

scheduleDailyMessages();

console.log('✅ Бот готов к работе!');
console.log(`📌 Ссылка: https://t.me/kruzhka_new_bot`);
console.log(`📨 Админ: ${ADMIN_USERNAME}`);
console.log('⏰ Рассылки: 7:00 и 22:00');

process.on('uncaughtException', (error) => {
    console.log('⚠️ Ошибка:', error.message);
});

process.on('SIGINT', () => {
    console.log('🛑 Бот остановлен');
    process.exit(0);
});