import AsyncStorage from '@react-native-async-storage/async-storage';

export type AssistantGender = 'female' | 'male';
export type AssistantLanguage =
  | 'en-US'
  | 'ar-SA'
  | 'ur-PK'
  | 'hi-IN'
  | 'fr-FR'
  | 'es-ES'
  | 'tr-TR';

export type AssistantPrefs = {
  gender: AssistantGender;
  name: string;
  language: AssistantLanguage;
};

const KEY = 'tg_assistant_prefs';

export const DEFAULT_NAME: Record<AssistantGender, string> = {
  female: 'Layla',
  male: 'Sami',
};

export const ASSISTANT_LANGUAGES: {
  code: AssistantLanguage;
  label: string;
  native: string;
}[] = [
  { code: 'en-US', label: 'English', native: 'English' },
  { code: 'ar-SA', label: 'Arabic', native: 'العربية' },
  { code: 'ur-PK', label: 'Urdu', native: 'اردو' },
  { code: 'hi-IN', label: 'Hindi', native: 'हिन्दी' },
  { code: 'fr-FR', label: 'French', native: 'Français' },
  { code: 'es-ES', label: 'Spanish', native: 'Español' },
  { code: 'tr-TR', label: 'Turkish', native: 'Türkçe' },
];

const LANGUAGE_CODES = new Set(ASSISTANT_LANGUAGES.map((l) => l.code));

export const DEFAULT_PREFS: AssistantPrefs = {
  gender: 'female',
  name: DEFAULT_NAME.female,
  language: 'en-US',
};

export function isAssistantLanguage(value: string | undefined): value is AssistantLanguage {
  return Boolean(value && LANGUAGE_CODES.has(value as AssistantLanguage));
}

export function languageLabel(code: AssistantLanguage): string {
  return ASSISTANT_LANGUAGES.find((l) => l.code === code)?.label ?? 'English';
}

/** BCP-47 → Google Maps / Directions language (`en`, `ar`, `ur`, …). */
export function mapsLanguage(code: AssistantLanguage): string {
  return code.split('-')[0];
}

type SpokenPack = {
  preview: (name: string) => string;
  greeting: (name: string) => string;
  filler: string;
  okay: string;
  listening: string;
  thinking: string;
  idleHint: string;
  tapToTalk: string;
  listeningStop: string;
  intro: (guide: string, dest: string, eta: string, first: string) => string;
  offRoute: string;
  arrived: (place: string) => string;
  adding: (place: string) => string;
  nearby: (category: string, place: string, distance: string) => string;
  nearest: (category: string, place: string, distance: string) => string;
  noneNearby: (category: string) => string;
  confirmTitle: string;
  confirmAsk: (what: string) => string;
  confirmNotNow: string;
  confirmOk: string;
};

const COPY: Record<AssistantLanguage, SpokenPack> = {
  'en-US': {
    preview: (name) => `Hi, I'm ${name}, your travel co-pilot. Where would you like to go?`,
    greeting: (name) =>
      `Hey, I'm ${name}. Talk to me like you would a friend in the passenger seat — I'll answer.`,
    filler: 'One second…',
    okay: 'Got it.',
    listening: 'Listening…',
    thinking: 'Thinking…',
    idleHint: 'Tap the mic and talk',
    tapToTalk: 'Tap to talk',
    listeningStop: 'Listening — tap to stop',
    intro: (guide, dest, eta, first) =>
      `I'm ${guide}. Starting your trip to ${dest}. About ${eta}. ${first}`,
    offRoute: "You're off the route. I'll keep guiding you back.",
    arrived: (place) => `You have arrived at ${place}.`,
    adding: (place) => `Great — adding ${place} to your route.`,
    nearby: (category, place, distance) =>
      `There's a famous place nearby — ${place}, about ${distance} away. Would you like to stop there?`,
    nearest: (category, place, distance) =>
      `The nearest ${category} is ${place}, about ${distance} away.`,
    noneNearby: (category) =>
      `I don't see a ${category} inside your selected radius.`,
    confirmTitle: 'Confirm before I change your route',
    confirmAsk: (what) => `Want me to ${what.toLowerCase()}? Just say yes, or say not now.`,
    confirmNotNow: 'Not now',
    confirmOk: 'Confirm',
  },
  'ar-SA': {
    preview: (name) => `مرحباً، أنا ${name}، مساعدك في الرحلة. إلى أين تود الذهاب؟`,
    greeting: (name) =>
      `مرحباً، أنا ${name}. سأرافقك وأذكر الأماكن الشهيرة القريبة. كلّمني متى شئت.`,
    filler: 'لحظة…',
    okay: 'تمام.',
    listening: 'يستمع…',
    thinking: 'يفكر…',
    idleHint: 'اضغط على الميكروفون وتحدث',
    tapToTalk: 'اضغط للتحدث',
    listeningStop: 'يستمع — اضغط للتوقف',
    intro: (guide, dest, eta, first) =>
      `أنا ${guide}. بدأنا الرحلة إلى ${dest}. المدة حوالي ${eta}. ${first}`,
    offRoute: 'خرجت عن المسار. سأعيد توجيهك.',
    arrived: (place) => `لقد وصلت إلى ${place}.`,
    adding: (place) => `حسناً — أضيف ${place} إلى مسارك.`,
    nearby: (category, place, distance) =>
      `هناك مكان شهير قريب — ${place}، على بعد حوالي ${distance}. هل تريد التوقف هناك؟`,
    nearest: (category, place, distance) =>
      `أقرب ${category} هو ${place}، على بعد حوالي ${distance}.`,
    noneNearby: (category) => `لا أرى ${category} داخل النطاق الذي اخترته.`,
    confirmTitle: 'أكد قبل أن أغيّر مسارك',
    confirmAsk: (what) => `هل تريد أن أقوم بـ: ${what}؟ قل نعم، أو قل ليس الآن.`,
    confirmNotNow: 'ليس الآن',
    confirmOk: 'تأكيد',
  },
  'ur-PK': {
    preview: (name) => `السلام علیکم، میں ${name} ہوں، آپ کا سفری ساتھی۔ آپ کہاں جانا چاہتے ہیں؟`,
    greeting: (name) =>
      `السلام علیکم! میں ${name} ہوں۔ ساتھ رہوں گا اور مشہور جگہیں بتاؤں گا۔ جب چاہو بات کر لو۔`,
    filler: 'ایک لمحہ…',
    okay: 'ٹھیک ہے۔',
    listening: 'سن رہا ہے…',
    thinking: 'سوچ رہا ہے…',
    idleHint: 'مائیک دبائیں اور بات کریں',
    tapToTalk: 'بات کرنے کے لیے دبائیں',
    listeningStop: 'سن رہا ہے — روکنے کے لیے دبائیں',
    intro: (guide, dest, eta, first) =>
      `میں ${guide} ہوں۔ ${dest} کا سفر شروع ہو گیا۔ تقریباً ${eta}۔ ${first}`,
    offRoute: 'آپ راستے سے ہٹ گئے ہیں۔ میں واپس رہنمائی کروں گا۔',
    arrived: (place) => `آپ ${place} پہنچ گئے ہیں۔`,
    adding: (place) => `ٹھیک ہے — ${place} کو راستے میں شامل کر رہا ہوں۔`,
    nearby: (category, place, distance) =>
      `قریب ایک مشہور جگہ ہے — ${place}، تقریباً ${distance} دور۔ کیا وہاں رکو گے؟`,
    nearest: (category, place, distance) =>
      `قریب ترین ${category} ${place} ہے، تقریباً ${distance} دور۔`,
    noneNearby: (category) => `منتخب رداس میں کوئی ${category} نہیں ملا۔`,
    confirmTitle: 'راستہ بدلنے سے پہلے تصدیق کریں',
    confirmAsk: (what) => `کیا میں ${what} کروں؟ ہاں کہو، یا ابھی نہیں کہو۔`,
    confirmNotNow: 'ابھی نہیں',
    confirmOk: 'تصدیق',
  },
  'hi-IN': {
    preview: (name) => `नमस्ते, मैं ${name} हूँ, आपका यात्रा साथी। आप कहाँ जाना चाहते हैं?`,
    greeting: (name) =>
      `नमस्ते! मैं ${name} हूँ। साथ रहूँगा और पास की मशहूर जगहें बताऊँगा। जब चाहो, मुझसे बात करो।`,
    filler: 'एक पल…',
    okay: 'ठीक है।',
    listening: 'सुन रहा है…',
    thinking: 'सोच रहा है…',
    idleHint: 'माइक दबाएँ और बोलें',
    tapToTalk: 'बोलने के लिए दबाएँ',
    listeningStop: 'सुन रहा है — रोकने के लिए दबाएँ',
    intro: (guide, dest, eta, first) =>
      `मैं ${guide} हूँ। ${dest} की यात्रा शुरू हो रही है। लगभग ${eta}। ${first}`,
    offRoute: 'आप मार्ग से हट गए हैं। मैं वापस गाइड करूँगा।',
    arrived: (place) => `आप ${place} पहुँच गए हैं।`,
    adding: (place) => `ठीक है — ${place} को रास्ते में जोड़ रहा हूँ।`,
    nearby: (category, place, distance) =>
      `पास में एक प्रसिद्ध जगह है — ${place}, लगभग ${distance} दूर। क्या वहाँ रुकना है?`,
    nearest: (category, place, distance) =>
      `सबसे नज़दीकी ${category} ${place} है, लगभग ${distance} दूर।`,
    noneNearby: (category) => `चुनी हुई दूरी में कोई ${category} नहीं मिला।`,
    confirmTitle: 'रास्ता बदलने से पहले पुष्टि करें',
    confirmAsk: (what) => `क्या मैं ${what} करूँ? हाँ बोलो, या अभी नहीं बोलो।`,
    confirmNotNow: 'अभी नहीं',
    confirmOk: 'पुष्टि',
  },
  'fr-FR': {
    preview: (name) => `Bonjour, je suis ${name}, votre copilote. Où souhaitez-vous aller ?`,
    greeting: (name) =>
      `Bonjour ! Je suis ${name}. Je t’accompagne et je te signale les beaux endroits. Parle-moi quand tu veux.`,
    filler: 'Une seconde…',
    okay: 'D’accord.',
    listening: 'J’écoute…',
    thinking: 'Je réfléchis…',
    idleHint: 'Touchez le micro et parlez',
    tapToTalk: 'Touchez pour parler',
    listeningStop: 'J’écoute — touchez pour arrêter',
    intro: (guide, dest, eta, first) =>
      `Je suis ${guide}. Départ vers ${dest}. Environ ${eta}. ${first}`,
    offRoute: 'Vous avez quitté l’itinéraire. Je vous ramène.',
    arrived: (place) => `Vous êtes arrivé à ${place}.`,
    adding: (place) => `Parfait — j’ajoute ${place} à l’itinéraire.`,
    nearby: (category, place, distance) =>
      `Il y a un lieu célèbre à proximité — ${place}, à environ ${distance}. On s’arrête ?`,
    nearest: (category, place, distance) =>
      `Le ${category} le plus proche est ${place}, à environ ${distance}.`,
    noneNearby: (category) => `Je ne vois pas de ${category} dans le rayon choisi.`,
    confirmTitle: 'Confirmez avant que je change l’itinéraire',
    confirmAsk: (what) => `Je ${what.toLowerCase()} ? Dis oui, ou dis pas maintenant.`,
    confirmNotNow: 'Pas maintenant',
    confirmOk: 'Confirmer',
  },
  'es-ES': {
    preview: (name) => `Hola, soy ${name}, tu copiloto de viaje. ¿Adónde quieres ir?`,
    greeting: (name) =>
      `¡Hola! Soy ${name}. Voy contigo y te cuento los sitios buenos cerca. Háblame cuando quieras.`,
    filler: 'Un segundo…',
    okay: 'Vale.',
    listening: 'Escuchando…',
    thinking: 'Pensando…',
    idleHint: 'Toca el micrófono y habla',
    tapToTalk: 'Toca para hablar',
    listeningStop: 'Escuchando — toca para parar',
    intro: (guide, dest, eta, first) =>
      `Soy ${guide}. Empezamos el viaje a ${dest}. Unos ${eta}. ${first}`,
    offRoute: 'Te has salido de la ruta. Te voy a guiar de vuelta.',
    arrived: (place) => `Has llegado a ${place}.`,
    adding: (place) => `Perfecto — añado ${place} a tu ruta.`,
    nearby: (category, place, distance) =>
      `Hay un lugar famoso cerca — ${place}, a unos ${distance}. ¿Quieres parar?`,
    nearest: (category, place, distance) =>
      `El ${category} más cercano es ${place}, a unos ${distance}.`,
    noneNearby: (category) => `No veo ningún ${category} en el radio elegido.`,
    confirmTitle: 'Confirma antes de que cambie la ruta',
    confirmAsk: (what) => `¿Quieres que ${what.toLowerCase()}? Di que sí, o di que ahora no.`,
    confirmNotNow: 'Ahora no',
    confirmOk: 'Confirmar',
  },
  'tr-TR': {
    preview: (name) => `Merhaba, ben ${name}, seyahat yardımcın. Nereye gitmek istersin?`,
    greeting: (name) =>
      `Merhaba! Ben ${name}. Yanındayım, yakındaki güzel yerleri söyleyeceğim. İstediğin zaman konuş.`,
    filler: 'Bir saniye…',
    okay: 'Tamam.',
    listening: 'Dinliyorum…',
    thinking: 'Düşünüyorum…',
    idleHint: 'Mikrofona dokun ve konuş',
    tapToTalk: 'Konuşmak için dokun',
    listeningStop: 'Dinliyorum — durdurmak için dokun',
    intro: (guide, dest, eta, first) =>
      `Ben ${guide}. ${dest} yolculuğu başlıyor. Yaklaşık ${eta}. ${first}`,
    offRoute: 'Rotadan çıktın. Seni geri yönlendireceğim.',
    arrived: (place) => `${place} noktasına vardın.`,
    adding: (place) => `Tamam — ${place} rotaya ekleniyor.`,
    nearby: (category, place, distance) =>
      `Yakında ünlü bir yer var — ${place}, yaklaşık ${distance}. Durmak ister misin?`,
    nearest: (category, place, distance) =>
      `En yakın ${category} ${place}, yaklaşık ${distance}.`,
    noneNearby: (category) => `Seçilen yarıçapta ${category} göremiyorum.`,
    confirmTitle: 'Rotayı değiştirmeden önce onayla',
    confirmAsk: (what) => `${what} yapayım mı? Evet de, ya da şimdi değil de.`,
    confirmNotNow: 'Şimdi değil',
    confirmOk: 'Onayla',
  },
};

export function spokenCopy(language: AssistantLanguage): SpokenPack {
  return COPY[language] ?? COPY['en-US'];
}

function normalise(raw: Partial<AssistantPrefs>): AssistantPrefs {
  const language = isAssistantLanguage(raw.language) ? raw.language : DEFAULT_PREFS.language;
  const gender: AssistantGender = raw.gender === 'male' ? 'male' : 'female';
  const name = raw.name?.trim() || DEFAULT_NAME[gender];
  return { gender, name, language };
}

export async function loadAssistantPrefs(): Promise<AssistantPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) return normalise(JSON.parse(raw) as Partial<AssistantPrefs>);
  } catch {
    /* fall through to defaults */
  }
  return DEFAULT_PREFS;
}

export async function saveAssistantPrefs(prefs: AssistantPrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(normalise(prefs)));
  } catch {
    /* best-effort persistence */
  }
}
