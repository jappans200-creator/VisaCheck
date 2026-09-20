// Warm, culturally-specific messages shown on the results card, and the
// flag emoji used next to each destination name. Every destination in the
// check.html dropdown has an entry here; a few extra countries are included
// for when the dropdown/dataset grows.

const FLAG_EMOJI = {
  "Cyprus": "🇨🇾", "France": "🇫🇷", "Germany": "🇩🇪", "Netherlands": "🇳🇱",
  "Greece": "🇬🇷", "Portugal": "🇵🇹", "Italy": "🇮🇹", "Spain": "🇪🇸",
  "Switzerland": "🇨🇭", "Czechia": "🇨🇿", "Hungary": "🇭🇺", "Poland": "🇵🇱",
  "Croatia": "🇭🇷", "Belgium": "🇧🇪", "Austria": "🇦🇹",
  "United Kingdom": "🇬🇧", "United States": "🇺🇸", "Canada": "🇨🇦",
  "Australia": "🇦🇺", "UAE": "🇦🇪", "Saudi Arabia": "🇸🇦",
  "Philippines": "🇵🇭", "Ireland": "🇮🇪",
  "Japan": "🇯🇵", "Thailand": "🇹🇭", "Singapore": "🇸🇬",
  "South Africa": "🇿🇦", "Brazil": "🇧🇷", "India": "🇮🇳",
  "Mexico": "🇲🇽", "Turkey": "🇹🇷", "New Zealand": "🇳🇿",
  "Denmark": "🇩🇰", "Norway": "🇳🇴", "Russia": "🇷🇺",
};

function getFlagEmoji(destination) {
  return FLAG_EMOJI[destination] || "🌍";
}

// tier is "high" (>=70%), "medium" (40-69%) or "low" (<40%)
const COUNTRY_MESSAGES = {
  "Australia": {
    high: "The kangaroos are ready for you. Don't forget the Great Barrier Reef. 🦘",
    medium: "You've got a real shot at Australia. The kangaroos are cautiously optimistic. 🦘",
    low: "The kangaroos might have to wait. Let's work on those odds first. 🦘",
  },
  "United States": {
    high: "Hollywood is calling. Pack your bags and don't forget to visit the Walk of Fame. 🎬",
    medium: "The American dream is within reach. A few things to strengthen first. 🗽",
    low: "Hollywood will have to wait. But don't give up on the American dream just yet. 🗽",
  },
  "France": {
    high: "The croissants are fresh and Paris is waiting. Bon voyage. 🥐",
    medium: "Paris is possible. The Eiffel Tower is cautiously optimistic about you. 🗼",
    low: "The Eiffel Tower isn't going anywhere. Let's fix those odds first. 🗼",
  },
  "Germany": {
    high: "Oktoberfest has a seat with your name on it. Prost. 🍺",
    medium: "Germany is within reach. The beer gardens are quietly hopeful. 🍺",
    low: "The beer gardens will wait. Let's strengthen that application first. 🍺",
  },
  "Italy": {
    high: "The pasta is on. Rome is ready for you. Andiamo. 🍕",
    medium: "Italy is possible. The pizza is keeping warm just for you. 🍕",
    low: "The pizza can wait. But not forever — let's see what's holding you back. 🍕",
  },
  "Japan": {
    high: "Cherry blossom season is calling your name. Irasshaimase. 🌸",
    medium: "Japan is within reach. Mount Fuji is watching with cautious optimism. 🗻",
    low: "Mount Fuji will still be there. Let's work on those odds first. 🗻",
  },
  "UAE": {
    high: "The Burj Khalifa has a view with your name on it. Welcome to Dubai. 🌆",
    medium: "Dubai dreams are possible. The skyline is cautiously optimistic. 🌆",
    low: "Dubai dreams on hold for now. Here's what's affecting your odds. 🌆",
  },
  "United Kingdom": {
    high: "The London Eye is spinning and Big Ben is ticking. Get packing. 🎡",
    medium: "London is possible. The Thames is cautiously optimistic about your application. 🎡",
    low: "The Queen's Guard will have to wait. Let's sort those odds first. 💂",
  },
  "Canada": {
    high: "The maple syrup is ready. Canada is waiting for you. 🍁",
    medium: "Canada is within reach. The maple leaves are cautiously optimistic. 🍁",
    low: "The maple leaves will fall again next year. Let's improve those odds first. 🍁",
  },
  "Spain": {
    high: "Flamenco, tapas, and sunshine are all yours. Vamos. 💃",
    medium: "Spain is possible. The sangria is on ice and waiting. 🌞",
    low: "The sangria will wait. Here's what's holding your application back. 🌞",
  },
  "Netherlands": {
    high: "The tulips are blooming and Amsterdam is ready. 🌷",
    medium: "The Netherlands is within reach. The windmills are spinning in your favour. 🌷",
    low: "The windmills are still turning. Let's work on those odds first. 🌷",
  },
  "Portugal": {
    high: "Pastéis de nata and Lisbon sunsets are waiting. Bem vindo. 🐟",
    medium: "Portugal is possible. The fado music is playing softly in your favour. 🎵",
    low: "Fado music will still be playing when you're ready. Let's fix those odds. 🎵",
  },
  "Ireland": {
    high: "The luck of the Irish is with you. Sláinte. 🍀",
    medium: "Ireland is within reach. The shamrocks are cautiously on your side. 🍀",
    low: "Even the luck of the Irish has limits. Let's see what's holding you back. 🍀",
  },
  "Greece": {
    high: "The Aegean Sea is calling. Opa. 🏛️",
    medium: "Greece is possible. The gods of Olympus are reviewing your file. 🏛️",
    low: "The gods of Olympus aren't quite ready for you yet. Let's work on it. 🏛️",
  },
  "Switzerland": {
    high: "The Alps are ready for you. Swiss precision says you're good to go. 🏔️",
    medium: "Switzerland is within reach. The Swiss are being typically thorough about your file. ⌚",
    low: "The Swiss alps will keep. Let's sharpen that application first. ⌚",
  },
  "Thailand": {
    high: "The elephants and temples are waiting. Sawadee kha. 🐘",
    medium: "Thailand is possible. The elephants are cautiously optimistic. 🐘",
    low: "The street food can wait. Here's what's affecting your odds. 🍜",
  },
  "Singapore": {
    high: "The Lion City is ready for you. Hawker centres await. 🦁",
    medium: "Singapore is within reach. The Merlion is looking favourably at your application. 🦁",
    low: "The Merlion will wait. Let's work on those odds first. 🦁",
  },
  "Saudi Arabia": {
    high: "The desert sands and ancient history are waiting for you. Ahlan wa sahlan. 🕌",
    medium: "Saudi Arabia is possible. The kingdom is reviewing your file carefully. 🕌",
    low: "The journey to the Kingdom needs more preparation. Here's why. 🕌",
  },
  "South Africa": {
    high: "The Big Five are waiting. Safari time. 🌍",
    medium: "South Africa is within reach. The lions are cautiously optimistic. 🦁",
    low: "The lions can wait. Let's sort those odds first. 🌍",
  },
  "Brazil": {
    high: "Carnival is calling. Bem vindo ao Brasil. 🌴",
    medium: "Brazil is possible. The samba beat is getting louder for you. 🌴",
    low: "The samba will wait. Let's work on those odds first. 🌴",
  },
  "India": {
    high: "From one incredible country to another — the Taj Mahal is waiting. Namaste. 🕌",
    medium: "India is within reach. The Taj Mahal is patiently waiting. 🕌",
    low: "The Taj Mahal will still be there. Let's fix those odds first. 🕌",
  },
  "Mexico": {
    high: "Tacos, tequila, and ancient ruins are all yours. Vámonos. 🌮",
    medium: "Mexico is possible. The tacos are staying warm for you. 🌮",
    low: "The tacos will wait. Here's what's holding your application back. 🌮",
  },
  "Turkey": {
    high: "The hot air balloons over Cappadocia are ready for you. Hoş geldiniz. 🎈",
    medium: "Turkey is within reach. The bazaars are cautiously optimistic. 🕌",
    low: "The bazaars will still be there. Let's work on those odds first. 🕌",
  },
  "New Zealand": {
    high: "The hobbits are expecting you. Welcome to Middle Earth. 🐑",
    medium: "New Zealand is possible. Even hobbits are cautiously optimistic about your application. 🐑",
    low: "Even hobbits have paperwork. Let's sort those odds first. 🐑",
  },
  "Cyprus": {
    high: "The Mediterranean sun is waiting. This time everything is in order. 🌊",
    medium: "Cyprus is within reach. Our founder knows this route well — let's make sure you're ready. 🌊",
    low: "Cyprus taught our founder a €90 lesson. We built this tool so it doesn't teach you one too. 🌊",
  },
  // Generated in the same warm, culturally-specific pattern for destinations
  // not on the original list but present in the checker's dropdown.
  "Czechia": {
    high: "Prague's astronomical clock is ticking in your favour. Na zdraví. 🏰",
    medium: "Czechia is within reach. Prague Castle is cautiously optimistic. 🏰",
    low: "Prague Castle will still be there. Let's work on those odds first. 🏰",
  },
  "Hungary": {
    high: "The thermal baths of Budapest are ready for you. Egészségedre. ♨️",
    medium: "Hungary is within reach. The Danube is cautiously optimistic. ♨️",
    low: "The thermal baths will still be warm when you're ready. Let's fix those odds. ♨️",
  },
  "Poland": {
    high: "Kraków's old town and pierogi are waiting. Na zdrowie. 🥟",
    medium: "Poland is within reach. The pierogi are staying warm for you. 🥟",
    low: "The pierogi can wait. Here's what's affecting your odds. 🥟",
  },
  "Croatia": {
    high: "The Adriatic coast and Dubrovnik's old walls are waiting. Živjeli. 🌊",
    medium: "Croatia is within reach. The Adriatic is cautiously optimistic. 🌊",
    low: "The Adriatic coast isn't going anywhere. Let's work on those odds first. 🌊",
  },
  "Belgium": {
    high: "The waffles and chocolate shops of Brussels are calling. Santé. 🧇",
    medium: "Belgium is within reach. The chocolate shops are cautiously optimistic. 🧇",
    low: "The waffles will still be warm when you're ready. Let's fix those odds first. 🧇",
  },
  "Austria": {
    high: "Vienna's concert halls have a seat waiting for you. Prost. 🎼",
    medium: "Austria is within reach. Vienna is cautiously optimistic about your application. 🎼",
    low: "Vienna's orchestras will still be playing when you're ready. Let's fix those odds. 🎼",
  },
  "Philippines": {
    high: "The islands and beaches of the Philippines are ready for you. Mabuhay. 🏝️",
    medium: "The Philippines is within reach. The beaches are cautiously optimistic. 🏝️",
    low: "The islands will still be there. Let's work on those odds first. 🏝️",
  },
  "Denmark": {
    high: "Copenhagen's canals and hygge are waiting for you. Velkommen. 🧜‍♀️",
    medium: "Denmark is within reach. The Little Mermaid is cautiously optimistic. 🧜‍♀️",
    low: "The Little Mermaid will still be there. Let's work on those odds first. 🧜‍♀️",
  },
  "Norway": {
    high: "The fjords and northern lights are calling. Velkommen til Norge. 🌌",
    medium: "Norway is within reach. The fjords are cautiously optimistic. 🌌",
    low: "The northern lights will still be dancing when you're ready. Let's fix those odds. 🌌",
  },
};

function getMessageTier(percent) {
  if (percent >= 70) return "high";
  if (percent >= 40) return "medium";
  return "low";
}

function getCountryMessage(destination, percent) {
  const tier = getMessageTier(percent);
  const entry = COUNTRY_MESSAGES[destination];
  if (entry) return entry[tier];
  // Generic fallback for any destination without a specific entry yet.
  const generic = {
    high: `${destination} is ready for you. Pack your bags. ✈️`,
    medium: `${destination} is within reach. A few things to strengthen first. ✈️`,
    low: `${destination} will still be there. Let's work on those odds first. ✈️`,
  };
  return generic[tier];
}

// Four colour tiers used for the card background/theme (different cutoffs
// than the three message tiers above).
function getOddsColorTier(percent) {
  if (percent < 20) return "deepred";
  if (percent < 40) return "orange";
  if (percent < 70) return "amber";
  return "green";
}
