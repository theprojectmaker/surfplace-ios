// More surf knowledge. g = the heading a topic sits under on the MORE tab.
KNOWLEDGE.forEach((k) => {
  k.g = /RIP|ETIQUETTE|BEFORE YOU/.test(k.t) ? 'STAYING SAFE' : 'READING THE OCEAN';
});

KNOWLEDGE.push(
  // ---------- reading the ocean ----------
  {
    g: 'READING THE OCEAN', t: 'WHERE WAVES COME FROM',
    p: 'Waves are made by wind blowing over open ocean, often a storm thousands of miles away.',
    l: [
      'The stronger the wind, the longer it blows and the more ocean it covers, the bigger the swell.',
      'As swell travels it sorts itself into clean, evenly spaced lines. That is ground swell.',
      'Waves made by local wind are close together and messy. That is wind swell.',
      'A swell from far away can arrive on a calm, sunny day with no wind at all.',
    ],
  },
  {
    g: 'READING THE OCEAN', t: 'SETS AND LULLS',
    l: [
      'Waves arrive in groups called sets, usually 3 to 7 waves.',
      'Between sets the ocean goes quiet. That is a lull, and it can last several minutes.',
      'Long-period swell means bigger sets and longer lulls.',
      'Paddle out during a lull. Time it by watching for a few minutes first.',
      'The biggest wave is often in the middle of the set, not the first one.',
    ],
  },
  {
    g: 'READING THE OCEAN', t: 'PARTS OF A WAVE',
    l: [
      'Peak: the highest point, where the wave breaks first. The best place to take off.',
      'Face: the smooth, unbroken wall you ride.',
      'Lip: the top edge that throws forward.',
      'Shoulder: the lower, gentler part away from the peak.',
      'Whitewater: the foam after the wave has broken. Where beginners learn.',
      'Closeout: a wave that breaks all at once, leaving nowhere to go.',
    ],
  },
  {
    g: 'READING THE OCEAN', t: 'LEFTS AND RIGHTS',
    l: [
      'A wave is named from the surfer\'s view, facing the beach.',
      'A right breaks toward your right as you ride it. From the beach it peels to the left.',
      'A left breaks toward your left.',
      'An A-frame peak breaks both ways, so two surfers can split it.',
      'Going frontside means facing the wave. Backside means your back is to it.',
    ],
  },
  {
    g: 'READING THE OCEAN', t: 'SWELL DIRECTION',
    l: [
      'Swell direction is where the waves come FROM. A south swell travels north.',
      'A beach gets the most size from swell that hits it straight on.',
      'Headlands, islands and points block swell. A spot can be flat while the next beach over is pumping.',
      'This is why the same forecast gives different sizes at different beaches.',
    ],
  },
  {
    g: 'READING THE OCEAN', t: 'US SURF SEASONS',
    l: [
      'East Coast: best from late August to November (hurricane swells), then winter storms. Summer is usually small.',
      'West Coast: big north-west swells from October to March. Smaller, cleaner south swells in summer.',
      'Hawaii: the North Shore fires from November to March. The south shore works in summer.',
      'Gulf Coast: mostly flat. It needs a passing cold front or a tropical storm.',
      'Great waves can show up any month. That is what the forecast is for.',
    ],
  },

  // ---------- getting started ----------
  {
    g: 'GETTING STARTED', t: 'YOUR FIRST DAYS',
    l: [
      'Take a lesson if you can. One hour saves weeks of bad habits.',
      'Use a big soft-top board. Bigger is easier, always.',
      'Pick a sandy beach with small waves, knee to waist high.',
      'Start in the whitewater close to shore before going out the back.',
      'Expect to fall a lot. Everyone does.',
    ],
  },
  {
    g: 'GETTING STARTED', t: 'HOW TO PADDLE',
    l: [
      'Lie centered so the nose sits just above the water, an inch or two.',
      'Keep your chest up and your feet together.',
      'Reach forward and pull deep with cupped hands, one arm at a time.',
      'Look where you want to go, not at the board.',
      'Long, smooth strokes beat fast, splashy ones.',
    ],
  },
  {
    g: 'GETTING STARTED', t: 'THE POP-UP',
    l: [
      'Paddle hard until you feel the wave lift and push you. Then two more strokes.',
      'Hands flat on the board beside your chest, like a push-up.',
      'Push up and bring your feet under you in one motion.',
      'Land with feet wide, knees bent, back foot across the board.',
      'Eyes up and forward. Looking down is how you fall.',
      'Practice it 20 times on the sand before paddling out.',
    ],
  },
  {
    g: 'GETTING STARTED', t: 'GETTING PAST THE WAVES',
    l: [
      'Use the channel, the deeper spot where waves break less.',
      'Small whitewater: push up and let it pass under your chest.',
      'Bigger whitewater on a longboard: turtle roll. Flip over, hold the rails, let it pass, flip back.',
      'On a shortboard: duck dive. Push the nose down, then press the tail with your knee or foot.',
      'Never put the board between you and an oncoming wave.',
    ],
  },
  {
    g: 'GETTING STARTED', t: 'CATCHING A WAVE',
    l: [
      'Sit just outside where the waves are breaking.',
      'Pick your wave early, turn and paddle before it reaches you.',
      'Match its speed. Most missed waves are from not paddling hard enough.',
      'Angle slightly the way the wave is peeling.',
      'If the nose dives, slide back an inch. If you cannot catch it, slide forward.',
    ],
  },

  // ---------- gear ----------
  {
    g: 'GEAR', t: 'TYPES OF SURFBOARD',
    l: [
      'Soft-top (foamie): big, soft, stable. The best first board.',
      'Longboard (9 ft and up): glides in small waves, easy to paddle.',
      'Funboard or mid-length (7 to 8 ft): a step between long and short.',
      'Fish: short, wide and fast. Great in small, weak waves.',
      'Shortboard (under 6\'6"): quick turns, needs good waves and skill.',
      'Step-up and gun: longer, narrower boards for big waves.',
    ],
  },
  {
    g: 'GEAR', t: 'WETSUIT GUIDE',
    p: 'The numbers are thickness in millimeters: body / arms and legs.',
    l: [
      'Above 75°F (24°C): boardshorts or a rash guard.',
      '68 to 75°F (20 to 24°C): spring suit or 2 mm top.',
      '60 to 68°F (16 to 20°C): 3/2 full suit.',
      '54 to 60°F (12 to 16°C): 4/3 with boots.',
      '46 to 54°F (8 to 12°C): 5/4 with boots, gloves and hood.',
      'Below 46°F (8°C): 6/5 hooded suit with mitts.',
      'Wind makes it feel much colder. Go thicker if in doubt.',
    ],
  },
  {
    g: 'GEAR', t: 'LEASH, WAX AND FINS',
    l: [
      'Leash: about as long as your board. It goes on your back ankle.',
      'Check the leash for cuts and the string for wear before every session.',
      'Wax: matched to water temperature (cold, cool, warm, tropical). Wrong wax gets slippery or melts.',
      'Rub wax in small circles until you have bumps. Add a little each session.',
      'Fins: make sure they are tight. A loose fin is a lost fin.',
    ],
  },
  {
    g: 'GEAR', t: 'LOOK AFTER YOUR BOARD',
    l: [
      'Rinse it with fresh water after surfing.',
      'Keep it out of the sun and out of hot cars. Heat ruins boards.',
      'Fix dings before your next surf. Water inside the foam adds weight and rot.',
      'Carry it in a bag or sock to avoid knocks.',
    ],
  },

  // ---------- staying safe ----------
  {
    g: 'STAYING SAFE', t: 'WIPEOUTS',
    l: [
      'Fall flat and away from your board, not head first.',
      'Cover your head with your arms as you come up.',
      'Stay calm underwater. A hold-down feels long but is usually a few seconds.',
      'Come up, find your board, check for the next wave.',
      'In shallow water never dive. Fall like a starfish.',
    ],
  },
  {
    g: 'STAYING SAFE', t: 'HAZARDS TO KNOW',
    l: [
      'Shorebreak: waves that slam straight onto the sand. The cause of many neck and back injuries.',
      'Rocks, reef, piers and jetties: know where they are before you go in.',
      'Other surfers and loose boards: the most common way people get hurt.',
      'Lightning: get out of the water and off the beach.',
      'Cold water: it drains your strength fast. Dress for the water, not the air.',
      'After heavy rain: runoff makes the water dirty for a day or three.',
      'Stingrays and jellyfish: shuffle your feet in warm, sandy shallows.',
    ],
  },
  {
    g: 'STAYING SAFE', t: 'KNOW YOUR LIMITS',
    l: [
      'If you could not swim in from where you are sitting, do not paddle out there.',
      'Waves look smaller from the beach than they are.',
      'Tired, cold or shaken? Go in. The ocean will be there tomorrow.',
      'Do not surf alone at an empty or unfamiliar spot.',
      'Tell someone where you are surfing and when you will be back.',
    ],
  },
  {
    g: 'STAYING SAFE', t: 'SUN AND WATER',
    l: [
      'Use reef-safe, water-resistant sunscreen, and reapply.',
      'Zinc on the nose, lips and under the eyes.',
      'Drink water before and after. You sweat in the surf too.',
      'A rash guard or hat saves your skin on long sessions.',
    ],
  },

  // ---------- surf talk ----------
  {
    g: 'SURF TALK', t: 'WORDS YOU WILL HEAR',
    l: [
      'Glassy: no wind, water smooth as glass.',
      'Offshore: wind blowing from land to sea. Good.',
      'Onshore: wind blowing from sea to land. Messy.',
      'Lineup: where surfers wait for waves.',
      'Outside: farther out, or a shout that a big set is coming.',
      'Inside: closer to shore, where waves have already broken.',
      'Dawn patrol: surfing at first light.',
      'Pumping or firing: the waves are really good.',
      'Blown out: ruined by wind.',
      'Kook: someone who ignores the rules. Do not be one.',
    ],
  },
  {
    g: 'SURF TALK', t: 'MOVES AND RIDES',
    l: [
      'Drop: the first slide down the face.',
      'Bottom turn: the turn at the base of the wave that sets up everything else.',
      'Cutback: turning back toward the breaking part of the wave.',
      'Trim: riding along the face at an even speed.',
      'Barrel or tube: riding inside the hollow part of the wave.',
      'Kick out: leaving the wave on purpose over the back.',
      'Wipeout: falling off.',
    ],
  },
  {
    g: 'SURF TALK', t: 'HOW WAVE SIZE IS MEASURED',
    l: [
      'This app uses face height: trough to crest, as seen from the beach.',
      'Many surfers also talk in body sizes: knee, waist, chest, head high, overhead.',
      'In Hawaii waves are traditionally measured from the back, about half the face height.',
      'A buoy reads open-ocean swell height, which is not the same as the wave at the beach.',
    ],
  },

  // ---------- look after it ----------
  {
    g: 'RESPECT', t: 'LOOK AFTER THE BEACH',
    l: [
      'Take your trash, and one piece of someone else\'s.',
      'Stay off dunes and reef. They protect the coast.',
      'Give wildlife space: seals, turtles, nesting birds.',
      'Be kind to locals and newcomers. Everyone was a beginner once.',
    ],
  }
);
